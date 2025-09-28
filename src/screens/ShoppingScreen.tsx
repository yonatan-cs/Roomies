import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
  FlatList,
  Platform,
  Modal,
  Keyboard,
  Dimensions,
  Animated
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../state/store';
import { cn } from '../utils/cn';
import { Screen } from '../components/Screen';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { success, impactMedium, selection, impactLight, warning } from '../utils/haptics';
import { getDisplayName } from '../utils/userDisplay';
import { ThemedCard } from '../theme/components/ThemedCard';
import { ThemedText } from '../theme/components/ThemedText';
import { useThemedStyles } from '../theme/useThemedStyles';
import { useTheme } from '../theme/ThemeProvider';


// ---------- helpers: animated keyboard-aware card (בלי KAV, בלי גלילה) ----------
function useKeyboardLift() {
  const shift = useRef(new Animated.Value(0)).current;
  const [cardH, setCardH] = useState(0);
  const [cardY, setCardY] = useState(0);

  useEffect(() => {
    const winH = Dimensions.get('window').height;
    const margin = 12; // מרווח קטן מתחת לכפתורים

    const onShow = (e: any) => {
      const kbH = e?.endCoordinates?.height ?? 0;
      const cardBottom = cardY + cardH;
      const overflow = cardBottom + kbH + margin - winH;
      const needed = Math.max(0, overflow);
      Animated.timing(shift, { toValue: needed, duration: 160, useNativeDriver: true }).start();
    };
    const onHide = () => {
      Animated.timing(shift, { toValue: 0, duration: 160, useNativeDriver: true }).start();
    };

    const subShow = Platform.OS === 'ios'
      ? Keyboard.addListener('keyboardWillShow', onShow)
      : Keyboard.addListener('keyboardDidShow', onShow);
    const subHide = Platform.OS === 'ios'
      ? Keyboard.addListener('keyboardWillHide', onHide)
      : Keyboard.addListener('keyboardDidHide', onHide);

    return () => {
      subShow?.remove?.();
      subHide?.remove?.();
    };
  }, [cardH, cardY, shift]);

  const onLayoutCard = (e: any) => {
    const { height, y } = e.nativeEvent.layout;
    setCardH(height);
    setCardY(y);
  };

  // translateY למעלה (שלילי)
  const animatedStyle = useMemo(
    () => ({ transform: [{ translateY: Animated.multiply(shift, -1) as any }] }),
    [shift]
  );

  return { animatedStyle, onLayoutCard };
}

