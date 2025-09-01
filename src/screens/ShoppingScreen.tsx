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
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../state/store';
import { cn } from '../utils/cn';

export default function ShoppingScreen() {
  const [newItemName, setNewItemName] = useState('');
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [purchasePrice, setPurchasePrice] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);

  const { 
    currentUser, 
    currentApartment, 
    shoppingItems, 
    addShoppingItem, 
    markItemPurchased, 
    removeShoppingItem 
  } = useStore();

  const handleAddItem = () => {
    if (!newItemName.trim() || !currentUser) return;
    
    addShoppingItem(newItemName.trim(), currentUser.id);
    setNewItemName('');
  };

  const handleRemoveItem = (itemId: string) => {
    const item = shoppingItems.find(i => i.id === itemId);
    if (!item) return;

    if (item.purchased) {
      // Item was already purchased, just remove
      removeShoppingItem(itemId);
    } else {
      // Ask if they want to mark as purchased
      Alert.alert(
        'מחיקת פריט',
        'האם קנית את הפריט הזה?',
        [
          {
            text: 'לא, רק תמחק',
            onPress: () => removeShoppingItem(itemId),
            style: 'destructive'
          },
          {
            text: 'כן, קניתי',
            onPress: () => {
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

  const handlePurchaseConfirm = () => {
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

    markItemPurchased(
      selectedItemId, 
      currentUser.id, 
      price > 0 ? price : undefined,
      selectedParticipants
    );

    // Close modal and reset state
    setShowPurchaseModal(false);
    setSelectedItemId(null);
    setPurchasePrice('');
    setSelectedParticipants([]);
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

  const pendingItems = shoppingItems.filter(item => !item.purchased);
  const purchasedItems = shoppingItems.filter(item => item.purchased);

  const renderShoppingItem = ({ item }: { item: any }) => (
    <View className={cn(
      "bg-white rounded-xl p-4 mb-3 shadow-sm",
      item.purchased && "bg-gray-50"
    )}>
      <View className="flex-row items-center justify-between">
        <View className="flex-1">
          <Text className={cn(
            "text-base font-medium",
            item.purchased ? "text-gray-500 line-through" : "text-gray-900"
          )}>
            {item.name}
          </Text>
          
          <View className="flex-row items-center mt-1">
            <Text className="text-sm text-gray-500">
              נוסף על ידי {getUserName(item.addedBy)} • {formatDate(item.addedAt)}
            </Text>
          </View>

          {item.purchased && (
            <View className="flex-row items-center mt-2">
              <Ionicons name="checkmark-circle" size={16} color="#10b981" />
              <Text className="text-sm text-green-600 mr-2">
                נקנה על ידי {getUserName(item.purchasedBy!)} 
                {item.purchasePrice && ` • ₪${item.purchasePrice}`}
              </Text>
            </View>
          )}
        </View>

        <Pressable
          onPress={() => handleRemoveItem(item.id)}
          className="p-2"
        >
          <Ionicons 
            name={item.purchased ? "trash-outline" : "close-circle-outline"} 
            size={24} 
            color={item.purchased ? "#6b7280" : "#ef4444"}
          />
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
    <KeyboardAvoidingView 
      className="flex-1 bg-gray-50" 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View className="bg-white px-6 pt-16 pb-6 shadow-sm">
        <Text className="text-2xl font-bold text-gray-900 text-center mb-4">
          רשימת קניות
        </Text>
        <Text className="text-gray-600 text-center">
          {pendingItems.length} פריטים לקנות
        </Text>
      </View>

      {/* Add New Item */}
      <View className="bg-white mx-6 mt-6 p-4 rounded-2xl shadow-sm">
        <View className="flex-row items-center">
          <TextInput
            value={newItemName}
            onChangeText={setNewItemName}
            placeholder="הוסף פריט לקניות..."
            className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-base"
            textAlign="right"
            onSubmitEditing={handleAddItem}
            returnKeyType="done"
          />
          <Pressable
            onPress={handleAddItem}
            className="bg-blue-500 w-12 h-12 rounded-xl items-center justify-center mr-3"
          >
            <Ionicons name="add" size={24} color="white" />
          </Pressable>
        </View>
      </View>

      <ScrollView className="flex-1 px-6 py-6">
        {/* Pending Items */}
        {pendingItems.length > 0 && (
          <View className="mb-6">
            <Text className="text-lg font-semibold text-gray-900 mb-4">
              לקנות
            </Text>
            <FlatList
              data={pendingItems}
              renderItem={renderShoppingItem}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
            />
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
      </ScrollView>

      {/* Purchase Confirmation Modal */}
      {showPurchaseModal && (
        <View className="absolute inset-0 bg-black/50 justify-center items-center px-6">
          <View className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <Text className="text-xl font-semibold text-gray-900 mb-4 text-center">
              אישור קנייה
            </Text>
            
            <Text className="text-gray-600 text-center mb-4">
              בכמה קנית את הפריט? (אופציונלי)
            </Text>

            <View className="flex-row items-center mb-6">
              <TextInput
                value={purchasePrice}
                onChangeText={setPurchasePrice}
                placeholder="0"
                className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-base"
                keyboardType="numeric"
                textAlign="center"
              />
              <Text className="text-gray-700 text-lg mr-3">₪</Text>
            </View>

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
                }}
                className="flex-1 bg-gray-100 py-3 px-4 rounded-xl mr-2"
              >
                <Text className="text-gray-700 font-medium text-center">
                  ביטול
                </Text>
              </Pressable>
              
              <Pressable
                onPress={handlePurchaseConfirm}
                className="flex-1 bg-green-500 py-3 px-4 rounded-xl"
              >
                <Text className="text-white font-medium text-center">
                  אישור
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}