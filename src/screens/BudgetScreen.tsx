import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  FlatList,
  Modal,
  TextInput,
  Alert,
  TouchableWithoutFeedback,
  Keyboard,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useStore } from '../state/store';
import { cn } from '../utils/cn';
import ExpenseRow from '../components/ExpenseRow';
import ExpenseEditModal from '../components/ExpenseEditModal';
import { Expense } from '../types';
import { AsyncButton } from '../components/AsyncButton';
import { NumericInput } from '../components/NumericInput';
import { getUserDisplayInfo, getDisplayName } from '../utils/userDisplay';
import { useTranslation } from 'react-i18next';
import { ThemedCard } from '../theme/components/ThemedCard';
import { ThemedText } from '../theme/components/ThemedText';
import { impactMedium, impactLight, warning, success } from '../utils/haptics';
import { ThemedView } from '../theme/components/ThemedView';
import { useThemedStyles } from '../theme/useThemedStyles';

type RootStackParamList = {
  AddExpense: undefined;
  GroupDebts: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

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

export default function BudgetScreen() {
  const { t } = useTranslation();
  const appLanguage = useStore(s => s.appLanguage);
  const navigation = useNavigation<NavigationProp>();
  const themed = useThemedStyles(tk => ({
    surfaceBg: { backgroundColor: tk.colors.surface },
    backgroundBg: { backgroundColor: tk.colors.background },
    textSecondary: { color: tk.colors.text.secondary },
    borderColor: { borderColor: tk.colors.border.primary },
  }));
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  
  // Add Expense Modal State
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDescription, setExpenseDescription] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  
  // Keyboard lift hook for Add Expense modal
  const addExpenseLift = useKeyboardLift();
  
  const { 
    expenses, 
    debtSettlements, 
    currentUser, 
    currentApartment, 
    getBalances, 
    getMonthlyExpenses,
    getTotalApartmentExpenses,
    loadDebtSettlements,
    deleteExpense,
    addExpense
  } = useStore();

  // Load debt settlements on component mount
  useEffect(() => {
    const loadData = async () => {
      try {
        await loadDebtSettlements();
      } catch (error) {
        console.error('Error loading debt settlements in Budget screen:', error);
      }
    };
    loadData();
  }, [loadDebtSettlements]);

  const balances = useMemo(() => getBalances(), [expenses, debtSettlements]);
  const myBalance = balances.find(b => b.userId === currentUser?.id);

  const monthlyData = useMemo(() => {
    return getMonthlyExpenses(selectedYear, selectedMonth);
  }, [expenses, selectedYear, selectedMonth]);

  const totalApartmentExpenses = useMemo(() => {
    return getTotalApartmentExpenses(selectedYear, selectedMonth);
  }, [expenses, selectedYear, selectedMonth]);

  const formatCurrency = (amount: number) => {
    // Show exact amount with up to 2 decimal places, no rounding
    if (amount === Math.floor(amount)) {
      return `₪${amount}`;
    }
    return `₪${amount.toFixed(2)}`;
  };

  const formatDate = (date: Date | string) => {
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      if (isNaN(dateObj.getTime())) {
        return t('common.invalidDate');
      }
      const locale = appLanguage === 'he' ? 'he-IL' : 'en-US';
      return new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'short'
      }).format(dateObj);
    } catch (error) {
      return t('common.invalidDate');
    }
  };

  const getUserName = (userId: string) => {
    if (userId === currentUser?.id) return t('common.you');
    const member = currentApartment?.members.find(m => m.id === userId);
    return getDisplayName(member) || t('common.unknown');
  };

  const getActualUserName = (userId: string) => {
    // Always return the actual name, not "אתה"
    const member = currentApartment?.members.find(m => m.id === userId);
    return getDisplayName(member) || 
           (userId === currentUser?.id ? getDisplayName(currentUser) : t('common.unknown'));
  };

  // Helper function to get month name
  const getMonthName = (month: number) => {
    return t(`months.${month}`);
  };

  // Helper function to calculate net personal balance summary
  const getPersonalBalanceSummary = () => {
    if (!myBalance) return { status: 'balanced', amount: 0, message: t('budget.noOpenDebts') };
    
    if (Math.abs(myBalance.netBalance) < 0.01) {
      return { status: 'balanced', amount: 0, message: t('budget.noOpenDebts') };
    }
    
    if (myBalance.netBalance > 0) {
      return { 
        status: 'owed', 
        amount: myBalance.netBalance, 
        message: t('budget.moneyYouAreOwed')
      };
    } else {
      return { 
        status: 'owes', 
        amount: Math.abs(myBalance.netBalance), 
        message: t('budget.moneyYouOwe')
      };
    }
  };

  const personalSummary = getPersonalBalanceSummary();

  const handleDeleteExpense = useCallback(async (expenseId: string) => {
    try {
      await deleteExpense(expenseId);
    } catch (error) {
      console.error('Error deleting expense:', error);
      // Show error to user if needed
    }
  }, [deleteExpense]);

  const handleEditExpense = useCallback((expenseId: string) => {
    const expense = expenses.find(e => e.id === expenseId);
    if (expense) {
      setSelectedExpense(expense);
      setEditModalVisible(true);
    }
  }, [expenses]);

  const handleCloseEditModal = useCallback(() => {
    setEditModalVisible(false);
    setSelectedExpense(null);
  }, []);

  const handleEditSuccess = useCallback(() => {
    // Refresh expenses or any other data if needed
    // The store will automatically update
  }, []);

  // Initialize participants when modal opens
  useEffect(() => {
    if (showAddExpenseModal && currentApartment) {
      setSelectedParticipants(currentApartment.members.map(m => m.id));
    }
  }, [showAddExpenseModal, currentApartment]);

  // Handle Add Expense
  const handleAddExpense = async () => {
    if (!expenseTitle.trim()) {
      Alert.alert(t('common.error'), t('expenseEdit.alerts.enterTitle'));
      return;
    }

    const numAmount = parseFloat(expenseAmount);
    if (!numAmount || numAmount <= 0) {
      Alert.alert(t('common.error'), t('expenseEdit.alerts.enterValidAmount'));
      return;
    }

    if (selectedParticipants.length === 0) {
      Alert.alert(t('common.error'), t('expenseEdit.alerts.selectParticipants'));
      return;
    }

    if (!currentUser) {
      Alert.alert(t('common.error'), t('expenseEdit.alerts.userNotLoggedIn'));
      return;
    }

    setIsAddingExpense(true);
    try {
      await addExpense({
        title: expenseTitle.trim(),
        amount: numAmount,
        paidBy: currentUser.id,
        participants: selectedParticipants,
        category: 'other',
        description: expenseDescription.trim() || undefined,
      });

      // Reset form and close modal
      setExpenseTitle('');
      setExpenseAmount('');
      setExpenseDescription('');
      setSelectedParticipants([]);
      setShowAddExpenseModal(false);
    } catch (error) {
      console.error('Error adding expense:', error);
      Alert.alert(t('common.error'), t('expenseEdit.alerts.updateFailed'));
    } finally {
      setIsAddingExpense(false);
    }
  };

  const toggleParticipant = (userId: string) => {
    setSelectedParticipants(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const renderExpenseItem = ({ item: expense }: { item: any }) => {
    return (
      <ExpenseRow
        item={expense}
        onConfirmDelete={handleDeleteExpense}
        onEdit={handleEditExpense}
        formatCurrency={formatCurrency}
        formatDate={formatDate}
        getUserName={getUserName}
        getActualUserName={getActualUserName}
        currentUserId={currentUser?.id}
      />
    );
  };

  if (!currentUser || !currentApartment) {
    return (
      <ThemedView className="flex-1 justify-center items-center">
        <ThemedText style={themed.textSecondary}>{t('common.loading')}</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView className="flex-1" style={themed.backgroundBg}>
      <ThemedCard className="px-6 pt-16 pb-6 shadow-sm">
        <View className="flex-row items-center justify-center mb-4 relative">
          <ThemedText className="text-2xl font-bold text-center">{t('budget.title')}</ThemedText>
          <Pressable
            onPress={() => {
              impactMedium(); // Haptic feedback for add expense
              setShowAddExpenseModal(true);
            }}
            className="bg-blue-500 w-10 h-10 rounded-full items-center justify-center absolute right-0"
          >
            <Ionicons name="add" size={24} color="white" />
          </Pressable>
        </View>
        
        {/* Month Selector */}
        <View className="flex-row items-center justify-between p-3 rounded-xl mb-4" style={themed.surfaceBg}>
          <Pressable
            onPress={() => {
              if (selectedMonth === 0) {
                setSelectedMonth(11);
                setSelectedYear(selectedYear - 1);
              } else {
                setSelectedMonth(selectedMonth - 1);
              }
            }}
            className="w-8 h-8 rounded-full items-center justify-center"
            style={{ backgroundColor: '#ffffff' }}
          >
            <Ionicons 
              name="chevron-back" 
              size={20} 
              color="#6b7280" 
            />
          </Pressable>
          
          <ThemedText className="text-lg font-semibold">
            {getMonthName(selectedMonth)} {selectedYear}
          </ThemedText>
          
          <Pressable
            onPress={() => {
              const now = new Date();
              const currentMonth = now.getMonth();
              const currentYear = now.getFullYear();
              
              // Don't allow going to future months
              if (selectedYear > currentYear || (selectedYear === currentYear && selectedMonth >= currentMonth)) {
                return;
              }
              
              if (selectedMonth === 11) {
                setSelectedMonth(0);
                setSelectedYear(selectedYear + 1);
              } else {
                setSelectedMonth(selectedMonth + 1);
              }
            }}
            className="w-8 h-8 rounded-full items-center justify-center"
            style={(() => {
              const now = new Date();
              const currentMonth = now.getMonth();
              const currentYear = now.getFullYear();
              const canGoForward = !(selectedYear > currentYear || (selectedYear === currentYear && selectedMonth >= currentMonth));
              return canGoForward ? { backgroundColor: '#ffffff' } : { backgroundColor: '#e5e7eb' };
            })()}
            disabled={(() => {
              const now = new Date();
              const currentMonth = now.getMonth();
              const currentYear = now.getFullYear();
              return selectedYear > currentYear || (selectedYear === currentYear && selectedMonth >= currentMonth);
            })()}
          >
            <Ionicons 
              name="chevron-forward" 
              size={20} 
              color={(() => {
                const now = new Date();
                const currentMonth = now.getMonth();
                const currentYear = now.getFullYear();
                const canGoForward = !(selectedYear > currentYear || (selectedYear === currentYear && selectedMonth >= currentMonth));
                return canGoForward ? "#6b7280" : "#d1d5db";
              })()} 
            />
          </Pressable>
        </View>
        
        {/* Summary */}
        <View className="flex-row justify-between">
          <View>
            <ThemedText className="text-sm" style={themed.textSecondary}>{t('budget.totalApartment')}</ThemedText>
            <ThemedText className="text-xl font-bold">
              {formatCurrency(totalApartmentExpenses)}
            </ThemedText>
          </View>
          <View className="items-end">
            <ThemedText className="text-sm" style={themed.textSecondary}>{t('budget.yourShare')}</ThemedText>
            <Text className="text-xl font-bold text-blue-600">
              {formatCurrency(monthlyData.personalTotal)}
            </Text>
          </View>
        </View>
      </ThemedCard>

      <ScrollView className="flex-1 px-6 py-6" contentContainerStyle={{ alignItems: 'stretch' }}>
        {/* Personal Balance Summary */}
        <ThemedCard className="rounded-2xl p-6 mb-6 shadow-sm">
          <View className="flex-row items-center justify-between mb-4">
            <ThemedText className="text-lg font-semibold">{t('budget.myStatus')}</ThemedText>
            
            <Pressable
              onPress={() => navigation.navigate('GroupDebts')}
              className="bg-blue-100 py-2 px-4 rounded-lg flex-row items-center"
            >
              <Ionicons name="people-outline" size={16} color="#3b82f6" />
              <Text className="text-blue-700 text-sm font-medium ml-2">
                {t('budget.showAllDebtsButton')}
              </Text>
            </Pressable>
          </View>
          
          <View className="items-center">
            {personalSummary.status === 'balanced' ? (
              <>
                <Ionicons name="checkmark-circle" size={48} color="#10b981" />
                <Text className="text-xl font-bold text-green-600 mt-2 mb-1">
                  {t('budget.allClearedMessage')}
                </Text>
                <ThemedText className="text-center" style={themed.textSecondary}>
                  {personalSummary.message}
                </ThemedText>
              </>
            ) : (
              <>
                <Text className="text-3xl font-bold mb-2" style={{
                  color: personalSummary.status === 'owed' ? '#10b981' : '#ef4444'
                }}>
                  {formatCurrency(personalSummary.amount)}
                </Text>
                
                <ThemedText className="text-center text-lg" style={themed.textSecondary}>
                  {personalSummary.message}
                </ThemedText>
                
                {personalSummary.status === 'owed' && (
                  <ThemedText className="text-sm mt-2 text-center" style={themed.textSecondary}>
                    {t('budget.moneyYouAreOwedMessage')}
                  </ThemedText>
                )}
                {personalSummary.status === 'owes' && (
                  <ThemedText className="text-sm mt-2 text-center" style={themed.textSecondary}>
                    {t('budget.moneyYouOweMessage')}
                  </ThemedText>
                )}
              </>
            )}
          </View>
        </ThemedCard>

        {/* Monthly Expenses */}
        <View className="mb-6">
          <ThemedText className="text-lg font-semibold mb-4">{t('budget.monthlyExpenses', { month: getMonthName(selectedMonth) })}</ThemedText>
          
          {monthlyData.expenses.length === 0 ? (
            <ThemedCard className="rounded-2xl p-8 items-center shadow-sm">
              <Ionicons name="calendar-outline" size={48} color="#6b7280" />
              <ThemedText className="text-center mt-4 mb-4" style={themed.textSecondary}>{t('budget.noExpensesInMonth', { month: getMonthName(selectedMonth) })}</ThemedText>
              <Pressable
                onPress={() => {
                  impactMedium(); // Haptic feedback for add expense
                  setShowAddExpenseModal(true);
                }}
                className="bg-blue-500 py-2 px-6 rounded-xl"
              >
                <Text className="text-white font-medium">{t('budget.addExpense')}</Text>
              </Pressable>
            </ThemedCard>
          ) : (
            <FlatList
              data={monthlyData.expenses}
              renderItem={renderExpenseItem}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
            />
          )}
        </View>
      </ScrollView>
      
      {/* Edit Expense Modal */}
      <ExpenseEditModal
        visible={editModalVisible}
        expense={selectedExpense}
        onClose={handleCloseEditModal}
        onSuccess={handleEditSuccess}
      />

      {/* Add Expense Modal */}
      <Modal
        visible={showAddExpenseModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddExpenseModal(false)}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View className="flex-1 bg-black/50 justify-center items-center px-6">
            <Animated.View
              onLayout={addExpenseLift.onLayoutCard}
              style={[{ width: '100%', maxWidth: 400 }, addExpenseLift.animatedStyle]}
            >
              <ThemedCard className="rounded-2xl p-6">
              <ThemedText className="text-xl font-semibold mb-6 text-center">
                {t('budget.addExpenseModal.title')}
              </ThemedText>

              {/* Expense Title */}
              <View className="mb-6">
                <ThemedText className="text-base mb-2" style={themed.textSecondary}>{t('budget.addExpenseModal.expenseName')}</ThemedText>
                <TextInput
                  value={expenseTitle}
                  onChangeText={setExpenseTitle}
                  placeholder={t('budget.expenseNamePlaceholder')}
                  className="border rounded-xl px-4 py-3 text-base"
                  style={themed.borderColor}
                  textAlign="right"
                  autoFocus
                  returnKeyType="next"
                  onSubmitEditing={Keyboard.dismiss}
                  blurOnSubmit={false}
                />
              </View>

              {/* Amount */}
              <View className="mb-6">
                <ThemedText className="text-base mb-2" style={themed.textSecondary}>{t('budget.addExpenseModal.amount')}</ThemedText>
                <NumericInput
                  value={expenseAmount}
                  onChangeText={setExpenseAmount}
                  placeholder="0"
                  className="border rounded-xl px-4 py-3 text-base"
                  style={themed.borderColor}
                  textAlign="right"
                  returnKeyType="next"
                  onSubmitEditing={Keyboard.dismiss}
                  blurOnSubmit={false}
                />
              </View>

              {/* Participants */}
              <View className="mb-6">
                <ThemedText className="text-base mb-2" style={themed.textSecondary}>{t('budget.addExpenseModal.participants')}</ThemedText>
                <View className="flex-row flex-wrap">
                  {currentApartment?.members.map((member) => (
                    <Pressable
                      key={member.id}
                      onPress={() => toggleParticipant(member.id)}
                      className={cn(
                        "mr-2 mb-2 px-4 py-2 rounded-xl border-2",
                        selectedParticipants.includes(member.id)
                          ? "bg-blue-500 border-blue-500"
                          : ""
                      )}
                      style={!selectedParticipants.includes(member.id) ? { backgroundColor: '#ffffff', ...themed.borderColor } : undefined}
                    >
                      <ThemedText className={cn(
                        "text-sm font-medium",
                        selectedParticipants.includes(member.id)
                          ? "text-white"
                          : ""
                      )} style={!selectedParticipants.includes(member.id) ? themed.textSecondary : undefined}>
                        {getDisplayName(member)}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Description */}
              <View className="mb-6">
                <ThemedText className="text-base mb-2" style={themed.textSecondary}>{t('budget.addExpenseModal.description')}</ThemedText>
                <TextInput
                  value={expenseDescription}
                  onChangeText={setExpenseDescription}
                  placeholder={t('budget.additionalDetailsPlaceholder')}
                  className="border rounded-xl px-4 py-3 text-base"
                  style={themed.borderColor}
                  textAlign="right"
                  multiline
                  numberOfLines={3}
                  returnKeyType="done"
                  blurOnSubmit={true}
                  onSubmitEditing={() => Keyboard.dismiss()}
                />
              </View>

              {/* Action Buttons */}
              <View className="flex-row gap-3">
                <Pressable
                  onPress={() => {
                    impactLight(); // Haptic feedback for cancel action
                    setShowAddExpenseModal(false);
                  }}
                  className="flex-1 py-3 px-4 rounded-xl"
                  style={themed.surfaceBg}
                >
                  <ThemedText className="font-medium text-center" style={themed.textSecondary}>
                    {t('common.cancel')}
                  </ThemedText>
                </Pressable>
                
                <AsyncButton
                  title={t('budget.addExpenseButton')}
                  onPress={handleAddExpense}
                  loadingText={t('budget.addingExpenseButton')}
                  className="flex-1"
                  disabled={isAddingExpense}
                />
              </View>
              </ThemedCard>
            </Animated.View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </ThemedView>
  );
}