import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  FlatList,
  TextInput,
  Alert
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
  const [showSettlementModal, setShowSettlementModal] = useState(false);
  const [settlementAmount, setSettlementAmount] = useState('');
  const [settlementFromUser, setSettlementFromUser] = useState('');
  const [settlementToUser, setSettlementToUser] = useState('');
  const [settlementOriginalAmount, setSettlementOriginalAmount] = useState(0);
  
  const { expenses, currentUser, currentApartment, getBalances, addDebtSettlement } = useStore();

  const balances = useMemo(() => getBalances(), [expenses]);
  const myBalance = balances.find(b => b.userId === currentUser?.id);

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

  const formatCurrency = (amount: number) => {
    return `₪${amount.toFixed(0)}`;
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

  const handleSettleDebt = (fromUserId: string, toUserId: string, amount: number) => {
    setSettlementFromUser(fromUserId);
    setSettlementToUser(toUserId);
    setSettlementOriginalAmount(amount);
    setSettlementAmount(amount.toString());
    setShowSettlementModal(true);
  };

  const confirmSettlement = () => {
    const amount = parseFloat(settlementAmount);
    if (!amount || amount <= 0 || amount > settlementOriginalAmount) {
      Alert.alert('שגיאה', 'הכנס סכום תקין');
      return;
    }

    addDebtSettlement(
      settlementFromUser,
      settlementToUser,
      amount,
      `סילוק חוב`
    );

    setShowSettlementModal(false);
    setSettlementAmount('');
    setSettlementFromUser('');
    setSettlementToUser('');
    setSettlementOriginalAmount(0);
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
                  <View className="flex-1">
                    <Text className="text-gray-700">
                      {getUserName(userId)} חייב לך
                    </Text>
                  </View>
                  <Text className="text-green-600 font-medium ml-2">
                    {formatCurrency(amount)}
                  </Text>
                  <Pressable
                    onPress={() => handleSettleDebt(userId, currentUser!.id, amount)}
                    className="bg-green-100 py-1 px-3 rounded-lg"
                  >
                    <Text className="text-green-700 text-sm">סלק</Text>
                  </Pressable>
                </View>
              ))}
              
              {/* Who I owe */}
              {Object.entries(myBalance.owes).filter(([_, amount]) => amount > 0).map(([userId, amount]) => (
                <View key={`owes-${userId}`} className="flex-row justify-between items-center py-2">
                  <View className="flex-1">
                    <Text className="text-gray-700">
                      אתה חייב ל{getUserName(userId)}
                    </Text>
                  </View>
                  <Text className="text-red-600 font-medium ml-2">
                    {formatCurrency(amount)}
                  </Text>
                  <Pressable
                    onPress={() => handleSettleDebt(currentUser!.id, userId, amount)}
                    className="bg-red-100 py-1 px-3 rounded-lg"
                  >
                    <Text className="text-red-700 text-sm">סלק</Text>
                  </Pressable>
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

      {/* Debt Settlement Modal */}
      {showSettlementModal && (
        <View className="absolute inset-0 bg-black/50 justify-center items-center px-6">
          <View className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <Text className="text-xl font-semibold text-gray-900 mb-4 text-center">
              סילוק חוב
            </Text>
            
            <Text className="text-gray-600 text-center mb-4">
              חוב מקורי: {formatCurrency(settlementOriginalAmount)}
            </Text>
            <Text className="text-gray-600 text-center mb-4">
              {getUserName(settlementFromUser)} ← {getUserName(settlementToUser)}
            </Text>

            <Text className="text-gray-700 mb-2">סכום לסילוק:</Text>
            <View className="flex-row items-center mb-6">
              <TextInput
                value={settlementAmount}
                onChangeText={setSettlementAmount}
                placeholder="0"
                className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-base"
                keyboardType="numeric"
                textAlign="center"
              />
              <Text className="text-gray-700 text-lg mr-3">₪</Text>
            </View>

            <View className="flex-row">
              <Pressable
                onPress={() => {
                  setShowSettlementModal(false);
                  setSettlementAmount('');
                  setSettlementFromUser('');
                  setSettlementToUser('');
                  setSettlementOriginalAmount(0);
                }}
                className="flex-1 bg-gray-100 py-3 px-4 rounded-xl mr-2"
              >
                <Text className="text-gray-700 font-medium text-center">
                  ביטול
                </Text>
              </Pressable>
              
              <Pressable
                onPress={confirmSettlement}
                className="flex-1 bg-blue-500 py-3 px-4 rounded-xl"
              >
                <Text className="text-white font-medium text-center">
                  אישור סילוק
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}