import React, { useMemo, useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  FlatList
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useStore } from '../state/store';
import { cn } from '../utils/cn';
import { ExpenseCategory } from '../types';

type RootStackParamList = {
  AddExpense: undefined;
  GroupDebts: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const CATEGORY_ICONS: Record<ExpenseCategory, keyof typeof Ionicons.glyphMap> = {
  groceries: 'basket-outline',
  utilities: 'flash-outline',
  rent: 'home-outline',
  cleaning: 'brush-outline',
  internet: 'wifi-outline',
  other: 'ellipsis-horizontal-outline'
};

const CATEGORY_NAMES: Record<ExpenseCategory, string> = {
  groceries: 'מכולת',
  utilities: 'שירותים',
  rent: 'שכירות',
  cleaning: 'ניקיון',
  internet: 'אינטרנט',
  other: 'אחר'
};

export default function BudgetScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  
  const { 
    expenses, 
    debtSettlements, 
    currentUser, 
    currentApartment, 
    getBalances, 
    getMonthlyExpenses,
    getTotalApartmentExpenses,
    loadDebtSettlements 
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
        return 'תאריך לא תקין';
      }
      return new Intl.DateTimeFormat('he-IL', {
        day: 'numeric',
        month: 'short'
      }).format(dateObj);
    } catch (error) {
      return 'תאריך לא תקין';
    }
  };

  const getUserName = (userId: string) => {
    if (userId === currentUser?.id) return 'אתה';
    return currentApartment?.members.find(m => m.id === userId)?.name || 'לא ידוע';
  };

  // Helper function to get month name in Hebrew
  const getMonthName = (month: number) => {
    const months = [
      'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
      'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
    ];
    return months[month];
  };

  // Helper function to calculate net personal balance summary
  const getPersonalBalanceSummary = () => {
    if (!myBalance) return { status: 'balanced', amount: 0, message: 'אין חובות פתוחים' };
    
    if (Math.abs(myBalance.netBalance) < 0.01) {
      return { status: 'balanced', amount: 0, message: 'אין חובות פתוחים' };
    }
    
    if (myBalance.netBalance > 0) {
      return { 
        status: 'owed', 
        amount: myBalance.netBalance, 
        message: `חייבים לך ${formatCurrency(myBalance.netBalance)}` 
      };
    } else {
      return { 
        status: 'owes', 
        amount: Math.abs(myBalance.netBalance), 
        message: `אתה חייב ${formatCurrency(Math.abs(myBalance.netBalance))}` 
      };
    }
  };

  const personalSummary = getPersonalBalanceSummary();

  const renderExpenseItem = ({ item: expense }: { item: any }) => {
    const personalShare = expense.amount / expense.participants.length;
    const isParticipant = currentUser && expense.participants.includes(currentUser.id);
    const isPayer = currentUser && expense.paidBy === currentUser.id;
    
    return (
      <View className="bg-white rounded-xl p-4 mb-3 shadow-sm">
        <View className="flex-row items-center justify-between mb-2">
          <View className="flex-row items-center flex-1">
            <View className="bg-gray-100 w-10 h-10 rounded-full items-center justify-center">
              <Ionicons 
                name={CATEGORY_ICONS[expense.category as keyof typeof CATEGORY_ICONS]} 
                size={20} 
                color="#6b7280" 
              />
            </View>
            <View className="mr-3 flex-1">
              <Text className="text-gray-900 font-medium">
                {expense.title}
              </Text>
              <Text className="text-sm text-gray-500">
                {CATEGORY_NAMES[expense.category as keyof typeof CATEGORY_NAMES]} • {formatDate(expense.date)}
              </Text>
              {isParticipant && (
                <Text className={cn(
                  "text-sm font-medium mt-1",
                  isPayer ? "text-green-600" : "text-blue-600"
                )}>
                  {isPayer ? `שילמת: ${formatCurrency(expense.amount)}` : `החלק שלך: ${formatCurrency(personalShare)}`}
                </Text>
              )}
            </View>
          </View>
          
          <View className="items-end">
            <Text className="text-lg font-semibold text-gray-900">
              {formatCurrency(expense.amount)}
            </Text>
            <Text className="text-sm text-gray-500">
              שילם: {getUserName(expense.paidBy)}
            </Text>
          </View>
        </View>
        
        {expense.participants.length > 1 && (
          <View className="flex-row items-center mt-2">
            <Ionicons name="people-outline" size={16} color="#6b7280" />
            <Text className="text-sm text-gray-500 mr-2">
              {expense.participants.length} משתתפים • {formatCurrency(personalShare)} לאחד
            </Text>
          </View>
        )}
      </View>
    );
  };

  if (!currentUser || !currentApartment) {
    return (
      <View className="flex-1 bg-white justify-center items-center">
        <Text className="text-gray-500">טוען...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-white px-6 pt-16 pb-6 shadow-sm">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-2xl font-bold text-gray-900">
            מאזן והוצאות
          </Text>
          <Pressable
            onPress={() => navigation.navigate('AddExpense')}
            className="bg-blue-500 w-10 h-10 rounded-full items-center justify-center"
          >
            <Ionicons name="add" size={24} color="white" />
          </Pressable>
        </View>
        
        {/* Month Selector */}
        <View className="flex-row items-center justify-between bg-gray-50 p-3 rounded-xl mb-4">
          <Pressable
            onPress={() => {
              if (selectedMonth === 0) {
                setSelectedMonth(11);
                setSelectedYear(selectedYear - 1);
              } else {
                setSelectedMonth(selectedMonth - 1);
              }
            }}
            className="w-8 h-8 rounded-full bg-white items-center justify-center"
          >
            <Ionicons name="chevron-back" size={20} color="#6b7280" />
          </Pressable>
          
          <Text className="text-lg font-semibold text-gray-900">
            {getMonthName(selectedMonth)} {selectedYear}
          </Text>
          
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
            className={cn(
              "w-8 h-8 rounded-full items-center justify-center",
              (() => {
                const now = new Date();
                const currentMonth = now.getMonth();
                const currentYear = now.getFullYear();
                const canGoForward = !(selectedYear > currentYear || (selectedYear === currentYear && selectedMonth >= currentMonth));
                return canGoForward ? "bg-white" : "bg-gray-200";
              })()
            )}
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
            <Text className="text-sm text-gray-600">
              סה״כ הוצאות הדירה
            </Text>
            <Text className="text-xl font-bold text-gray-900">
              {formatCurrency(totalApartmentExpenses)}
            </Text>
          </View>
          <View className="items-end">
            <Text className="text-sm text-gray-600">
              החלק שלך החודש
            </Text>
            <Text className="text-xl font-bold text-blue-600">
              {formatCurrency(monthlyData.personalTotal)}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView className="flex-1 px-6 py-6">
        {/* Personal Balance Summary */}
        <View className="bg-white rounded-2xl p-6 mb-6 shadow-sm">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-lg font-semibold text-gray-900">
              המצב שלי
            </Text>
            
            <Pressable
              onPress={() => navigation.navigate('GroupDebts')}
              className="bg-blue-100 py-2 px-4 rounded-lg flex-row items-center"
            >
              <Ionicons name="people-outline" size={16} color="#3b82f6" />
              <Text className="text-blue-700 text-sm font-medium mr-2">
                הצגת כל החובות
              </Text>
            </Pressable>
          </View>
          
          <View className="items-center">
            {personalSummary.status === 'balanced' ? (
              <>
                <Ionicons name="checkmark-circle" size={48} color="#10b981" />
                <Text className="text-xl font-bold text-green-600 mt-2 mb-1">
                  כל החובות מסולקים! 🎉
                </Text>
                <Text className="text-gray-600 text-center">
                  {personalSummary.message}
                </Text>
              </>
            ) : (
              <>
                <Text className="text-3xl font-bold mb-2" style={{
                  color: personalSummary.status === 'owed' ? '#10b981' : '#ef4444'
                }}>
                  {formatCurrency(personalSummary.amount)}
                </Text>
                
                <Text className="text-gray-600 text-center text-lg">
                  {personalSummary.message}
                </Text>
                
                {personalSummary.status === 'owed' && (
                  <Text className="text-sm text-gray-500 mt-2 text-center">
                    💰 כסף שמגיע לך מהשותפים
                  </Text>
                )}
                {personalSummary.status === 'owes' && (
                  <Text className="text-sm text-gray-500 mt-2 text-center">
                    💳 סכום שאתה חייב לשותפים
                  </Text>
                )}
              </>
            )}
          </View>
        </View>

        {/* Monthly Expenses */}
        <View className="mb-6">
          <Text className="text-lg font-semibold text-gray-900 mb-4">
            הוצאות {getMonthName(selectedMonth)}
          </Text>
          
          {monthlyData.expenses.length === 0 ? (
            <View className="bg-white rounded-2xl p-8 items-center shadow-sm">
              <Ionicons name="calendar-outline" size={48} color="#6b7280" />
              <Text className="text-gray-600 text-center mt-4 mb-4">
                אין הוצאות ב{getMonthName(selectedMonth)}
              </Text>
              <Pressable
                onPress={() => navigation.navigate('AddExpense')}
                className="bg-blue-500 py-2 px-6 rounded-xl"
              >
                <Text className="text-white font-medium">
                  הוסף הוצאה
                </Text>
              </Pressable>
            </View>
          ) : (
            <FlatList
              data={monthlyData.expenses.slice().reverse()}
              renderItem={renderExpenseItem}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
}