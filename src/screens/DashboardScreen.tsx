import React, { useEffect, useMemo, useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Modal,
  FlatList,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useStore } from '../state/store';
import { cn } from '../utils/cn';
import { getUserDisplayInfo, getDisplayName } from '../utils/userDisplay';

type RootStackParamList = {
  Settings: undefined;
  Shopping: undefined;
  AddExpense: undefined;
  Budget: undefined;
  Cleaning: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function DashboardScreen() {
  const navigation = useNavigation<NavigationProp>();
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [showHighlightsModal, setShowHighlightsModal] = useState(false);
  const [timeRange, setTimeRange] = useState<'all' | 'year' | 'month' | '30days'>('all');
  const { 
    currentUser, 
    currentApartment, 
    cleaningTask, 
    expenses, 
    debtSettlements,
    shoppingItems, 
    getBalances,
    refreshApartmentMembers,
    loadExpenses,
    loadDebtSettlements,
    loadShoppingItems,
    loadCleaningTask,
    loadCleaningChecklist
  } = useStore();

  // Load all data from Firestore when component mounts
  useEffect(() => {
    const loadAllData = async () => {
      try {
        console.log('🔄 Dashboard: Loading all data from Firestore...');
        
        // Load apartment members
        if (currentApartment) {
          await refreshApartmentMembers();
        }
        
        // Load expenses, debt settlements, shopping items, cleaning task, and checklist
        await Promise.all([
          loadExpenses(),
          loadDebtSettlements(),
          loadShoppingItems(),
          loadCleaningTask(),
          loadCleaningChecklist(),
        ]);
        
        console.log('✅ Dashboard: All data loaded successfully');
      } catch (error) {
        console.error('❌ Dashboard: Error loading data:', error);
      }
    };

    loadAllData();
  }, [currentApartment?.id]); // Reload when apartment changes

  // Refresh data when screen comes into focus + light polling
  useFocusEffect(useCallback(() => {
    const refreshData = async () => {
      try {
        console.log('🔄 Dashboard: Refreshing data on focus...');
        await Promise.all([
          loadExpenses(),
          loadDebtSettlements(),
          refreshApartmentMembers(),
        ]);
        console.log('✅ Dashboard: Data refreshed successfully');
      } catch (error) {
        console.error('❌ Dashboard: Error refreshing data:', error);
      }
    };

    // Initial refresh when screen comes into focus
    refreshData();

    // Set up light polling every 15 seconds while screen is focused
    timerRef.current = setInterval(() => {
      refreshData();
    }, 15000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [loadExpenses, loadDebtSettlements, refreshApartmentMembers]));

  const balances = useMemo(() => getBalances(), [expenses, debtSettlements]);
  const myBalance = balances.find(b => b.userId === currentUser?.id);

  // Quick Stats Calculations
  const monthlyExpenses = useMemo(() => {
    const now = new Date();
    const thisMonth = expenses.filter(expense => {
      try {
        const expenseDate = new Date(expense.date);
        if (isNaN(expenseDate.getTime())) return false;
        return expenseDate.getMonth() === now.getMonth() && 
               expenseDate.getFullYear() === now.getFullYear();
      } catch {
        return false;
      }
    });
    return thisMonth.reduce((sum, expense) => sum + expense.amount, 0);
  }, [expenses]);

  const pendingShoppingItems = shoppingItems.filter(item => !item.purchased);

  // Statistics
  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const cleaningCount = cleaningTask?.history?.length || 0;
  const purchasedItemsCount = shoppingItems.filter(item => item.purchased).length;

  // Advanced Statistics for Highlights Modal
  const highlightsStats = useMemo(() => {
    if (!currentApartment || !expenses.length) {
      return {
        totalExpenses: 0,
        kingOfExpenses: null,
        shoppingKing: null,
        cleaningKing: null,
        biggestExpenseLast30Days: null,
        averagePerMember: 0,
        monthsActive: 1,
        filteredExpenses: []
      };
    }

    // Filter expenses by time range
    const now = new Date();
    let filteredExpenses = expenses;
    
    switch (timeRange) {
      case '30days':
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        filteredExpenses = expenses.filter(expense => {
          const expenseDate = new Date(expense.date);
          return expenseDate >= thirtyDaysAgo;
        });
        break;
      case 'month':
        filteredExpenses = expenses.filter(expense => {
          const expenseDate = new Date(expense.date);
          return expenseDate.getMonth() === now.getMonth() && 
                 expenseDate.getFullYear() === now.getFullYear();
        });
        break;
      case 'year':
        filteredExpenses = expenses.filter(expense => {
          const expenseDate = new Date(expense.date);
          return expenseDate.getFullYear() === now.getFullYear();
        });
        break;
      case 'all':
      default:
        filteredExpenses = expenses;
        break;
    }

    const totalExpenses = filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0);

    // King of Expenses - who paid the most
    const expensesByUser = filteredExpenses.reduce((acc, expense) => {
      acc[expense.paidBy] = (acc[expense.paidBy] || 0) + expense.amount;
      return acc;
    }, {} as Record<string, number>);

    const kingOfExpenses = Object.entries(expensesByUser)
      .sort(([,a], [,b]) => b - a)[0];

    // Shopping King - who bought the most items (filter by time range)
    const shoppingByUser = shoppingItems
      .filter(item => {
        if (!item.purchased || !item.purchasedBy) return false;
        
        // Filter by time range if item has purchase date
        if (item.purchasedAt) {
          const purchaseDate = new Date(item.purchasedAt);
          switch (timeRange) {
            case '30days':
              const thirtyDaysAgo = new Date();
              thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
              return purchaseDate >= thirtyDaysAgo;
            case 'month':
              return purchaseDate.getMonth() === now.getMonth() && 
                     purchaseDate.getFullYear() === now.getFullYear();
            case 'year':
              return purchaseDate.getFullYear() === now.getFullYear();
            case 'all':
            default:
              return true;
          }
        }
        return true; // If no purchase date, include all
      })
      .reduce((acc, item) => {
        acc[item.purchasedBy!] = (acc[item.purchasedBy!] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    const shoppingKing = Object.entries(shoppingByUser)
      .sort(([,a], [,b]) => b - a)[0];

    // Cleaning King - who did the most cleanings (filter by time range)
    const cleaningByUser = cleaningTask?.history
      ?.filter(entry => {
        if (!entry.userId) return false;
        
        // Filter by time range if entry has completion date
        if (entry.cleanedAt) {
          const completionDate = new Date(entry.cleanedAt);
          switch (timeRange) {
            case '30days':
              const thirtyDaysAgo = new Date();
              thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
              return completionDate >= thirtyDaysAgo;
            case 'month':
              return completionDate.getMonth() === now.getMonth() && 
                     completionDate.getFullYear() === now.getFullYear();
            case 'year':
              return completionDate.getFullYear() === now.getFullYear();
            case 'all':
            default:
              return true;
          }
        }
        return true; // If no completion date, include all
      })
      .reduce((acc, entry) => {
        acc[entry.userId!] = (acc[entry.userId!] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

    const cleaningKing = Object.entries(cleaningByUser)
      .sort(([,a], [,b]) => b - a)[0];

    // Biggest expense in filtered range
    const biggestExpense = filteredExpenses
      .sort((a, b) => b.amount - a.amount)[0];

    // Calculate months active (rough estimate)
    const firstExpense = filteredExpenses.sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    )[0];
    
    const monthsActive = firstExpense ? 
      Math.max(1, Math.ceil((Date.now() - new Date(firstExpense.date).getTime()) / (1000 * 60 * 60 * 24 * 30))) : 1;

    const averagePerMember = totalExpenses / (currentApartment.members.length * monthsActive);

    return {
      totalExpenses,
      kingOfExpenses: kingOfExpenses ? {
        userId: kingOfExpenses[0],
        amount: kingOfExpenses[1],
        percentage: totalExpenses > 0 ? (kingOfExpenses[1] / totalExpenses) * 100 : 0
      } : null,
      shoppingKing: shoppingKing ? {
        userId: shoppingKing[0],
        count: shoppingKing[1]
      } : null,
      cleaningKing: cleaningKing ? {
        userId: cleaningKing[0],
        count: cleaningKing[1]
      } : null,
      biggestExpenseLast30Days: biggestExpense,
      averagePerMember,
      monthsActive,
      filteredExpenses
    };
  }, [expenses, shoppingItems, cleaningTask, currentApartment, timeRange]);

  // Find current turn user
  const getCurrentTurnUser = () => {
    if (!cleaningTask || !currentApartment) return null;
    return currentApartment.members.find(member => member.id === cleaningTask.currentTurn);
  };

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
    const member = currentApartment?.members.find(m => m.id === userId);
    return getUserDisplayInfo(member).displayName;
  };

  const currentTurnUser = getCurrentTurnUser();
  const isMyTurn = currentUser && cleaningTask && cleaningTask.currentTurn === currentUser.id;

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-white px-6 pt-16 pb-6 shadow-sm">
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-2xl font-bold text-gray-900">
            שלום, {getDisplayName(currentUser)}!
          </Text>
          <Pressable
            onPress={() => navigation.navigate('Settings')}
            className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center"
          >
            <Ionicons name="person-outline" size={20} color="#6b7280" />
          </Pressable>
        </View>
        <Text className="text-gray-600">
          {currentApartment?.name || 'דירת שותפים'}
        </Text>
      </View>

      <ScrollView className="flex-1 px-6 py-6">
        {/* Quick Actions */}
        <View className="flex-row mb-6">
          <Pressable
            onPress={() => navigation.navigate('Shopping')}
            className="flex-1 bg-blue-500 py-4 px-4 rounded-2xl items-center mr-2"
          >
            <Ionicons name="basket-outline" size={24} color="white" />
            <Text className="text-white font-medium mt-1">קניות</Text>
          </Pressable>
          
          <Pressable
            onPress={() => navigation.navigate('AddExpense')}
            className="flex-1 bg-green-500 py-4 px-4 rounded-2xl items-center"
          >
            <Ionicons name="add-circle-outline" size={24} color="white" />
            <Text className="text-white font-medium mt-1">הוסף הוצאה</Text>
          </Pressable>
        </View>

        {/* Quick Stats Cards */}
        <View className="flex-row flex-wrap mb-6">
          {/* My Balance */}
          <Pressable
            onPress={() => navigation.navigate('Budget')}
            className="bg-white p-4 rounded-2xl shadow-sm w-[48%] mb-3 mr-2"
          >
            <View className="flex-row items-center mb-2">
              <Ionicons name="wallet-outline" size={20} color="#6b7280" />
              <Text className="text-gray-600 text-sm mr-2">היתרה שלי</Text>
            </View>
            <Text className={cn(
              "text-2xl font-bold",
              (myBalance?.netBalance ?? 0) >= 0 ? "text-green-600" : "text-red-600"
            )}>
              {myBalance ? formatCurrency(Math.abs(myBalance.netBalance ?? 0)) : '₪0'}
            </Text>
            <Text className="text-xs text-gray-500">
              {(myBalance?.netBalance ?? 0) >= 0 ? 'מגיע לך' : 'אתה חייב'}
            </Text>
          </Pressable>

          {/* Cleaning Turn */}
          <Pressable
            onPress={() => navigation.navigate('Cleaning')}
            className="bg-white p-4 rounded-2xl shadow-sm w-[48%] mb-3"
          >
            <View className="flex-row items-center mb-2">
              <Ionicons name="brush-outline" size={20} color="#6b7280" />
              <Text className="text-gray-600 text-sm mr-2">תור ניקיון</Text>
            </View>
            <Text className="text-lg font-bold text-gray-900">
              {currentTurnUser?.name || 'לא מוגדר'}
            </Text>
            <Text className={cn(
              "text-xs",
              isMyTurn ? "text-blue-600" : "text-gray-500"
            )}>
              {isMyTurn ? 'התור שלך!' : 'התור שלו/שלה'}
            </Text>
          </Pressable>

          {/* Shopping Items */}
          <Pressable
            onPress={() => navigation.navigate('Shopping')}
            className="bg-white p-4 rounded-2xl shadow-sm w-[48%] mb-3 mr-2"
          >
            <View className="flex-row items-center mb-2">
              <Ionicons name="basket-outline" size={20} color="#6b7280" />
              <Text className="text-gray-600 text-sm mr-2">לקנות</Text>
            </View>
            <Text className="text-2xl font-bold text-gray-900">
              {pendingShoppingItems.length}
            </Text>
            <Text className="text-xs text-gray-500">
              {pendingShoppingItems[0]?.name || 'אין פריטים'}
            </Text>
          </Pressable>

          {/* Roommates */}
          <Pressable
            onPress={() => navigation.navigate('Settings')}
            className="bg-white p-4 rounded-2xl shadow-sm w-[48%] mb-3"
          >
            <View className="flex-row items-center mb-2">
              <Ionicons name="people-outline" size={20} color="#6b7280" />
              <Text className="text-gray-600 text-sm mr-2">שותפים</Text>
            </View>
            <Text className="text-2xl font-bold text-gray-900">
              {currentApartment?.members.length || 0}
            </Text>
            <View className="flex-row mt-1">
              {currentApartment?.members.slice(0, 3).map((member, index) => (
                <View 
                  key={member.id}
                  className={cn(
                    "w-5 h-5 bg-blue-100 rounded-full items-center justify-center",
                    index > 0 && "-mr-1"
                  )}
                >
                  <Text className="text-xs text-blue-700 font-medium">
                    {getUserDisplayInfo(member).initial}
                  </Text>
                </View>
              ))}
            </View>
          </Pressable>
        </View>

        {/* My Debts */}
        <View className="bg-white rounded-2xl p-6 mb-6 shadow-sm">
          <Text className="text-lg font-semibold text-gray-900 mb-4">
            החובות שלי
          </Text>
          
          {myBalance && (
            <View>
              {/* Who owes me */}
              {Object.entries(myBalance.owed)
                .filter(([_, amount]) => amount > 0)
                .slice(0, 3)
                .map(([userId, amount]) => (
                <View key={`owed-${userId}`} className="flex-row justify-between items-center py-2">
                  <Text className="text-gray-700">
                    {getUserName(userId)} חייב לך
                  </Text>
                  <Text className="text-green-600 font-medium">
                    {formatCurrency(amount)}
                  </Text>
                </View>
              ))}
              
              {/* Who I owe */}
              {Object.entries(myBalance.owes)
                .filter(([_, amount]) => amount > 0)
                .slice(0, 3)
                .map(([userId, amount]) => (
                <View key={`owes-${userId}`} className="flex-row justify-between items-center py-2">
                  <Text className="text-gray-700">
                    אתה חייב ל{getUserName(userId)}
                  </Text>
                  <Text className="text-red-600 font-medium">
                    {formatCurrency(amount)}
                  </Text>
                </View>
              ))}

              {Object.keys(myBalance.owed).length === 0 && Object.keys(myBalance.owes).length === 0 && (
                <Text className="text-gray-500 text-center py-4">
                  כל החובות מסולקים! 🎉
                </Text>
              )}

              <Pressable
                onPress={() => navigation.navigate('Budget')}
                className="bg-blue-100 py-2 px-4 rounded-xl mt-3"
              >
                <Text className="text-blue-700 text-center font-medium">
                  הצג הכל
                </Text>
              </Pressable>
            </View>
          )}
        </View>


        {/* Quick Look Button */}
        <Pressable
          onPress={() => setShowHighlightsModal(true)}
          className="bg-white rounded-2xl p-6 shadow-sm"
          accessibilityLabel="🔍 מבט מהיר"
          accessibilityHint="מבט מהיר על הפעילות"
        >
          <View className="flex-row items-center justify-center">
            <Text className="text-lg font-semibold text-gray-900 mr-2">
              מבט מהיר
            </Text>
            <Text className="text-xl">🔍</Text>
          </View>
        </Pressable>
      </ScrollView>

      {/* Highlights Modal */}
      <Modal
        visible={showHighlightsModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowHighlightsModal(false)}
      >
        <View className="flex-1 bg-gray-50">
          {/* Header */}
          <View className="bg-white px-6 pt-16 pb-6 shadow-sm">
            <View className="flex-row items-center justify-between mb-4">
              <Pressable
                onPress={() => setShowHighlightsModal(false)}
                className="w-10 h-10 rounded-full items-center justify-center bg-gray-100"
              >
                <Ionicons name="arrow-forward" size={24} color="#374151" />
              </Pressable>
              
              <Text className="text-2xl font-bold text-gray-900">
                Highlights — פעילות הדירה
              </Text>
              
              <View className="w-10" />
            </View>
          </View>

          <ScrollView className="flex-1 px-6 py-6">
            {/* Time Range Filter */}
            <View className="bg-white rounded-2xl p-4 mb-6 shadow-sm">
              <Text className="text-sm text-gray-500 mb-3">טווח זמן</Text>
              <View className="flex-row space-x-2">
                {[
                  { key: 'all', label: 'כל הזמן' },
                  { key: 'year', label: 'השנה' },
                  { key: 'month', label: 'החודש' },
                  { key: '30days', label: '30 יום' }
                ].map((option) => (
                  <Pressable
                    key={option.key}
                    onPress={() => setTimeRange(option.key as any)}
                    className={cn(
                      "flex-1 py-2 px-3 rounded-lg",
                      timeRange === option.key 
                        ? "bg-blue-500" 
                        : "bg-gray-100"
                    )}
                  >
                    <Text className={cn(
                      "text-center text-sm font-medium",
                      timeRange === option.key 
                        ? "text-white" 
                        : "text-gray-700"
                    )}>
                      {option.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Statistics Cards */}
            <View className="space-y-4">
              {/* Total Spent & King of Expenses */}
              <View className="flex-row space-x-4">
                <View className="flex-1 bg-white rounded-2xl p-6 shadow-sm">
                  <Text className="text-sm text-gray-500 mb-2">סך הוצאות</Text>
                  <Text className="text-2xl font-bold text-blue-600 mb-1">
                    {formatCurrency(highlightsStats.totalExpenses)}
                  </Text>
                  <Text className="text-xs text-gray-400">
                    ({timeRange === 'all' ? 'מאז תחילת השימוש' : 
                      timeRange === 'year' ? 'השנה' :
                      timeRange === 'month' ? 'החודש' : '30 הימים האחרונים'})
                  </Text>
                </View>
                
                <View className="flex-1 bg-white rounded-2xl p-6 shadow-sm">
                  <Text className="text-sm text-gray-500 mb-2">מלך ההוצאות</Text>
                  {highlightsStats.kingOfExpenses ? (
                    <>
                      <Text className="text-lg font-bold text-yellow-600 mb-1">
                        {getUserName(highlightsStats.kingOfExpenses.userId)}
                      </Text>
                      <Text className="text-sm text-gray-600">
                        {formatCurrency(highlightsStats.kingOfExpenses.amount)}
                      </Text>
                      <Text className="text-xs text-gray-400">
                        ({highlightsStats.kingOfExpenses.percentage.toFixed(1)}% מהסך)
                      </Text>
                      <Text className="text-xs text-gray-400 mt-1">
                        תן לו כתר… או חשבון לחזרה 👑
                      </Text>
                    </>
                  ) : (
                    <Text className="text-gray-500">אין נתונים</Text>
                  )}
                </View>
              </View>

              {/* Cleanings Done & Shopping King */}
              <View className="flex-row space-x-4">
                <View className="flex-1 bg-white rounded-2xl p-6 shadow-sm">
                  <Text className="text-sm text-gray-500 mb-2">ניקיונות שבוצעו</Text>
                  <Text className="text-2xl font-bold text-green-600 mb-1">
                    {cleaningCount}
                  </Text>
                  {highlightsStats.cleaningKing ? (
                    <>
                      <Text className="text-sm text-gray-600">
                        אלוף: {getUserName(highlightsStats.cleaningKing.userId)}
                      </Text>
                      <Text className="text-xs text-gray-400">
                        מרסק את האבק מאז 2023 🧹
                      </Text>
                    </>
                  ) : (
                    <Text className="text-xs text-gray-400">אין אלוף עדיין</Text>
                  )}
                </View>
                
                <View className="flex-1 bg-white rounded-2xl p-6 shadow-sm">
                  <Text className="text-sm text-gray-500 mb-2">אלוף הקניות</Text>
                  {highlightsStats.shoppingKing ? (
                    <>
                      <Text className="text-lg font-bold text-orange-600 mb-1">
                        {getUserName(highlightsStats.shoppingKing.userId)}
                      </Text>
                      <Text className="text-sm text-gray-600">
                        {highlightsStats.shoppingKing.count} פריטים
                      </Text>
                      <Text className="text-xs text-gray-400">
                        קונה כמו שאין מחר — יש סביבות! 🛒
                      </Text>
                    </>
                  ) : (
                    <Text className="text-gray-500">אין נתונים</Text>
                  )}
                </View>
              </View>

              {/* Biggest Expense & Average */}
              <View className="flex-row space-x-4">
                <View className="flex-1 bg-white rounded-2xl p-6 shadow-sm">
                  <Text className="text-sm text-gray-500 mb-2">
                    ההוצאה הכי גדולה {timeRange === '30days' ? '(30 יום)' : 
                      timeRange === 'month' ? '(החודש)' :
                      timeRange === 'year' ? '(השנה)' : '(כל הזמן)'}
                  </Text>
                  {highlightsStats.biggestExpenseLast30Days ? (
                    <>
                      <Text className="text-lg font-bold text-red-600 mb-1">
                        {formatCurrency(highlightsStats.biggestExpenseLast30Days.amount)}
                      </Text>
                      <Text className="text-sm text-gray-600">
                        {highlightsStats.biggestExpenseLast30Days.title}
                      </Text>
                    </>
                  ) : (
                    <Text className="text-gray-500">אין הוצאות בחודש האחרון</Text>
                  )}
                </View>
                
                <View className="flex-1 bg-white rounded-2xl p-6 shadow-sm">
                  <Text className="text-sm text-gray-500 mb-2">ממוצע לחבר</Text>
                  <Text className="text-lg font-bold text-purple-600 mb-1">
                    {formatCurrency(highlightsStats.averagePerMember)}
                  </Text>
                  <Text className="text-xs text-gray-400">לחודש</Text>
                </View>
              </View>
            </View>

            {/* No Data State */}
            {highlightsStats.totalExpenses === 0 && (
              <View className="bg-white rounded-2xl p-8 items-center shadow-sm mt-6">
                <Ionicons name="stats-chart-outline" size={64} color="#6b7280" />
                <Text className="text-lg font-medium text-gray-900 mt-4 mb-2">
                  אין נתונים עדיין
                </Text>
                <Text className="text-gray-600 text-center">
                  תתחילו לקנות/לנקות כדי שנוכל לשפוט 😄
                </Text>
              </View>
            )}

            {/* Action Buttons */}
            <View className="flex-row mt-8 space-x-4">
              <Pressable
                onPress={() => setShowHighlightsModal(false)}
                className="flex-1 bg-gray-100 py-4 px-6 rounded-xl"
              >
                <Text className="text-gray-700 font-medium text-center">
                  סגור
                </Text>
              </Pressable>
              
              <Pressable
                onPress={() => {
                  // TODO: Implement share functionality
                  console.log('Share highlights');
                }}
                className="flex-1 bg-blue-500 py-4 px-6 rounded-xl"
              >
                <Text className="text-white font-medium text-center">
                  שתף
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}