export default function ShoppingScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<any>();
  const appLanguage = useStore(s => s.appLanguage);
  const { theme } = useTheme();
  const themed = useThemedStyles(tk => ({
    textSecondary: { color: tk.colors.text.secondary },
    surfaceBg: { backgroundColor: tk.colors.surface },
    borderColor: { borderColor: tk.colors.border.primary },
  }));
  const [newItemName, setNewItemName] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItemQuantity, setNewItemQuantity] = useState('1');
  const [newItemPriority, setNewItemPriority] = useState<'low' | 'normal' | 'high'>('normal');
  const [newItemNotes, setNewItemNotes] = useState('');
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [isRemovingItem, setIsRemovingItem] = useState<string | null>(null);
  const [isPurchasingItem, setIsPurchasingItem] = useState<string | null>(null);
  const [isRepurchasingItem, setIsRepurchasingItem] = useState<string | null>(null);
  const [selectedPriorityFilter, setSelectedPriorityFilter] = useState<'all' | 'low' | 'normal' | 'high'>('all');

  // Priority levels with colors and labels - now using i18n
  const PRIORITIES = [
    { key: 'low', label: t('shopping.priorities.low'), color: '#10b981', bgColor: '#d1fae5', icon: 'arrow-down' },
    { key: 'normal', label: t('shopping.priorities.normal'), color: '#3b82f6', bgColor: '#dbeafe', icon: 'remove' },
    { key: 'high', label: t('shopping.priorities.high'), color: '#ef4444', bgColor: '#fee2e2', icon: 'arrow-up' }
  ];

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
      success(); // Haptic feedback for successfully adding item
      setNewItemName('');
      setNewItemQuantity('1');
      setNewItemPriority('normal');
      setNewItemNotes('');
      setShowAddModal(false);
    } catch (error) {
      console.error('Error adding shopping item:', error);
      Alert.alert(t('shopping.alerts.error'), t('shopping.alerts.cannotAdd'));
    } finally {
      setIsAddingItem(false);
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    const item = shoppingItems.find(i => i.id === itemId);
    if (!item) return;

    if (item.purchased) {
      setSelectedItemId(itemId);
      setShowItemDetailsModal(true);
    } else {
      Alert.alert(
        t('shopping.deleteModal.title'),
        '',
        [
          {
            text: t('shopping.deleteModal.noJustDelete'),
            onPress: async () => {
              if (isRemovingItem === itemId) return;
              setIsRemovingItem(itemId);
              try {
                await removeShoppingItem(itemId);
              } catch (error) {
                console.error('Error removing item:', error);
                Alert.alert(t('shopping.alerts.error'), t('shopping.alerts.cannotRemove'));
              } finally {
                setIsRemovingItem(null);
              }
            },
            style: 'destructive'
          },
          {
            text: t('shopping.deleteModal.yesPurchased'),
            onPress: () => {
              if (isPurchasingItem === itemId) return;
              setSelectedItemId(itemId);
              if (currentApartment) {
                setSelectedParticipants(currentApartment.members.map(m => m.id));
              }
              setShowPurchaseModal(true);
            }
          },
          { text: t('shopping.deleteModal.cancel'), style: 'cancel' }
        ]
      );
    }
  };

  const handlePurchaseConfirm = async () => {
    if (!selectedItemId || !currentUser) return;
    
    // Price is now mandatory - check if it's provided and valid
    if (!purchasePrice.trim()) {
      Alert.alert(t('shopping.alerts.error'), t('shopping.alerts.priceRequired'));
      return;
    }
    
    const price = parseFloat(purchasePrice);
    if (!price || price <= 0) {
      Alert.alert(t('shopping.alerts.error'), t('shopping.alerts.invalidPrice'));
      return;
    }
    
    if (selectedParticipants.length === 0) {
      Alert.alert(t('shopping.alerts.error'), t('shopping.alerts.needParticipants'));
      return;
    }

    setIsPurchasingItem(selectedItemId);
    try {
      await markItemPurchased(
        selectedItemId,
        currentUser.id,
        price, // Price is now mandatory
        selectedParticipants,
        undefined,
        purchaseNote.trim() || undefined,
        purchaseDate
      );

      impactMedium(); // Haptic feedback for marking item as purchased
      setShowPurchaseModal(false);
      setSelectedItemId(null);
      setPurchasePrice('');
      setSelectedParticipants([]);
      setPurchaseNote('');
      setPurchaseDate(new Date());
    } catch (error) {
      console.error('Error marking item as purchased:', error);
      Alert.alert(t('shopping.alerts.error'), t('shopping.alerts.cannotMarkPurchased'));
    } finally {
      setIsPurchasingItem(null);
    }
  };

  const formatDate = (date: Date | string) => {
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      if (isNaN(dateObj.getTime())) return t('common.invalidDate');
      const locale = appLanguage === 'he' ? 'he-IL' : 'en-US';
      return new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      }).format(dateObj);
    } catch {
      return t('common.invalidDate');
    }
  };

  const getUserName = (userId: string) => {
    if (userId === currentUser?.id) return t('common.you');
    const member = currentApartment?.members.find(m => m.id === userId);
    return getDisplayName(member) || t('common.unknown');
  };

  const handleRepurchase = async (itemId: string) => {
    if (isRepurchasingItem === itemId) return; // Prevent double-click
    
    setIsRepurchasingItem(itemId);
    try {
      const item = shoppingItems.find(i => i.id === itemId);
      await markItemForRepurchase(itemId);
      setShowItemDetailsModal(false);
      setSelectedItemId(null);
      Alert.alert(t('shopping.alerts.success'), t('shopping.alerts.repurchased', { name: item?.name || '' }), [
        { text: t('common.ok'), style: 'default' }
      ]);
    } catch (error) {
      console.error('Error repurchasing item:', error);
      Alert.alert(t('common.error'), t('shopping.alerts.cannotAdd'));
    } finally {
      setIsRepurchasingItem(null);
    }
  };

  // Filter + sort
  const getFilteredItems = () => {
    let items = shoppingItems.filter(item => !item.purchased);
    if (selectedPriorityFilter !== 'all') {
      items = items.filter(item => item.priority === selectedPriorityFilter);
    }
    items.sort((a, b) => {
      const order: any = { high: 3, normal: 2, low: 1 };
      const aP = a.priority || 'normal';
      const bP = b.priority || 'normal';
      return (order[bP] || 0) - (order[aP] || 0);
    });
    return items;
  };

  const pendingItems = getFilteredItems();
  const purchasedItems = shoppingItems.filter(item => item.purchased);

  const renderShoppingItem = ({ item }: { item: any }) => (
    <ThemedCard className={cn('rounded-xl p-4 mb-3 shadow-sm', item.purchased && '')}>
      <View className="flex-row items-center justify-between">
        <Pressable
          onPress={() => {
            if (item.purchased) {
              impactLight(); // Haptic feedback for item details
              setSelectedItemId(item.id);
              setShowItemDetailsModal(true);
            }
          }}
          className="flex-1"
        >
          <ThemedText className={cn('text-base font-medium', item.purchased ? 'line-through' : '')}>
            {item.name}
          </ThemedText>

          <View className="flex-row items-center mt-1">
            <ThemedText className="text-sm">{t('shopping.addedByAt', { name: getUserName(item.addedBy), date: formatDate(item.addedAt) })}</ThemedText>
          </View>

          {item.priority && (
            <View className="mt-2 flex-row items-center space-x-2">
              {PRIORITIES.find(p => p.key === item.priority) && (
                <View
                  className={cn(
                    'px-2 py-1 rounded-lg flex-row items-center',
                    PRIORITIES.find(p => p.key === item.priority)?.bgColor
                  )}
                >
                  <Ionicons
                    name={PRIORITIES.find(p => p.key === item.priority)?.icon as any}
                    size={12}
                    color={PRIORITIES.find(p => p.key === item.priority)?.color}
                  />
                  <Text className={cn('text-xs font-medium mr-1', PRIORITIES.find(p => p.key === item.priority)?.color)}>
                    {PRIORITIES.find(p => p.key === item.priority)?.label}
                  </Text>
                </View>
              )}
            </View>
          )}

          {item.quantity && item.quantity > 1 && (
            <View className="mt-2 flex-row items-center space-x-2">
              <View className="bg-orange-100 px-2 py-1 rounded-lg flex-row items-center">
                <Ionicons name="list-outline" size={12} color="#f97316" />
                <Text className="text-xs font-medium text-orange-700 mr-1">{t('shopping.quantity', { qty: item.quantity })}</Text>
              </View>
            </View>
          )}

          {item.notes && item.notes.trim() && (
            <View className="mt-2 flex-row items-center space-x-2">
              <View className="bg-indigo-100 px-2 py-1 rounded-lg flex-row items-center">
                <Ionicons name="chatbubble-outline" size={12} color="#6366f1" />
                <Text className="text-sm text-indigo-700 mr-1 italic">{item.notes}</Text>
              </View>
            </View>
          )}

          {item.purchased && (
            <View className="flex-row items-center mt-2">
              <Ionicons name="checkmark-circle" size={16} color="#10b981" />
              <Text className="text-sm text-green-600 mr-2">{t('shopping.purchasedBy', { name: getUserName(item.purchasedBy!), price: item.purchasePrice ? ` • ${t('shopping.shekel')}${item.purchasePrice}` : '' })}</Text>
            </View>
          )}
        </Pressable>

        <Pressable
          onPress={() => {
            warning(); // Haptic feedback for remove item
            handleRemoveItem(item.id);
          }}
          className="p-2"
          disabled={isRemovingItem === item.id || isPurchasingItem === item.id}
        >
          {isRemovingItem === item.id ? (
            <Ionicons name="hourglass" size={24} color="#6b7280" />
          ) : (
            <Ionicons
              name={item.purchased ? 'information-circle-outline' : 'close-circle-outline'}
              size={24}
              color={item.purchased ? '#3b82f6' : '#ef4444'}
            />
          )}
        </Pressable>
      </View>
    </ThemedCard>
  );

  if (!currentUser || !currentApartment) {
    return (
      <View className="flex-1 justify-center items-center" style={themed.surfaceBg}>
        <ThemedText style={themed.textSecondary}>{t('common.loading')}</ThemedText>
        <Pressable
          onPress={() => navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] })}
          className="mt-4 py-2 px-4 rounded-xl"
          style={{ backgroundColor: '#3b82f6' }}
        >
          <Text className="text-white font-medium">{t('welcome.joinApt')}</Text>
        </Pressable>
      </View>
    );
  }

  // hooks להזזת המודאלים
  const addLift = useKeyboardLift();
  const purchaseLift = useKeyboardLift();

  return (
    <Screen withPadding={false} keyboardVerticalOffset={0} scroll={false}>
      <ThemedCard className="px-6 pt-16 pb-6 shadow-sm">
        <ThemedText className="text-2xl font-bold text-center mb-4">{t('shopping.title')}</ThemedText>
        <ThemedText style={themed.textSecondary} className="text-center">
          {t('shopping.itemsToBuy', { count: pendingItems.length })}
          {selectedPriorityFilter !== 'all' && (
            <Text className="text-blue-600 font-medium">{' '}• {PRIORITIES.find(p => p.key === selectedPriorityFilter)?.label}</Text>
          )}
        </ThemedText>
      </ThemedCard>

      {/* Priority Filter */}
      <ThemedCard className="mx-6 mt-6 p-4 rounded-2xl shadow-sm">
        <ThemedText style={themed.textSecondary} className="text-base mb-3 text-center">{t('shopping.priorityFilter')}</ThemedText>
        <View className="flex-row justify-center space-x-2">
          <Pressable
            onPress={() => {
              selection(); // Haptic feedback for filter selection
              setSelectedPriorityFilter('all');
            }}
            className={cn('px-4 py-2 rounded-lg border-2', selectedPriorityFilter === 'all' ? 'bg-blue-500 border-blue-500' : '')}
            style={selectedPriorityFilter !== 'all' ? { backgroundColor: '#f9fafb', ...themed.borderColor } : undefined}
          >
            <ThemedText className={cn('text-sm font-medium', selectedPriorityFilter === 'all' ? 'text-white' : '')} style={selectedPriorityFilter !== 'all' ? themed.textSecondary : undefined}>{t('shopping.all')}</ThemedText>
          </Pressable>

          {PRIORITIES.map(priority => (
            <Pressable
              key={priority.key}
              onPress={() => {
                selection(); // Haptic feedback for filter selection
                setSelectedPriorityFilter(priority.key as any);
              }}
              className={cn(
                'px-4 py-2 rounded-lg border-2 flex-row items-center',
                selectedPriorityFilter === priority.key ? 'bg-blue-500 border-blue-500' : ''
              )}
              style={selectedPriorityFilter !== priority.key ? { backgroundColor: '#f9fafb', ...themed.borderColor } : undefined}
            >
              <Ionicons name={priority.icon as any} size={16} color={selectedPriorityFilter === priority.key ? 'white' : priority.color} />
              <ThemedText className={cn('text-sm font-medium mr-1', selectedPriorityFilter === priority.key ? 'text-white' : '')} style={selectedPriorityFilter !== priority.key ? themed.textSecondary : undefined}>
                {priority.label}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      </ThemedCard>

      {/* Add New Item Button */}
      <View className="mx-6 mt-4">
        <Pressable onPress={() => {
          impactMedium(); // Haptic feedback for add new item
          setShowAddModal(true);
        }} className="bg-blue-500 py-4 px-6 rounded-2xl shadow-sm">
          <View className="flex-row items-center justify-center">
            <Ionicons name="add-circle-outline" size={24} color="white" />
            <Text className="text-white font-semibold text-lg mr-2">{t('shopping.addNewItem')}</Text>
          </View>
        </Pressable>
      </View>

      <ScrollView 
        className="flex-1 px-6 py-6"
        contentContainerStyle={{ alignItems: 'stretch' }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        {/* Pending Items */}
        {pendingItems.length > 0 && (
          <View className="mb-6">
            <ThemedText className="text-lg font-semibold mb-4">
              {t('shopping.toBuy')}
              {selectedPriorityFilter !== 'all' && (
                <Text className="text-blue-600 font-medium text-base">
                  {' '}({t('shopping.priorityLabel')}: {PRIORITIES.find(p => p.key === selectedPriorityFilter)?.label})
                </Text>
              )}
            </ThemedText>
            <FlatList data={pendingItems} renderItem={renderShoppingItem} keyExtractor={item => item.id} scrollEnabled={false} />
          </View>
        )}

        {/* No Items Match Filter */}
        {shoppingItems.length > 0 && pendingItems.length === 0 && selectedPriorityFilter !== 'all' && (
          <ThemedCard className="rounded-2xl p-8 items-center shadow-sm">
            <Ionicons name="filter-outline" size={64} color="#6b7280" />
            <ThemedText className="text-lg font-medium mt-4 mb-2">{t('shopping.noItemsWithPriority')}</ThemedText>
            <ThemedText style={themed.textSecondary} className="text-center">{t('shopping.noItemsWithPriority')}</ThemedText>
            <Pressable onPress={() => {
              selection(); // Haptic feedback for show all filter
              setSelectedPriorityFilter('all');
            }} className="bg-blue-500 py-3 px-6 rounded-xl mt-4">
              <Text className="text-white font-medium text-center">{t('shopping.showAll')}</Text>
            </Pressable>
          </ThemedCard>
        )}

        {/* Empty State */}
        {shoppingItems.length === 0 && (
          <ThemedCard className="rounded-2xl p-8 items-center shadow-sm">
            <Ionicons name="basket-outline" size={64} color="#6b7280" />
            <ThemedText className="text-lg font-medium mt-4 mb-2">{t('shopping.emptyTitle')}</ThemedText>
            <ThemedText style={themed.textSecondary} className="text-center">{t('shopping.emptySubtitle')}</ThemedText>
          </ThemedCard>
        )}

        {/* Purchased Items */}
        {purchasedItems.length > 0 && (
          <View className="mb-6">
            <ThemedText className="text-lg font-semibold mb-4">{t('shopping.purchased')}</ThemedText>
            <FlatList
              data={purchasedItems.slice().reverse().slice(0, 10)}
              renderItem={renderShoppingItem}
              keyExtractor={item => item.id}
              scrollEnabled={false}
            />
          </View>
        )}
      </ScrollView>

      {/* Add Item Modal */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddModal(false)}
      >
        {/* רקע – לחיצה סוגרת רק מקלדת */}
        <Pressable onPress={Keyboard.dismiss} className="flex-1 bg-black/50 justify-center items-center px-6">
          {/* כרטיס – נע על ציר Y לפי גובה המקלדת */}
          <Animated.View
            onLayout={addLift.onLayoutCard}
            style={[{ width: '100%', maxWidth: 400 }, addLift.animatedStyle]}
          >
            <ThemedCard className="rounded-2xl p-6">
              <Pressable onPress={Keyboard.dismiss}>
                <ThemedText className="text-xl font-semibold mb-6 text-center">{t('shopping.addModal.title')}</ThemedText>
              </Pressable>

              {/* Item Name */}
              <View className="mb-6">
                <ThemedText className="text-base mb-2" style={themed.textSecondary}>{t('shopping.addModal.itemName')}</ThemedText>
                <TextInput
                  value={newItemName}
                  onChangeText={setNewItemName}
                  placeholder={t('shopping.addModal.itemNamePh')}
                  className="border rounded-xl px-4 py-3 text-base"
                  style={themed.borderColor}
                  textAlign="right"
                  autoFocus
                  returnKeyType="next"
                  onSubmitEditing={Keyboard.dismiss}
                  blurOnSubmit={false}
                />
              </View>

              {/* Quantity */}
              <View className="mb-6">
                <ThemedText className="text-base mb-2" style={themed.textSecondary}>{t('shopping.addModal.quantity')}</ThemedText>
                <TextInput
                  value={newItemQuantity}
                  onChangeText={setNewItemQuantity}
                  placeholder="1"
                  className="border border-gray-300 rounded-xl px-4 py-3 text-base"
                  textAlign="center"
                  keyboardType="numeric"
                  returnKeyType="done"
                  onSubmitEditing={Keyboard.dismiss}
                  blurOnSubmit
                />
              </View>

              {/* Priority */}
              <Pressable onPress={Keyboard.dismiss} className="mb-6">
                <ThemedText className="text-base mb-3" style={themed.textSecondary}>{t('shopping.addModal.priority')}</ThemedText>
                <View className="flex-row space-x-2">
                  {PRIORITIES.map((priority) => (
                    <Pressable
                      key={priority.key}
                      onPress={() => {
                        Keyboard.dismiss();
                        setNewItemPriority(priority.key as any);
                      }}
                      className={cn(
                        'flex-1 py-3 px-2 rounded-xl border-2 items-center',
                        newItemPriority === priority.key ? 'bg-blue-100 border-blue-500' : 'bg-gray-50 border-gray-200'
                      )}
                    >
                      <Ionicons
                        name={priority.icon as any}
                        size={20}
                        color={newItemPriority === priority.key ? priority.color : '#6b7280'}
                      />
                      <ThemedText
                        className={cn(
                          'text-sm font-medium mt-1 text-center',
                          newItemPriority === priority.key ? priority.color : ''
                        )}
                        style={newItemPriority !== priority.key ? themed.textSecondary : undefined}
                      >
                        {priority.label}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              </Pressable>

              {/* Notes */}
              <View className="mb-6">
                <Text className="text-gray-700 text-base mb-2">{t('shopping.addModal.notes')}</Text>
                <TextInput
                  value={newItemNotes}
                  onChangeText={setNewItemNotes}
                  placeholder={t('shopping.addModal.notesPh')}
                  className="border border-gray-300 rounded-xl px-4 py-3 text-base"
                  textAlign="right"
                  multiline
                  numberOfLines={3}
                  returnKeyType="done"
                  blurOnSubmit
                  onSubmitEditing={Keyboard.dismiss}
                />
              </View>

              {/* Actions */}
              <View className="flex-row space-x-3">
                <Pressable
                  onPress={() => {
                    impactLight(); // Haptic feedback for cancel action
                    Keyboard.dismiss();
                    setShowAddModal(false);
                    setNewItemName('');
                    setNewItemQuantity('1');
                    setNewItemPriority('normal');
                    setNewItemNotes('');
                  }}
                  className="flex-1 bg-gray-100 py-3 px-4 rounded-xl mr-2"
                  disabled={isAddingItem}
                >
                  <Text className="text-gray-700 font-medium text-center">{t('shopping.addModal.cancel')}</Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    Keyboard.dismiss();
                    handleAddItem();
                  }}
                  disabled={!newItemName.trim() || isAddingItem}
                  className={cn('flex-1 py-3 px-4 rounded-xl', !newItemName.trim() || isAddingItem ? 'bg-gray-400' : 'bg-blue-500')}
                >
                  <View className="flex-row items-center justify-center">
                    {isAddingItem ? (<Ionicons name="hourglass" size={20} color="white" />) : (<Ionicons name="add" size={20} color="white" />)}
                    <Text className="text-white font-medium text-center mr-2">
                      {isAddingItem ? t('shopping.addModal.adding') : t('shopping.addModal.add')}
                    </Text>
                  </View>
                </Pressable>
              </View>
            </ThemedCard>
          </Animated.View>
        </Pressable>
      </Modal>

      {/* Purchase Confirmation Modal */}
      {showPurchaseModal && (
        <View className="absolute inset-0">
          <Pressable onPress={Keyboard.dismiss} className="flex-1 bg-black/50 justify-center items-center px-6">
            <Animated.View onLayout={purchaseLift.onLayoutCard} style={[{ width: '100%', maxWidth: 400 }, purchaseLift.animatedStyle]}>
              <View className="bg-white rounded-2xl p-6">
                <Pressable onPress={Keyboard.dismiss}>
                  <Text className="text-xl font-semibold text-gray-900 mb-4 text-center">{t('shopping.purchaseModal.title')}</Text>
                </Pressable>

                {/* Price */}
                <View className="mb-6">
                  <Text className="text-gray-700 text-base mb-2">
                    {t('shopping.purchaseModal.price')} <Text className="text-red-500">*</Text>
                  </Text>
                  <View className="flex-row items-center">
                    <TextInput
                      value={purchasePrice}
                      onChangeText={setPurchasePrice}
                      placeholder={t('shopping.purchaseModal.pricePlaceholder')}
                      className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-base"
                      keyboardType="numeric"
                      textAlign="center"
                      returnKeyType="next"
                      onSubmitEditing={Keyboard.dismiss}
                      blurOnSubmit={false}
                    />
                    <Text className="text-gray-700 text-lg mr-3">{t('shopping.shekel')}</Text>
                  </View>
                </View>

                {/* Note */}
                <View className="mb-6">
                  <Text className="text-gray-700 text-base mb-2">{t('shopping.purchaseModal.note')}</Text>
                  <TextInput
                    value={purchaseNote}
                    onChangeText={setPurchaseNote}
                    placeholder={t('shopping.additionalDetailsPlaceholder')}
                    className="border border-gray-300 rounded-xl px-4 py-3 text-base"
                    textAlign="right"
                    multiline
                    numberOfLines={3}
                    returnKeyType="done"
                    blurOnSubmit
                    onSubmitEditing={Keyboard.dismiss}
                  />
                </View>

                {/* Participants */}
                {purchasePrice.trim() && (
                  <View className="mb-4">
                    <Text className="text-gray-700 text-base mb-3 text-center">{t('shopping.purchaseModal.whoParticipates')}</Text>
                    <View className={cn('space-y-2', (currentApartment?.members?.length || 0) > 5 && 'max-h-40')}>
                      <ScrollView showsVerticalScrollIndicator={false}>
                        {currentApartment?.members.map(member => (
                          <Pressable
                            key={member.id}
                            onPress={() => {
                              Keyboard.dismiss();
                              setSelectedParticipants(prev =>
                                prev.includes(member.id) ? prev.filter(id => id !== member.id) : [...prev, member.id]
                              );
                            }}
                            className={cn(
                              'flex-row items-center justify-between p-3 rounded-xl border mb-2',
                              selectedParticipants.includes(member.id) ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'
                            )}
                          >
                            <Text className={cn('font-medium', selectedParticipants.includes(member.id) ? 'text-blue-700' : 'text-gray-700')}>
                              {member.name} {member.id === currentUser?.id && t('shopping.youLabel')}
                            </Text>
                            <View
                              className={cn(
                                'w-5 h-5 rounded-full border-2 items-center justify-center',
                                selectedParticipants.includes(member.id) ? 'bg-blue-500 border-blue-500' : 'border-gray-300'
                              )}
                            >
                              {selectedParticipants.includes(member.id) && <Ionicons name="checkmark" size={12} color="white" />}
                            </View>
                          </Pressable>
                        ))}
                      </ScrollView>
                    </View>

                    <Text className="text-xs text-gray-500 text-center mt-2">{t('shopping.purchaseModal.splitNote')}</Text>
                  </View>
                )}

                <Text className="text-sm text-gray-500 text-center mb-4">{t('shopping.purchaseModal.budgetHintWithPrice')}</Text>

                {/* Footer buttons */}
                <View className="flex-row space-x-3">
                  <Pressable
                    onPress={() => {
                      Keyboard.dismiss();
                      setShowPurchaseModal(false);
                      setSelectedItemId(null);
                      setPurchasePrice('');
                      setSelectedParticipants([]);
                      setPurchaseNote('');
                      setPurchaseDate(new Date());
                    }}
                    className="flex-1 bg-gray-100 py-3 px-4 rounded-xl mr-2"
                  >
                    <Text className="text-gray-700 font-medium text-center">{t('shopping.purchaseModal.cancel')}</Text>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      Keyboard.dismiss();
                      handlePurchaseConfirm();
                    }}
                    disabled={isPurchasingItem === selectedItemId}
                    className="flex-1 bg-green-500 py-3 px-4 rounded-xl"
                  >
                    {isPurchasingItem === selectedItemId ? (
                      <View className="flex-row items-center justify-center">
                        <Ionicons name="hourglass" size={20} color="white" />
                        <Text className="text-white font-medium text-center mr-2">{t('shopping.purchaseModal.adding')}</Text>
                      </View>
                    ) : (
                      <Text className="text-white font-medium text-center">{t('shopping.purchaseModal.confirm')}</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            </Animated.View>
          </Pressable>
        </View>
      )}

      {/* Item Details Modal */}
      {showItemDetailsModal && selectedItemId && (
        <View className="absolute inset-0 bg-black/50 justify-center items-center px-6">
          <View className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <Text className="text-xl font-semibold text-gray-900 mb-6 text-center">{t('shopping.detailsModal.title')}</Text>

            {(() => {
              const item = shoppingItems.find(i => i.id === selectedItemId);
              if (!item) return null;

              return (
                <View className="space-y-5">
                  <View className="bg-gray-50 p-4 rounded-xl">
                    <Text className="text-gray-600 text-sm mb-2 text-center">{t('shopping.detailsModal.itemName')}</Text>
                    <Text className="text-gray-900 font-semibold text-lg text-center">{item?.name || ''}</Text>
                  </View>

                  <View className="bg-blue-50 p-4 rounded-xl">
                    <View className="flex-row items-center justify-center mb-2">
                      <Ionicons name="person-add-outline" size={16} color="#3b82f6" />
                      <Text className="text-blue-700 text-sm font-medium mr-2">{t('shopping.detailsModal.addedBy')}</Text>
                    </View>
                    <Text className="text-blue-900 font-medium text-center">{getUserName(item?.addedBy || '')}</Text>
                    <Text className="text-blue-600 text-sm text-center mt-1">{formatDate(item?.addedAt || new Date())}</Text>
                  </View>

                  {item?.priority && (
                    <View className="bg-purple-50 p-4 rounded-xl">
                      <View className="flex-row items-center justify-center mb-2">
                        <Ionicons
                          name={PRIORITIES.find(p => p.key === item.priority)?.icon as any}
                          size={16}
                          color={PRIORITIES.find(p => p.key === item.priority)?.color}
                        />
                        <Text className="text-purple-700 text-sm font-medium mr-2">{t('shopping.detailsModal.priority')}</Text>
                      </View>
                      <Text className="text-purple-900 font-medium text-center">
                        {PRIORITIES.find(p => p.key === item.priority)?.label}
                      </Text>
                    </View>
                  )}

                  {item?.quantity && item.quantity > 1 && (
                    <View className="bg-orange-50 p-4 rounded-xl">
                      <View className="flex-row items-center justify-center mb-2">
                        <Ionicons name="list-outline" size={16} color="#f97316" />
                        <Text className="text-orange-700 text-sm font-medium mr-2">{t('shopping.detailsModal.quantity')}</Text>
                      </View>
                      <Text className="text-orange-900 font-bold text-xl text-center">{item.quantity}</Text>
                    </View>
                  )}

                  {item?.notes && item.notes.trim() && (
                    <View className="bg-indigo-50 p-4 rounded-xl">
                      <View className="flex-row items-center justify-center mb-2">
                        <Ionicons name="chatbubble-outline" size={16} color="#6366f1" />
                        <Text className="text-indigo-700 text-sm font-medium mr-2">{t('shopping.detailsModal.notes')}</Text>
                      </View>
                      <Text className="text-indigo-900 text-center">{item.notes}</Text>
                    </View>
                  )}

                  {item?.purchased && (
                    <>
                      <View className="bg-green-50 p-4 rounded-xl">
                        <View className="flex-row items-center justify-center mb-2">
                          <Ionicons name="checkmark-circle-outline" size={16} color="#10b981" />
                          <Text className="text-green-700 text-sm font-medium mr-2">{t('shopping.purchasedByLabel')}</Text>
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
                            <Text className="text-yellow-700 text-sm font-medium mr-2">{t('shopping.priceLabel')}</Text>
                          </View>
                          <Text className="text-yellow-900 font-bold text-xl text-center">₪{item.purchasePrice}</Text>
                        </View>
                      )}
                    </>
                  )}

                  <View className="flex-row space-x-3 mt-6">
                    <Pressable
                      onPress={() => {
                        impactLight(); // Haptic feedback for close modal
                        setShowItemDetailsModal(false);
                        setSelectedItemId(null);
                      }}
                      className="flex-1 bg-gray-100 py-3 px-4 rounded-xl mr-2"
                    >
                      <Text className="text-gray-700 font-medium text-center">{t('shopping.detailsModal.close')}</Text>
                    </Pressable>

                    <Pressable
                      onPress={() => selectedItemId && handleRepurchase(selectedItemId)}
                      disabled={isRepurchasingItem === selectedItemId}
                      className="flex-1 bg-blue-500 py-3 px-4 rounded-xl"
                    >
                      {isRepurchasingItem === selectedItemId ? (
                        <View className="flex-row items-center justify-center">
                          <Ionicons name="hourglass" size={20} color="white" />
                          <Text className="text-white font-medium text-center mr-2">{t('shopping.detailsModal.adding')}</Text>
                        </View>
                      ) : (
                        <Text className="text-white font-medium text-center">{t('shopping.detailsModal.repurchase')}</Text>
                      )}
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
