import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  Alert,
  Switch
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useStore } from '../state/store';
import { cn } from '../utils/cn';

type RootStackParamList = {
  Budget: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function GroupDebtsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [showSettlementModal, setShowSettlementModal] = useState(false);
  const [settlementAmount, setSettlementAmount] = useState('');
  const [settlementFromUser, setSettlementFromUser] = useState('');
  const [settlementToUser, setSettlementToUser] = useState('');
  const [settlementOriginalAmount, setSettlementOriginalAmount] = useState(0);
  const [useSimplified, setUseSimplified] = useState(true);
  const [isSettling, setIsSettling] = useState(false);
  
  // New debt system state
  const [liveDebts, setLiveDebts] = useState<any[]>([]);
  const [liveActions, setLiveActions] = useState<any[]>([]);
  const [myBalance, setMyBalance] = useState(0);
  
  const { 
    expenses, 
    debtSettlements, 
    currentUser, 
    currentApartment, 
    getBalances, 
    getRawBalances,
    getSimplifiedBalances, 
    loadDebtSettlements,
    settleCalculatedDebt,
    initializeDebtSystem,
    cleanupDebtSystem
  } = useStore();

  // Load debt settlements on component mount (legacy - for background data only)
  // TODO: Remove this when new system is fully integrated
  // NOTE: This is NOT used for UI display anymore
  useEffect(() => {
    const loadData = async () => {
      try {
        await loadDebtSettlements();
      } catch (error) {
        console.error('Error loading debt settlements in Group Debts screen:', error);
      }
    };
    loadData();
  }, [loadDebtSettlements]);

  // Track last apartment ID to prevent duplicate listeners
  const lastApartmentIdRef = useRef<string | null>(null);

  // Initialize new debt system with real-time listeners
  useEffect(() => {
    if (!currentApartment?.id || !currentUser?.id) return;
    
    // Don't reinitialize if apartment hasn't changed
    if (lastApartmentIdRef.current === currentApartment.id) return;
    
    const userIds = currentApartment.members.map(m => m.id);
    
    // Initialize the new debt system
    initializeDebtSystem(currentApartment.id, userIds);
    lastApartmentIdRef.current = currentApartment.id;
    
    // Cleanup on unmount
    return () => {
      cleanupDebtSystem();
      lastApartmentIdRef.current = null;
    };
  }, [currentApartment?.id, currentUser?.id, initializeDebtSystem, cleanupDebtSystem]);

  // Subscribe to real-time updates from the new debt system
  useEffect(() => {
    if (!currentApartment?.id || !currentUser?.id) return;
    
    // Don't resubscribe if apartment hasn't changed
    if (lastApartmentIdRef.current === currentApartment.id) return;
    
    // Import and subscribe to real-time updates
    const setupSubscriptions = async () => {
      try {
        const { 
          subscribeToDebts, 
          subscribeToActions, 
          subscribeToUserBalance 
        } = await import('../store/debts');
        
        const unsubDebts = subscribeToDebts(setLiveDebts);
        const unsubActions = subscribeToActions(setLiveActions);
        const unsubBalance = subscribeToUserBalance(currentUser.id, setMyBalance);
        
        return () => {
          unsubDebts();
          unsubActions();
          unsubBalance();
        };
      } catch (error) {
        console.error('Error setting up debt subscriptions:', error);
      }
    };
    
    setupSubscriptions();
  }, [currentApartment?.id, currentUser?.id]);

  const balances = useMemo(() => {
    return useSimplified ? getSimplifiedBalances() : getRawBalances();
  }, [expenses, debtSettlements, useSimplified, getRawBalances, getSimplifiedBalances]);

  const formatCurrency = (amount: number) => {
    // Show exact amount with up to 2 decimal places, no rounding
    if (amount === Math.floor(amount)) {
      return `₪${amount}`;
    }
    return `₪${amount.toFixed(2)}`;
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

  const confirmSettlement = async () => {
    const amount = parseFloat(settlementAmount);
    if (!amount || amount <= 0 || amount > settlementOriginalAmount) {
      Alert.alert('שגיאה', 'הכנס סכום תקין');
      return;
    }

    // Prevent double-clicking
    if (isSettling) {
      return;
    }

    setIsSettling(true);

    try {
      // Use the new atomically transactional debt settlement
      await settleCalculatedDebt(
        settlementFromUser,
        settlementToUser,
        amount,
        `סגירת חוב`
      );

      setShowSettlementModal(false);
      setSettlementAmount('');
      setSettlementFromUser('');
      setSettlementToUser('');
      setSettlementOriginalAmount(0);
      
      // No need to manually refresh - onSnapshot will update the UI automatically
      Alert.alert('הצלחה', 'החוב נסגר בהצלחה!');
      
    } catch (error) {
      console.error('Error settling debt:', error);
      
      // Show specific error messages based on error type
      let errorMessage = 'לא ניתן לסגור את החוב. נסה שוב.';
      
      if (error instanceof Error) {
        if (error.message.includes('PERMISSION_DENIED')) {
          errorMessage = 'אין לך הרשאה לבצע פעולה זה.';
        } else if (error.message.includes('APARTMENT_NOT_FOUND')) {
          errorMessage = 'לא נמצא דירה רלוונטית.';
        } else if (error.message.includes('TRANSACTION_COMMIT_FAILED')) {
          errorMessage = 'שגיאה בביצוע הפעולה. נסה שוב.';
        }
      }
      
      Alert.alert('שגיאה', errorMessage);
    } finally {
      setIsSettling(false);
    }
  };

  // Get all active debts for display - use the same system as balance summary
  const getAllDebts = () => {
    const debts: Array<{ fromUserId: string, toUserId: string, amount: number }> = [];
    
    balances.forEach(balance => {
      Object.entries(balance.owes).forEach(([toUserId, amount]) => {
        if (amount > 0.01) {
          debts.push({
            fromUserId: balance.userId,
            toUserId,
            amount
          });
        }
      });
    });
    
    return debts.sort((a, b) => b.amount - a.amount);
  };

  const allDebts = getAllDebts();

  if (!currentUser || !currentApartment) {
    return (
      <View className="flex-1 bg-white justify-center items-center">
        <Text className="text-gray-500">טוען...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-white px-6 pt-16 pb-6 shadow-sm">
        <View className="flex-row items-center justify-between mb-4">
          <Pressable
            onPress={() => navigation.goBack()}
            className="w-10 h-10 rounded-full items-center justify-center bg-gray-100"
          >
            <Ionicons name="arrow-forward" size={24} color="#374151" />
          </Pressable>
          
          <Text className="text-2xl font-bold text-gray-900">
            חובות קבוצתיים
          </Text>
          
          <View className="w-10" />
        </View>
        
        {/* Simplification Toggle */}
        <View className="flex-row items-center justify-between bg-gray-50 p-4 rounded-xl">
          <View>
            <Text className="text-gray-900 font-medium">
              פישוט חובות
            </Text>
            <Text className="text-sm text-gray-600">
              {useSimplified ? 'מציג מינימום העברות נדרש' : 'מציג כל החובות בנפרד'}
            </Text>
          </View>
          <Switch
            value={useSimplified}
            onValueChange={setUseSimplified}
            trackColor={{ false: '#d1d5db', true: '#3b82f6' }}
            thumbColor={useSimplified ? '#ffffff' : '#f3f4f6'}
          />
        </View>
      </View>

      <ScrollView className="flex-1 px-6 py-6">
        {/* Group Balance Summary */}
        <View className="bg-white rounded-2xl p-6 mb-6 shadow-sm">
          <Text className="text-lg font-semibold text-gray-900 mb-4">
            סיכום מאזן קבוצתי
          </Text>
          
          {balances.map((balance) => {
            const user = currentApartment.members.find(m => m.id === balance.userId);
            const isCurrentUser = balance.userId === currentUser.id;
            
            return (
              <View key={balance.userId} className="flex-row justify-between items-center py-3 border-b border-gray-100 last:border-b-0">
                <Text className={cn(
                  "font-medium",
                  isCurrentUser ? "text-blue-700" : "text-gray-700"
                )}>
                  {user?.name} {isCurrentUser && '(אתה)'}
                </Text>
                
                <Text className={cn(
                  "font-semibold text-base",
                  balance.netBalance >= 0 ? "text-green-600" : "text-red-600"
                )}>
                  {balance.netBalance >= 0 ? '+' : ''}{formatCurrency(balance.netBalance)}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Active Debts */}
        <View className="bg-white rounded-2xl p-6 mb-6 shadow-sm">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-lg font-semibold text-gray-900">
              חובות פעילים
            </Text>
            {useSimplified && (
              <View className="bg-blue-100 px-3 py-1 rounded-full">
                <Text className="text-blue-700 text-sm font-medium">
                  מפושט
                </Text>
              </View>
            )}
          </View>
          
          {allDebts.length === 0 ? (
            <View className="items-center py-8">
              <Ionicons name="checkmark-circle-outline" size={48} color="#10b981" />
              <Text className="text-green-600 font-medium text-lg mt-2">
                אין חובות פתוחים! 🎉
              </Text>
              <Text className="text-gray-500 text-center mt-2">
                כל החובות מסולקים
              </Text>
            </View>
          ) : (
            allDebts.map((debt, index) => (
              <View key={`${debt.fromUserId}-${debt.toUserId}-${index}`} className="flex-row items-center justify-between py-4 border-b border-gray-100 last:border-b-0">
                <View className="flex-1">
                  <Text className="text-gray-900 font-medium">
                    {getUserName(debt.fromUserId)}
                  </Text>
                  <Text className="text-sm text-gray-500">
                    חייב ל{getUserName(debt.toUserId)}
                  </Text>
                </View>
                
                <View className="flex-row items-center">
                  <Text className="text-red-600 font-semibold text-lg mr-4">
                    {formatCurrency(debt.amount)}
                  </Text>
                  
                  <Pressable
                    onPress={() => handleSettleDebt(debt.fromUserId, debt.toUserId, debt.amount)}
                    disabled={isSettling}
                    className={cn(
                      "py-2 px-4 rounded-lg",
                      isSettling ? "bg-gray-300" : "bg-red-100"
                    )}
                  >
                    <Text className={cn(
                      "text-sm font-medium",
                      isSettling ? "text-gray-500" : "text-red-700"
                    )}>
                      {isSettling ? 'סוגר...' : 'סגור חוב'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Info Card */}
        <View className="bg-blue-50 rounded-2xl p-6">
          <View className="flex-row items-start">
            <Ionicons name="information-circle-outline" size={24} color="#3b82f6" />
            <View className="flex-1 mr-3">
              <Text className="text-blue-900 font-medium mb-2">
                איך זה עובד?
              </Text>
              <Text className="text-blue-700 text-sm leading-relaxed">
                {useSimplified 
                  ? 'מצב "פישוט חובות" מציג את המינימום של העברות הנדרש לסגירת כל החובות. זה מפחית את מספר התשלומים הנדרשים.'
                  : 'מצב רגיל מציג את כל החובות בנפרד, כפי שהם נוצרו מההוצאות השונות.'
                }
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Debt Settlement Modal */}
      {showSettlementModal && (
        <View className="absolute inset-0 bg-black/50 justify-center items-center px-6">
          <View className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <Text className="text-xl font-semibold text-gray-900 mb-4 text-center">
              סגירת חוב
            </Text>
            
            <Text className="text-gray-600 text-center mb-4">
              חוב מקורי: {formatCurrency(settlementOriginalAmount)}
            </Text>
            <Text className="text-gray-600 text-center mb-4">
              {getUserName(settlementFromUser)} ← {getUserName(settlementToUser)}
            </Text>

            <Text className="text-gray-700 mb-2">סכום לסגירה:</Text>
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
                disabled={isSettling}
                className={cn(
                  "flex-1 py-3 px-4 rounded-xl",
                  isSettling ? "bg-gray-400" : "bg-blue-500"
                )}
              >
                <Text className="text-white font-medium text-center">
                  {isSettling ? 'סוגר...' : 'אישור סגירה'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}
