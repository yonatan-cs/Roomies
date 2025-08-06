import React, { useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  FlatList
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useStore } from '../state/store';
import { cn } from '../utils/cn';
import { ExpenseCategory } from '../types';

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
  const navigation = useNavigation();
  const { expenses, currentUser, currentApartment, getBalances } = useStore();

  const balances = useMemo(() => getBalances(), [expenses]);
  const myBalance = balances.find(b => b.userId === currentUser?.id);

  const monthlyExpenses = useMemo(() => {
    const now = new Date();
    const thisMonth = expenses.filter(expense => {
      const expenseDate = new Date(expense.date);
      return expenseDate.getMonth() === now.getMonth() && 
             expenseDate.getFullYear() === now.getFullYear();
    });
    return thisMonth.reduce((sum, expense) => sum + expense.amount, 0);
  }, [expenses]);

  const formatCurrency = (amount: number) => {
    return `₪${amount.toFixed(0)}`;
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('he-IL', {
      day: 'numeric',
      month: 'short'
    }).format(new Date(date));
  };

  const getUserName = (userId: string) => {
    if (userId === currentUser?.id) return 'אתה';
    return currentApartment?.members.find(m => m.id === userId)?.name || 'לא ידוע';
  };

  const renderExpenseItem = ({ item: expense }) => (
    <View className="bg-white rounded-xl p-4 mb-3 shadow-sm">
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-row items-center">
          <View className="bg-gray-100 w-10 h-10 rounded-full items-center justify-center">
            <Ionicons 
              name={CATEGORY_ICONS[expense.category]} 
              size={20} 
              color="#6b7280" 
            />
          </View>
          <View className="mr-3">
            <Text className="text-gray-900 font-medium">
              {expense.title}
            </Text>
            <Text className="text-sm text-gray-500">
              {CATEGORY_NAMES[expense.category]} • {formatDate(expense.date)}
            </Text>
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
            {expense.participants.length} משתתפים • {formatCurrency(expense.amount / expense.participants.length)} לאחד
          </Text>
        </View>
      )}
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
    <View className="flex-1 bg-gray-50">
      <View className="bg-white px-6 pt-16 pb-6 shadow-sm">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-2xl font-bold text-gray-900">
            תקציב הדירה
          </Text>
          <Pressable
            onPress={() => navigation.navigate('AddExpense')}
            className="bg-blue-500 w-10 h-10 rounded-full items-center justify-center"
          >
            <Ionicons name="add" size={24} color="white" />
          </Pressable>
        </View>
        
        <Text className="text-gray-600">
          הוצאות החודש: {formatCurrency(monthlyExpenses)}
        </Text>
      </View>

      <ScrollView className="flex-1 px-6 py-6">
        {/* My Balance Card */}
        <View className="bg-white rounded-2xl p-6 mb-6 shadow-sm">
          <Text className="text-lg font-semibold text-gray-900 mb-4">
            המצב שלי
          </Text>
          
          <View className="items-center">
            <Text className="text-3xl font-bold mb-2" style={{
              color: myBalance?.netBalance >= 0 ? '#10b981' : '#ef4444'
            }}>
              {myBalance ? formatCurrency(Math.abs(myBalance.netBalance)) : '₪0'}
            </Text>
            
            <Text className="text-gray-600 text-center">
              {myBalance?.netBalance >= 0 ? 'מגיע לך' : 'אתה חייב'}
            </Text>
          </View>

          {myBalance && (
            <View className="mt-4">
              {/* Who owes me */}
              {Object.entries(myBalance.owed).filter(([_, amount]) => amount > 0).map(([userId, amount]) => (
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
              {Object.entries(myBalance.owes).filter(([_, amount]) => amount > 0).map(([userId, amount]) => (
                <View key={`owes-${userId}`} className="flex-row justify-between items-center py-2">
                  <Text className="text-gray-700">
                    אתה חייב ל{getUserName(userId)}
                  </Text>
                  <Text className="text-red-600 font-medium">
                    {formatCurrency(amount)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* All Balances */}
        <View className="bg-white rounded-2xl p-6 mb-6 shadow-sm">
          <Text className="text-lg font-semibold text-gray-900 mb-4">
            מאזן כולל
          </Text>
          
          {balances.map((balance) => {
            const user = currentApartment.members.find(m => m.id === balance.userId);
            const isCurrentUser = balance.userId === currentUser.id;
            
            return (
              <View key={balance.userId} className="flex-row justify-between items-center py-3">
                <Text className={cn(
                  "font-medium",
                  isCurrentUser ? "text-blue-700" : "text-gray-700"
                )}>
                  {user?.name} {isCurrentUser && '(אתה)'}
                </Text>
                
                <Text className={cn(
                  "font-semibold",
                  balance.netBalance >= 0 ? "text-green-600" : "text-red-600"
                )}>
                  {balance.netBalance >= 0 ? '+' : ''}{formatCurrency(balance.netBalance)}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Recent Expenses */}
        <View className="mb-6">
          <Text className="text-lg font-semibold text-gray-900 mb-4">
            הוצאות אחרונות
          </Text>
          
          {expenses.length === 0 ? (
            <View className="bg-white rounded-2xl p-8 items-center shadow-sm">
              <Ionicons name="wallet-outline" size={48} color="#6b7280" />
              <Text className="text-gray-600 text-center mt-4 mb-4">
                עדיין אין הוצאות
              </Text>
              <Pressable
                onPress={() => navigation.navigate('AddExpense')}
                className="bg-blue-500 py-2 px-6 rounded-xl"
              >
                <Text className="text-white font-medium">
                  הוסף הוצאה ראשונה
                </Text>
              </Pressable>
            </View>
          ) : (
            <FlatList
              data={expenses.slice().reverse()}
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