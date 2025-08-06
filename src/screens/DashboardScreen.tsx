import React, { useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useStore } from '../state/store';
import { cn } from '../utils/cn';

export default function DashboardScreen() {
  const navigation = useNavigation();
  const { 
    currentUser, 
    currentApartment, 
    cleaningTask, 
    expenses, 
    shoppingItems, 
    getBalances 
  } = useStore();

  const balances = useMemo(() => getBalances(), [expenses]);
  const myBalance = balances.find(b => b.userId === currentUser?.id);

  // Quick Stats Calculations
  const monthlyExpenses = useMemo(() => {
    const now = new Date();
    const thisMonth = expenses.filter(expense => {
      const expenseDate = new Date(expense.date);
      return expenseDate.getMonth() === now.getMonth() && 
             expenseDate.getFullYear() === now.getFullYear();
    });
    return thisMonth.reduce((sum, expense) => sum + expense.amount, 0);
  }, [expenses]);

  const pendingShoppingItems = shoppingItems.filter(item => !item.purchased);
  const recentExpenses = expenses.slice(-4).reverse();

  // Statistics
  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const cleaningCount = cleaningTask?.history?.length || 0;
  const purchasedItemsCount = shoppingItems.filter(item => item.purchased).length;

  // Find current turn user
  const getCurrentTurnUser = () => {
    if (!cleaningTask || !currentApartment) return null;
    return currentApartment.members.find(member => member.id === cleaningTask.currentTurn);
  };

  const formatCurrency = (amount: number) => `₪${amount.toFixed(0)}`;
  
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

  const currentTurnUser = getCurrentTurnUser();
  const isMyTurn = currentUser && cleaningTask && cleaningTask.currentTurn === currentUser.id;

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-white px-6 pt-16 pb-6 shadow-sm">
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-2xl font-bold text-gray-900">
            שלום, {currentUser?.name || 'משתמש'}!
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
              myBalance?.netBalance >= 0 ? "text-green-600" : "text-red-600"
            )}>
              {myBalance ? formatCurrency(Math.abs(myBalance.netBalance)) : '₪0'}
            </Text>
            <Text className="text-xs text-gray-500">
              {myBalance?.netBalance >= 0 ? 'מגיע לך' : 'אתה חייב'}
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
              {isMyTurn ? 'התורה שלך!' : 'התורה שלו/שלה'}
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
                    {member.name.charAt(0)}
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

        {/* Recent Expenses */}
        <View className="bg-white rounded-2xl p-6 mb-6 shadow-sm">
          <Text className="text-lg font-semibold text-gray-900 mb-4">
            הוצאות אחרונות
          </Text>
          
          {recentExpenses.length > 0 ? (
            <View>
              {recentExpenses.map((expense) => (
                <View key={expense.id} className="flex-row justify-between items-center py-2">
                  <View>
                    <Text className="text-gray-900 font-medium">
                      {expense.title}
                    </Text>
                    <Text className="text-sm text-gray-500">
                      {getUserName(expense.paidBy)} • {formatDate(expense.date)}
                    </Text>
                  </View>
                  <Text className="text-gray-900 font-semibold">
                    {formatCurrency(expense.amount)}
                  </Text>
                </View>
              ))}

              <Pressable
                onPress={() => navigation.navigate('Budget')}
                className="bg-blue-100 py-2 px-4 rounded-xl mt-3"
              >
                <Text className="text-blue-700 text-center font-medium">
                  הצג הכל
                </Text>
              </Pressable>
            </View>
          ) : (
            <View className="items-center py-4">
              <Ionicons name="wallet-outline" size={48} color="#6b7280" />
              <Text className="text-gray-500 mt-2">אין הוצאות עדיין</Text>
              <Pressable
                onPress={() => navigation.navigate('AddExpense')}
                className="bg-blue-500 py-2 px-4 rounded-xl mt-3"
              >
                <Text className="text-white font-medium">הוסף הוצאה ראשונה</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Apartment Highlights */}
        <View className="bg-white rounded-2xl p-6 shadow-sm">
          <Text className="text-lg font-semibold text-gray-900 mb-4">
            הייליטס של הדירה
          </Text>
          
          <View className="flex-row flex-wrap justify-between">
            <View className="items-center w-[48%] mb-4">
              <Text className="text-2xl font-bold text-blue-600">
                {formatCurrency(totalExpenses)}
              </Text>
              <Text className="text-sm text-gray-500">סך הוצאות</Text>
            </View>

            <View className="items-center w-[48%] mb-4">
              <Text className="text-2xl font-bold text-green-600">
                {cleaningCount}
              </Text>
              <Text className="text-sm text-gray-500">ניקיונות</Text>
            </View>

            <View className="items-center w-[48%]">
              <Text className="text-2xl font-bold text-orange-600">
                {purchasedItemsCount}
              </Text>
              <Text className="text-sm text-gray-500">קניות</Text>
            </View>

            <View className="items-center w-[48%]">
              <Text className="text-2xl font-bold text-purple-600">
                {formatCurrency(monthlyExpenses)}
              </Text>
              <Text className="text-sm text-gray-500">החודש</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}