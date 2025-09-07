import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Modal,
  TouchableWithoutFeedback,
  Keyboard
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../state/store';
import { cn } from '../utils/cn';
import { Screen } from '../components/Screen';
import { AsyncButton } from '../components/AsyncButton';


// Priority levels with colors and labels
const PRIORITIES = [
  { key: 'low', label: 'נמוכה', color: '#10b981', bgColor: '#d1fae5', icon: 'arrow-down' },
  { key: 'normal', label: 'רגילה', color: '#3b82f6', bgColor: '#dbeafe', icon: 'remove' },
  { key: 'high', label: 'גבוהה', color: '#ef4444', bgColor: '#fee2e2', icon: 'arrow-up' }
];

export default function ShoppingScreen() {
  const [newItemName, setNewItemName] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItemQuantity, setNewItemQuantity] = useState('1');
  const [newItemPriority, setNewItemPriority] = useState<'low' | 'normal' | 'high'>('normal');
  const [newItemNotes, setNewItemNotes] = useState('');
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [isRemovingItem, setIsRemovingItem] = useState<string | null>(null); // Track which item is being removed
  const [isPurchasingItem, setIsPurchasingItem] = useState<string | null>(null); // Track which item is being purchased
  const [selectedPriorityFilter, setSelectedPriorityFilter] = useState<'all' | 'low' | 'normal' | 'high'>('all');
  
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showItemDetailsModal, setShowItemDetailsModal] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [purchasePrice, setPurchasePrice] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);

  const [purchaseNote, setPurchaseNote] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date());

  const { 
    currentUser, 
    currentApartment, 
    shoppingItems, 
    addShoppingItem, 
    markItemPurchased, 
    removeShoppingItem,
    markItemForRepurchase
  } = useStore();

  const handleAddItem = async () => {
    if (!newItemName.trim() || !currentUser) return;
    
    setIsAddingItem(true);
    try {
      const quantity = parseInt(newItemQuantity) || 1;
      await addShoppingItem(
        newItemName.trim(), 
        currentUser.id, 
        newItemPriority, 
        quantity, 
        newItemNotes.trim() || undefined
      );
      setNewItemName('');
      setNewItemQuantity('1');
      setNewItemPriority('normal');
      setNewItemNotes('');
      setShowAddModal(false);
    } catch (error) {
      console.error('Error adding shopping item:', error);
      Alert.alert('שגיאה', 'לא ניתן להוסיף את הפריט');
    } finally {
      setIsAddingItem(false);
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    const item = shoppingItems.find(i => i.id === itemId);
    if (!item) return;

    if (item.purchased) {
      // Item was already purchased, show details modal
      setSelectedItemId(itemId);
      setShowItemDetailsModal(true);
    } else {
      // Ask if they want to mark as purchased
      Alert.alert(
        'מחיקת פריט',
        'האם קנית את הפריט הזה?',
        [
          {
            text: 'לא, רק תמחק',
            onPress: async () => {
              // Check if item is already being purchased
              if (isPurchasingItem === itemId) return;
              
              setIsRemovingItem(itemId);
              try {
                await removeShoppingItem(itemId);
              } catch (error) {
                console.error('Error removing item:', error);
                Alert.alert('שגיאה', 'לא ניתן למחוק את הפריט');
              } finally {
                setIsRemovingItem(null);
              }
            },
            style: 'destructive'
          },
          {
            text: 'כן, קניתי',
            onPress: () => {
              // Check if item is already being purchased
              if (isPurchasingItem === itemId) return;
              
              setSelectedItemId(itemId);
              // Default to all apartment members
              if (currentApartment) {
                setSelectedParticipants(currentApartment.members.map(m => m.id));
              }
              setShowPurchaseModal(true);
            }
          },
          {
            text: 'ביטול',
            style: 'cancel'
          }
        ]
      );
    }
  };

  const handlePurchaseConfirm = async () => {
    if (!selectedItemId || !currentUser) return;

    const price = parseFloat(purchasePrice);
    if (purchasePrice.trim() && (!price || price <= 0)) {
      Alert.alert('שגיאה', 'אנא הכנס מחיר תקין');
      return;
    }

    if (selectedParticipants.length === 0) {
      Alert.alert('שגיאה', 'יש לבחור לפחות משתתף אחד');
      return;
    }

    setIsPurchasingItem(selectedItemId);
    try {
      await markItemPurchased(
        selectedItemId, 
        currentUser.id, 
        price > 0 ? price : undefined,
        selectedParticipants,
        undefined, // category - removed
        purchaseNote.trim() || undefined,
        purchaseDate
      );

      // Close modal and reset state
      setShowPurchaseModal(false);
      setSelectedItemId(null);
      setPurchasePrice('');
      setSelectedParticipants([]);
      
      setPurchaseNote('');
      setPurchaseDate(new Date());
    } catch (error) {
      console.error('Error marking item as purchased:', error);
      Alert.alert('שגיאה', 'לא ניתן לסמן את הפריט כנרכש');
    } finally {
      setIsPurchasingItem(null);
    }
  };

  const formatDate = (date: Date | string) => {
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      if (isNaN(dateObj.getTime())) {
        return 'תאריך לא תקין';
      }
      return new Intl.DateTimeFormat('he-IL', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      }).format(dateObj);
    } catch (error) {
      return 'תאריך לא תקין';
    }
  };

  const getUserName = (userId: string) => {
    if (userId === currentUser?.id) return 'אתה';
    return currentApartment?.members.find(m => m.id === userId)?.name || 'לא ידוע';
  };

  const handleRepurchase = async (itemId: string) => {
    try {
      const item = shoppingItems.find(i => i.id === itemId);
      await markItemForRepurchase(itemId);
      setShowItemDetailsModal(false);
      setSelectedItemId(null);
      Alert.alert(
        'הצלחה! 🛒',
        `הפריט "${item?.name}" נוסף שוב לרשימת הקניות`,
        [{ text: 'בסדר', style: 'default' }]
      );
    } catch (error) {
      console.error('Error repurchasing item:', error);
      Alert.alert('שגיאה', 'לא ניתן להוסיף את הפריט שוב');
    }
  };

  // Filter items by priority
  const getFilteredItems = () => {
    let items = shoppingItems.filter(item => !item.purchased);
    
    if (selectedPriorityFilter !== 'all') {
      // Filter by actual priority field
      items = items.filter(item => item.priority === selectedPriorityFilter);
    }
    
    // Sort by priority (high first, then normal, then low)
    items.sort((a, b) => {
      const priorityOrder = { high: 3, normal: 2, low: 1 };
      const aPriority = a.priority || 'normal';
      const bPriority = b.priority || 'normal';
      return (priorityOrder[bPriority] || 0) - (priorityOrder[aPriority] || 0);
    });
    
    return items;
  };

  const pendingItems = getFilteredItems();
  const purchasedItems = shoppingItems.filter(item => item.purchased);

  const renderShoppingItem = ({ item }: { item: any }) => (
    <View className={cn(
      "bg-white rounded-xl p-4 mb-3 shadow-sm",
      item.purchased && "bg-gray-50"
    )}>
      <View className="flex-row items-center justify-between">
        <Pressable 
          onPress={() => {
            if (item.purchased) {
              setSelectedItemId(item.id);
              setShowItemDetailsModal(true);
            }
          }}
          className="flex-1"
        >
          <Text className={cn(
            "text-base font-medium",
            item.purchased ? "text-gray-500 line-through" : "text-gray-900"
          )}>
            {item.name}
            {/* TODO: Show quantity when implemented */}
            {/* {item.quantity && item.quantity > 1 && (
              <Text className="text-gray-500 text-sm"> × {item.quantity}</Text>
            )} */}
          </Text>
          
          <View className="flex-row items-center mt-1">
            <Text className="text-sm text-gray-500">
              נוסף על ידי {getUserName(item.addedBy)} • {formatDate(item.addedAt)}
            </Text>
          </View>

          {/* Show priority */}
          {item.priority && (
            <View className="mt-2 flex-row items-center space-x-2">
              {PRIORITIES.find(p => p.key === item.priority) && (
                <View className={cn(
                  "px-2 py-1 rounded-lg flex-row items-center",
                  PRIORITIES.find(p => p.key === item.priority)?.bgColor
                )}>
                  <Ionicons 
                    name={PRIORITIES.find(p => p.key === item.priority)?.icon as any} 
                    size={12} 
                    color={PRIORITIES.find(p => p.key === item.priority)?.color} 
                  />
                  <Text className={cn(
                    "text-xs font-medium mr-1",
                    PRIORITIES.find(p => p.key === item.priority)?.color
                  )}>
                    {PRIORITIES.find(p => p.key === item.priority)?.label}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Show quantity */}
          {item.quantity && item.quantity > 1 && (
            <View className="mt-2 flex-row items-center space-x-2">
              <View className="bg-orange-100 px-2 py-1 rounded-lg flex-row items-center">
                <Ionicons name="list-outline" size={12} color="#f97316" />
                <Text className="text-xs font-medium text-orange-700 mr-1">
                  כמות: {item.quantity}
                </Text>
              </View>
            </View>
          )}

          {/* Show notes */}
          {item.notes && item.notes.trim() && (
            <View className="mt-2 flex-row items-center space-x-2">
              <View className="bg-indigo-100 px-2 py-1 rounded-lg flex-row items-center">
                <Ionicons name="chatbubble-outline" size={12} color="#6366f1" />
                <Text className="text-sm text-indigo-700 mr-1 italic">
                  {item.notes}
                </Text>
              </View>
            </View>
          )}

          {item.purchased && (
            <View className="flex-row items-center mt-2">
              <Ionicons name="checkmark-circle" size={16} color="#10b981" />
              <Text className="text-sm text-green-600 mr-2">
                נקנה על ידי {getUserName(item.purchasedBy!)} 
                {item.purchasePrice && ` • ₪${item.purchasePrice}`}
              </Text>
            </View>
          )}
        </Pressable>

        <Pressable
          onPress={() => handleRemoveItem(item.id)}
          className="p-2"
          disabled={isRemovingItem === item.id || isPurchasingItem === item.id}
        >
          {isRemovingItem === item.id ? (
            <Ionicons name="hourglass" size={24} color="#6b7280" />
          ) : (
            <Ionicons 
              name={item.purchased ? "information-circle-outline" : "close-circle-outline"} 
              size={24} 
              color={item.purchased ? "#3b82f6" : "#ef4444"}
            />
          )}
        </Pressable>
      </View>
    </View>
  );

  if (!currentUser || !currentApartment) {
    return (
      <View className="flex-1 bg-white justify-center items-center">
        <Text className="text-gray-500">טוען...</Text>
      </View>
    );
  }

  return (
    <Screen withPadding={false} keyboardVerticalOffset={0}>
      <View className="bg-white px-6 pt-16 pb-6 shadow-sm">
        <Text className="text-2xl font-bold text-gray-900 text-center mb-4">
          רשימת קניות
        </Text>
        <Text className="text-gray-600 text-center">
          {pendingItems.length} פריטים לקנות
          {selectedPriorityFilter !== 'all' && (
            <Text className="text-blue-600 font-medium">
              {' '}• {PRIORITIES.find(p => p.key === selectedPriorityFilter)?.label}
            </Text>
          )}
        </Text>
      </View>

      {/* Priority Filter */}
      <View className="bg-white mx-6 mt-6 p-4 rounded-2xl shadow-sm">
        <Text className="text-gray-700 text-base mb-3 text-center">סינון לפי דחיפות</Text>
        <View className="flex-row justify-center space-x-2">
          <Pressable
            onPress={() => setSelectedPriorityFilter('all')}
            className={cn(
              "px-4 py-2 rounded-lg border-2",
              selectedPriorityFilter === 'all'
                ? "bg-blue-500 border-blue-500"
                : "bg-gray-50 border-gray-200"
            )}
          >
            <Text className={cn(
              "text-sm font-medium",
              selectedPriorityFilter === 'all' ? "text-white" : "text-gray-700"
            )}>
              הכל
            </Text>
          </Pressable>
          
          {PRIORITIES.map((priority) => (
            <Pressable
              key={priority.key}
              onPress={() => setSelectedPriorityFilter(priority.key as any)}
              className={cn(
                "px-4 py-2 rounded-lg border-2 flex-row items-center",
                selectedPriorityFilter === priority.key
                  ? "bg-blue-500 border-blue-500"
                  : "bg-gray-50 border-gray-200"
              )}
            >
              <Ionicons 
                name={priority.icon as any} 
                size={16} 
                color={selectedPriorityFilter === priority.key ? "white" : priority.color} 
              />
              <Text className={cn(
                "text-sm font-medium mr-1",
                selectedPriorityFilter === priority.key ? "text-white" : "text-gray-700"
              )}>
                {priority.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Add New Item Button */}
      <View className="mx-6 mt-4">
        <Pressable
          onPress={() => setShowAddModal(true)}
          className="bg-blue-500 py-4 px-6 rounded-2xl shadow-sm"
        >
          <View className="flex-row items-center justify-center">
            <Ionicons name="add-circle-outline" size={24} color="white" />
            <Text className="text-white font-semibold text-lg mr-2">
              הוסף פריט חדש
            </Text>
          </View>
        </Pressable>
      </View>

      <ScrollView className="flex-1 px-6 py-6">
        {/* Pending Items */}
        {pendingItems.length > 0 && (
          <View className="mb-6">
            <Text className="text-lg font-semibold text-gray-900 mb-4">
              לקנות
              {selectedPriorityFilter !== 'all' && (
                <Text className="text-blue-600 font-medium text-base">
                  {' '}(דחיפות: {PRIORITIES.find(p => p.key === selectedPriorityFilter)?.label})
                </Text>
              )}
            </Text>
            <FlatList
              data={pendingItems}
              renderItem={renderShoppingItem}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
            />
          </View>
        )}

        {/* No Items Match Filter */}
        {shoppingItems.length > 0 && pendingItems.length === 0 && selectedPriorityFilter !== 'all' && (
          <View className="bg-white rounded-2xl p-8 items-center shadow-sm">
            <Ionicons name="filter-outline" size={64} color="#6b7280" />
            <Text className="text-lg font-medium text-gray-900 mt-4 mb-2">
              אין פריטים עם דחיפות זו
            </Text>
            <Text className="text-gray-600 text-center">
              אין פריטים עם דחיפות "{PRIORITIES.find(p => p.key === selectedPriorityFilter)?.label}"
            </Text>
            <Pressable
              onPress={() => setSelectedPriorityFilter('all')}
              className="bg-blue-500 py-3 px-6 rounded-xl mt-4"
            >
              <Text className="text-white font-medium text-center">
                הצג את כל הפריטים
              </Text>
            </Pressable>
          </View>
        )}

        {/* Empty State */}
        {shoppingItems.length === 0 && (
          <View className="bg-white rounded-2xl p-8 items-center shadow-sm">
            <Ionicons name="basket-outline" size={64} color="#6b7280" />
            <Text className="text-lg font-medium text-gray-900 mt-4 mb-2">
              הרשימה ריקה
            </Text>
            <Text className="text-gray-600 text-center">
              הוסף פריטים לרשימת הקניות השיתופית
            </Text>
          </View>
        )}

        {/* Purchased Items */}
        {purchasedItems.length > 0 && (
          <View className="mb-6">
            <Text className="text-lg font-semibold text-gray-900 mb-4">
              נקנו
            </Text>
            <FlatList
              data={purchasedItems.slice().reverse().slice(0, 10)}
              renderItem={renderShoppingItem}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
            />
          </View>
        )}
      </ScrollView>

      {/* Add Item Modal */}
      <Modal
        visible={showAddModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowAddModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => {
          Keyboard.dismiss();
          setShowAddModal(false);
        }}>
          <View className="flex-1 bg-black/50 justify-center items-center px-6">
            <KeyboardAvoidingView 
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={{ width: '100%' }}
            >
              <TouchableWithoutFeedback onPress={() => {}}>
                <View 
                  className="bg-white rounded-2xl p-6 w-full max-w-sm"
                  style={{ maxHeight: '80%' }}
                >
                <Text className="text-xl font-semibold text-gray-900 mb-6 text-center">
                  הוסף פריט חדש
                </Text>
                
                {/* Item Name */}
                <View className="mb-6">
                  <Text className="text-gray-700 text-base mb-2">שם הפריט *</Text>
                  <TextInput
                    value={newItemName}
                    onChangeText={setNewItemName}
                    placeholder="למשל: חלב, לחם, ביצים..."
                    className="border border-gray-300 rounded-xl px-4 py-3 text-base"
                    textAlign="right"
                    autoFocus
                    returnKeyType="next"
                    blurOnSubmit={false}
                  />
                </View>

                {/* Quantity */}
                <View className="mb-6">
                  <Text className="text-gray-700 text-base mb-2">כמות</Text>
                  <TextInput
                    value={newItemQuantity}
                    onChangeText={setNewItemQuantity}
                    placeholder="1"
                    className="border border-gray-300 rounded-xl px-4 py-3 text-base"
                    textAlign="center"
                    keyboardType="numeric"
                    returnKeyType="next"
                    blurOnSubmit={false}
                  />
                </View>

                {/* Priority */}
                <View className="mb-6">
                  <Text className="text-gray-700 text-base mb-3">רמת דחיפות</Text>
                  <View className="flex-row space-x-2">
                    {PRIORITIES.map((priority) => (
                      <Pressable
                        key={priority.key}
                        onPress={() => setNewItemPriority(priority.key as any)}
                        className={cn(
                          "flex-1 py-3 px-2 rounded-xl border-2 items-center",
                          newItemPriority === priority.key
                            ? "bg-blue-100 border-blue-500"
                            : "bg-gray-50 border-gray-200"
                        )}
                      >
                        <Ionicons 
                          name={priority.icon as any} 
                          size={20} 
                          color={newItemPriority === priority.key ? priority.color : "#6b7280"} 
                        />
                        <Text className={cn(
                          "text-sm font-medium mt-1 text-center",
                          newItemPriority === priority.key ? priority.color : "text-gray-700"
                        )}>
                          {priority.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                {/* Notes */}
                <View className="mb-6">
                  <Text className="text-gray-700 text-base mb-2">הערות (אופציונלי)</Text>
                  <TextInput
                    value={newItemNotes}
                    onChangeText={setNewItemNotes}
                    placeholder="פרטים נוספים, מותג מועדף..."
                    className="border border-gray-300 rounded-xl px-4 py-3 text-base"
                    textAlign="right"
                    multiline
                    numberOfLines={3}
                    returnKeyType="done"
                    blurOnSubmit={true}
                    onSubmitEditing={() => Keyboard.dismiss()}
                  />
                </View>

                {/* Action Buttons */}
                <View className="flex-row space-x-3">
                  <Pressable
                    onPress={() => {
                      setShowAddModal(false);
                      setNewItemName('');
                      setNewItemQuantity('1');
                      setNewItemPriority('normal');
                      setNewItemNotes('');
                    }}
                    className="flex-1 bg-gray-100 py-3 px-4 rounded-xl mr-2"
                    disabled={isAddingItem}
                  >
                    <Text className="text-gray-700 font-medium text-center">
                      ביטול
                    </Text>
                  </Pressable>
                  
                  <Pressable
                    onPress={handleAddItem}
                    disabled={!newItemName.trim() || isAddingItem}
                    className={cn(
                      "flex-1 py-3 px-4 rounded-xl",
                      !newItemName.trim() || isAddingItem
                        ? "bg-gray-400"
                        : "bg-blue-500"
                    )}
                  >
                    <View className="flex-row items-center justify-center">
                      {isAddingItem ? (
                        <Ionicons name="hourglass" size={20} color="white" />
                      ) : (
                        <Ionicons name="add" size={20} color="white" />
                      )}
                      <Text className="text-white font-medium text-center mr-2">
                        {isAddingItem ? 'מוסיף...' : 'הוסף'}
                      </Text>
                    </View>
                  </Pressable>
                </View>
                </View>
              </TouchableWithoutFeedback>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Purchase Confirmation Modal */}
      {showPurchaseModal && (
        <View className="absolute inset-0 bg-black/50 justify-center items-center px-6">
          <ScrollView className="w-full max-w-sm max-h-[80%]" showsVerticalScrollIndicator={false}>
            <View className="bg-white rounded-2xl p-6">
              <Text className="text-xl font-semibold text-gray-900 mb-4 text-center">
                אישור קנייה
              </Text>
              
              {/* Price Input */}
              <View className="mb-6">
                <Text className="text-gray-700 text-base mb-2">מחיר (אופציונלי)</Text>
                <View className="flex-row items-center">
                  <TextInput
                    value={purchasePrice}
                    onChangeText={setPurchasePrice}
                    placeholder="0"
                    className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-base"
                    keyboardType="numeric"
                    textAlign="center"
                    returnKeyType="next"
                    blurOnSubmit={false}
                  />
                  <Text className="text-gray-700 text-lg mr-3">₪</Text>
                </View>
              </View>



              {/* Note Input */}
              <View className="mb-6">
                <Text className="text-gray-700 text-base mb-2">הערה (אופציונלי)</Text>
                <TextInput
                  value={purchaseNote}
                  onChangeText={setPurchaseNote}
                  placeholder="פרטים נוספים..."
                  className="border border-gray-300 rounded-xl px-4 py-3 text-base"
                  textAlign="right"
                  multiline
                  numberOfLines={3}
                  returnKeyType="done"
                  blurOnSubmit={true}
                  onSubmitEditing={() => Keyboard.dismiss()}
                />
              </View>

              {/* Participants Selection */}
              {purchasePrice && parseFloat(purchasePrice) > 0 && (
                <View className="mb-6">
                  <Text className="text-gray-700 text-base mb-3 text-center">
                    מי משתתף ברכישה?
                  </Text>
                  
                  <View className="space-y-2">
                    {currentApartment?.members.map(member => (
                      <Pressable
                        key={member.id}
                        onPress={() => {
                          setSelectedParticipants(prev => 
                            prev.includes(member.id)
                              ? prev.filter(id => id !== member.id)
                              : [...prev, member.id]
                          );
                        }}
                        className={cn(
                          "flex-row items-center justify-between p-3 rounded-xl border",
                          selectedParticipants.includes(member.id)
                            ? "bg-blue-50 border-blue-200"
                            : "bg-gray-50 border-gray-200"
                        )}
                      >
                        <Text className={cn(
                          "font-medium",
                          selectedParticipants.includes(member.id)
                            ? "text-blue-700"
                            : "text-gray-700"
                        )}>
                          {member.name} {member.id === currentUser?.id && '(אתה)'}
                        </Text>
                        
                        <View className={cn(
                          "w-5 h-5 rounded-full border-2 items-center justify-center",
                          selectedParticipants.includes(member.id)
                            ? "bg-blue-500 border-blue-500"
                            : "border-gray-300"
                        )}>
                          {selectedParticipants.includes(member.id) && (
                            <Ionicons name="checkmark" size={12} color="white" />
                          )}
                        </View>
                      </Pressable>
                    ))}
                  </View>
                  
                  <Text className="text-xs text-gray-500 text-center mt-2">
                    ההוצאה תחולק שווה בשווה בין המשתתפים
                  </Text>
                </View>
              )}

              <Text className="text-sm text-gray-500 text-center mb-6">
                {purchasePrice && parseFloat(purchasePrice) > 0 
                  ? "ההוצאה תתווסף אוטומטית לתקציב"
                  : "אם תכניס מחיר, ההוצאה תתווסף אוטומטית לתקציב"
                }
              </Text>

              <View className="flex-row space-x-3">
                <Pressable
                  onPress={() => {
                    setShowPurchaseModal(false);
                    setSelectedItemId(null);
                    setPurchasePrice('');
                    setSelectedParticipants([]);
            
                    setPurchaseNote('');
                    setPurchaseDate(new Date());
                  }}
                  className="flex-1 bg-gray-100 py-3 px-4 rounded-xl mr-2"
                >
                  <Text className="text-gray-700 font-medium text-center">
                    ביטול
                  </Text>
                </Pressable>
                
                <Pressable
                  onPress={handlePurchaseConfirm}
                  disabled={isPurchasingItem === selectedItemId}
                  className="flex-1 bg-green-500 py-3 px-4 rounded-xl"
                >
                  {isPurchasingItem === selectedItemId ? (
                    <View className="flex-row items-center justify-center">
                      <Ionicons name="hourglass" size={20} color="white" />
                      <Text className="text-white font-medium text-center mr-2">
                        מוסיף...
                      </Text>
                    </View>
                  ) : (
                    <Text className="text-white font-medium text-center">
                      אישור
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </View>
      )}

      {/* Item Details Modal */}
      {showItemDetailsModal && selectedItemId && (
        <View className="absolute inset-0 bg-black/50 justify-center items-center px-6">
          <View className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <Text className="text-xl font-semibold text-gray-900 mb-6 text-center">
              פרטי הפריט
            </Text>
            
            {(() => {
              const item = shoppingItems.find(i => i.id === selectedItemId);
              if (!item) return null;
              
              return (
                <View className="space-y-5">
                  {/* Item Name */}
                  <View className="bg-gray-50 p-4 rounded-xl">
                    <Text className="text-gray-600 text-sm mb-2 text-center">שם הפריט</Text>
                    <Text className="text-gray-900 font-semibold text-lg text-center">{item?.name || ''}</Text>
                  </View>

                  {/* Added Info */}
                  <View className="bg-blue-50 p-4 rounded-xl">
                    <View className="flex-row items-center justify-center mb-2">
                      <Ionicons name="person-add-outline" size={16} color="#3b82f6" />
                      <Text className="text-blue-700 text-sm font-medium mr-2">נוסף על ידי</Text>
                    </View>
                    <Text className="text-blue-900 font-medium text-center">{getUserName(item?.addedBy || '')}</Text>
                    <Text className="text-blue-600 text-sm text-center mt-1">{formatDate(item?.addedAt || new Date())}</Text>
                  </View>

                  {/* Show priority */}
                  {item?.priority && (
                    <View className="bg-purple-50 p-4 rounded-xl">
                      <View className="flex-row items-center justify-center mb-2">
                        <Ionicons 
                          name={PRIORITIES.find(p => p.key === item.priority)?.icon as any} 
                          size={16} 
                          color={PRIORITIES.find(p => p.key === item.priority)?.color} 
                        />
                        <Text className="text-purple-700 text-sm font-medium mr-2">דחיפות</Text>
                      </View>
                      <Text className="text-purple-900 font-medium text-center">
                        {PRIORITIES.find(p => p.key === item.priority)?.label}
                      </Text>
                    </View>
                  )}

                  {/* Show quantity */}
                  {item?.quantity && item.quantity > 1 && (
                    <View className="bg-orange-50 p-4 rounded-xl">
                      <View className="flex-row items-center justify-center mb-2">
                        <Ionicons name="list-outline" size={16} color="#f97316" />
                        <Text className="text-orange-700 text-sm font-medium mr-2">כמות</Text>
                      </View>
                      <Text className="text-orange-900 font-bold text-xl text-center">{item.quantity}</Text>
                    </View>
                  )}

                  {/* Show notes */}
                  {item?.notes && item.notes.trim() && (
                    <View className="bg-indigo-50 p-4 rounded-xl">
                      <View className="flex-row items-center justify-center mb-2">
                        <Ionicons name="chatbubble-outline" size={16} color="#6366f1" />
                        <Text className="text-indigo-700 text-sm font-medium mr-2">הערות</Text>
                      </View>
                      <Text className="text-indigo-900 text-center">{item.notes}</Text>
                    </View>
                  )}

                  {/* Purchase Info */}
                  {item?.purchased && (
                    <>
                      <View className="bg-green-50 p-4 rounded-xl">
                        <View className="flex-row items-center justify-center mb-2">
                          <Ionicons name="checkmark-circle-outline" size={16} color="#10b981" />
                          <Text className="text-green-700 text-sm font-medium mr-2">נקנה על ידי</Text>
                        </View>
                        <Text className="text-green-900 font-medium text-center">{getUserName(item?.purchasedBy || '')}</Text>
                        {item?.purchasedAt && (
                          <Text className="text-blue-600 text-sm text-center mt-1">{formatDate(item.purchasedAt)}</Text>
                        )}
                      </View>

                      {item?.purchasePrice && item.purchasePrice > 0 && (
                        <View className="bg-yellow-50 p-4 rounded-xl">
                          <View className="flex-row items-center justify-center mb-2">
                            <Ionicons name="cash-outline" size={16} color="#eab308" />
                            <Text className="text-yellow-700 text-sm font-medium mr-2">מחיר</Text>
                          </View>
                          <Text className="text-yellow-900 font-bold text-xl text-center">₪{item.purchasePrice}</Text>
                        </View>
                      )}
                    </>
                  )}

                  {/* Action Buttons */}
                  <View className="flex-row space-x-3 mt-6">
                    <Pressable
                      onPress={() => {
                        setShowItemDetailsModal(false);
                        setSelectedItemId(null);
                      }}
                      className="flex-1 bg-gray-100 py-3 px-4 rounded-xl mr-2"
                    >
                      <Text className="text-gray-700 font-medium text-center">
                        סגור
                      </Text>
                    </Pressable>
                    
                    <Pressable
                      onPress={() => selectedItemId && handleRepurchase(selectedItemId)}
                      className="flex-1 bg-blue-500 py-3 px-4 rounded-xl"
                    >
                      <Text className="text-white font-medium text-center">
                        הוסף שוב לרשימה
                      </Text>
                    </Pressable>
                  </View>
                </View>
              );
            })()}
          </View>
        </View>
      )}
    </Screen>
  );
}