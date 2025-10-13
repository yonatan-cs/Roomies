import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  FlatList,
  Modal,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useStore } from '../state/store';
import { cn } from '../utils/cn';
import ExpenseRow from '../components/ExpenseRow';
import ExpenseEditModal from '../components/ExpenseEditModal';
import { Expense } from '../types';
import AddExpenseModal from '../components/AddExpenseModal';
import { getUserDisplayInfo, getDisplayName } from '../utils/userDisplay';
import { useTranslation } from 'react-i18next';
import { useIsRTL } from '../hooks/useIsRTL';
import { useGenderedText } from '../hooks/useGenderedText';
import { ThemedCard } from '../theme/components/ThemedCard';
import { ThemedText } from '../theme/components/ThemedText';
import { impactMedium, impactLight } from '../utils/haptics';
import { ThemedView } from '../theme/components/ThemedView';
import { useThemedStyles } from '../theme/useThemedStyles';
import { useFormatCurrency } from '../utils/hebrewFormatting';
import ExpenseListAd from '../components/ads/ExpenseListAd';

type RootStackParamList = {
  AddExpense: undefined;
  GroupDebts: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;


export default function BudgetScreen() {
  const { t } = useTranslation();
  const gt = useGenderedText();
  const isRTL = useIsRTL();
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
  
  const { 
    expenses, 
    debtSettlements, 
    currentUser, 
    currentApartment, 
    getBalances, 
    getMonthlyExpenses,
    getTotalApartmentExpenses,
    loadDebtSettlements,
    deleteExpense
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

  const formatCurrency = useFormatCurrency();

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
    if (userId === currentUser?.id) return gt('common.you');
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
        message: gt('budget.moneyYouOwe')
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

  // Insert ads every 3 items (Mock ads for Expo Go - works now!)
  // ADMOB RESTORE: Replace with real AdMob logic before App Store deployment
  const insertAdsIntoExpenses = (expenses: any[]) => {
    const result: any[] = [];
    expenses.forEach((expense, index) => {
      result.push(expense);
      // Insert ad after every 3 items
      if ((index + 1) % 3 === 0 && index < expenses.length - 1) {
        result.push({ 
          id: `ad-${index}`, 
          isAd: true,
          type: 'expense' 
        });
      }
    });
    return result;
  };

  const renderExpenseItem = ({ item: expense }: { item: any }) => {
    // Check if this is an ad item
    if (expense.isAd) {
      return <ExpenseListAd key={expense.id} />;
    }

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
      <ThemedCard className="px-6 pt-20 pb-6 shadow-sm">
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
        <View 
          className="justify-between"
          style={{ 
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'flex-start'
          }}
        >
          <View>
            <Text className="text-sm mb-2" style={{ color: themed.textSecondary.color }}>{t('budget.totalApartment')}</Text>
            <ThemedText className="text-xl font-bold">
              {formatCurrency(totalApartmentExpenses)}
            </ThemedText>
          </View>
          <View 
            style={{ 
              alignItems: isRTL ? 'flex-start' : 'flex-end'
            }}
          >
            <Text className="text-sm mb-2" style={{ color: themed.textSecondary.color }}>{t('budget.yourShare')}</Text>
            <Text className="text-xl font-bold text-blue-600">
              {formatCurrency(monthlyData.personalTotal)}
            </Text>
          </View>
        </View>
      </ThemedCard>

      <ScrollView className="flex-1 px-6 py-6" contentContainerStyle={{ alignItems: 'stretch' }}>
        {/* Personal Balance Summary */}
        <ThemedCard className="rounded-2xl p-6 mb-6 shadow-sm">
          <View 
            className="items-center mb-4"
            style={{ 
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <ThemedText className="text-lg font-semibold flex-1">{t('budget.myStatus')}</ThemedText>
            
            <Pressable
              onPress={() => navigation.navigate('GroupDebts')}
              className="bg-blue-100 py-2 px-4 rounded-lg"
              style={{ 
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center'
              }}
            >
              <Ionicons name="people-outline" size={16} color="#3b82f6" />
              <Text 
                className="text-blue-700 text-sm font-medium"
                style={{ marginStart: isRTL ? 0 : 8, marginEnd: isRTL ? 8 : 0 }}
              >
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
              data={insertAdsIntoExpenses(monthlyData.expenses)}
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
      <AddExpenseModal
        visible={showAddExpenseModal}
        onClose={() => setShowAddExpenseModal(false)}
        title={t('dashboard.actionAddExpense')}
      />
    </ThemedView>
  );
}