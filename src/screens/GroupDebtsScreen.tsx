import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  Alert,
  Switch,
  Keyboard
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useStore } from '../state/store';
import { cn } from '../utils/cn';
import { firestoreService } from '../services/firestore-service';
import { Screen } from '../components/Screen';
import { useTranslation } from 'react-i18next';
import { AsyncButton } from '../components/AsyncButton';
import { getDisplayName } from '../utils/userDisplay';

type RootStackParamList = {
  Budget: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function GroupDebtsScreen() {
  const { t } = useTranslation();
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
    currentUser, 
    currentApartment, 
    getBalances, 
    getRawBalances,
    getSimplifiedBalances, 
    createAndCloseDebtAtomic,
    initializeDebtSystem,
    cleanupDebtSystem,
    loadExpenses
  } = useStore();


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
  }, [expenses, useSimplified, getRawBalances, getSimplifiedBalances]);

  const formatCurrency = (amount: number) => {
    // Show exact amount with up to 2 decimal places, no rounding
    if (amount === Math.floor(amount)) {
      return `₪${amount}`;
    }
    return `₪${amount.toFixed(2)}`;
  };

  const getUserName = (userId: string) => {
    if (userId === currentUser?.id) return t('common.you');
    const member = currentApartment?.members.find(m => m.id === userId);
    return getDisplayName(member) || t('cleaning.unknownUser');
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
      Alert.alert(t('debts.alerts.error'), t('debts.alerts.invalidAmount'));
      return;
    }

    // Prevent double-clicking
    if (isSettling) {
      return;
    }

    console.log('🔍 [GroupDebtsScreen] Starting debt settlement:', {
      fromUser: settlementFromUser,
      toUser: settlementToUser,
      amount,
      currentUser: currentUser?.id,
      currentApartment: currentApartment?.id
    });

    setIsSettling(true);

    try {
      // Use the new atomically transactional debt settlement that creates debts, monthlyExpenses, and updates balances
      const result = await createAndCloseDebtAtomic(
        settlementFromUser,
        settlementToUser,
        amount,
        `סגירת חוב`
      );

      console.log('✅ [GroupDebtsScreen] Debt settlement completed successfully:', result);

      setShowSettlementModal(false);
      setSettlementAmount('');
      setSettlementFromUser('');
      setSettlementToUser('');
      setSettlementOriginalAmount(0);
      
      // Show success message only after server confirms success
      if (result.success) {
        // Reload expenses to reflect the hidden debt settlement
        await loadExpenses();
        
        const creditorName = getUserName(settlementToUser);
        const debtorName = getUserName(settlementFromUser);
        const amount = parseFloat(settlementAmount);
        
        Alert.alert(t('debts.alerts.success'), t('debts.alerts.debtClosed', { to: creditorName, amount: formatCurrency(amount), from: debtorName }));
      } else {
        Alert.alert(t('debts.alerts.error'), t('debts.alerts.debtNotClosed'));
      }
      
    } catch (error: any) {
      console.error('❌ [GroupDebtsScreen] Error settling debt:', error);
      console.error('❌ [GroupDebtsScreen] Error details:', {
        name: error?.name,
        message: error?.message,
        code: error?.code,
        stack: error?.stack
      });
      
      // Show specific error messages based on error type
      let errorMessage = t('debts.alerts.debtNotClosed');
      
      if (error instanceof Error) {
        if (error.message.includes('PERMISSION_DENIED') || error.message.includes('permission-denied')) {
          errorMessage = t('debts.alerts.noPermission');
        } else if (error.message.includes('APARTMENT_NOT_FOUND')) {
          errorMessage = t('debts.alerts.apartmentNotFound');
        } else if (error.message.includes('DEBT_NOT_FOUND')) {
          errorMessage = t('debts.alerts.debtNotFound');
        } else if (error.message.includes('ALREADY_CLOSED')) {
          errorMessage = t('debts.alerts.alreadyClosed');
        } else if (error.message.includes('AUTH_REQUIRED')) {
          errorMessage = t('debts.alerts.authRequired');
        } else if (error.message.includes('INVALID_ARGUMENT')) {
          errorMessage = t('debts.alerts.invalidArgument');
        } else if (error.message.includes('CLOUD_FUNCTION_ERROR')) {
          errorMessage = t('debts.alerts.serverError');
        }
      }
      
      Alert.alert(t('debts.alerts.error'), errorMessage);
    } finally {
      setIsSettling(false);
    }
  };

  // Get all active debts for display - use the same system as balance summary
  const getAllDebts = () => {
    const debts: Array<{ fromUserId: string, toUserId: string, amount: number }> = [];
    
    balances.forEach(balance => {
      if (balance && balance.owes) {
        Object.entries(balance.owes).forEach(([toUserId, amount]) => {
          if (amount > 0.01) {
            debts.push({
              fromUserId: balance.userId,
              toUserId,
              amount
            });
          }
        });
      }
    });
    
    return debts.sort((a, b) => b.amount - a.amount);
  };

  const allDebts = getAllDebts();

  if (!currentUser || !currentApartment) {
    return (
      <View className="flex-1 bg-white justify-center items-center">
        <Text className="text-gray-500">{t('common.loading')}</Text>
      </View>
    );
  }

  return (
    <Screen withPadding={false} keyboardVerticalOffset={0} scroll={false}>
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
            {t('debts.title')}
          </Text>
          
          <View className="w-10" />
        </View>
        
        {/* Simplification Toggle */}
        <View className="flex-row items-center justify-between bg-gray-50 p-4 rounded-xl">
          <View>
            <Text className="text-gray-900 font-medium">
              {t('debts.simplify')}
            </Text>
            <Text className="text-sm text-gray-600">
              {useSimplified ? t('debts.simplifiedOn') : t('debts.simplifiedOff')}
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

      <ScrollView 
        className="flex-1 px-6 py-6"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        {/* Group Balance Summary */}
        <View className="bg-white rounded-2xl p-6 mb-6 shadow-sm">
          <Text className="text-lg font-semibold text-gray-900 mb-4">
            {t('debts.groupBalanceSummary')}
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
                  {getDisplayName(user)} {isCurrentUser && `(${t('common.you')})`}
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
              {t('debts.activeDebts')}
            </Text>
            {useSimplified && (
              <View className="bg-blue-100 px-3 py-1 rounded-full">
                <Text className="text-blue-700 text-sm font-medium">
                  {t('debts.simplifiedBadge')}
                </Text>
              </View>
            )}
          </View>
          
          {allDebts.length === 0 ? (
            <View className="items-center py-8">
              <Ionicons name="checkmark-circle-outline" size={48} color="#10b981" />
              <Text className="text-green-600 font-medium text-lg mt-2">
                {t('debts.noOpenDebtsTitle')}
              </Text>
              <Text className="text-gray-500 text-center mt-2">
                {t('debts.noOpenDebtsSubtitle')}
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
                    {t('debts.youOweTo', { to: getUserName(debt.toUserId) })}
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
                      {isSettling ? t('debts.modal.closing') : t('debts.closeDebt')}
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
                {t('debts.howItWorks')}
              </Text>
              <Text className="text-blue-700 text-sm leading-relaxed">
                {useSimplified ? t('debts.simplifiedExplain') : t('debts.regularExplain')}
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
              {t('debts.modal.title')}
            </Text>
            
            <Text className="text-gray-600 text-center mb-4">
              {t('debts.modal.youAreAboutToClose', { amount: formatCurrency(settlementOriginalAmount), to: getUserName(settlementToUser) })}
            </Text>
            <Text className="text-gray-600 text-center mb-4">
              {t('debts.modal.direction', { from: getUserName(settlementFromUser), to: getUserName(settlementToUser) })}
            </Text>

            <Text className="text-gray-700 mb-2">{t('debts.modal.amountToClose')}</Text>
            <View className="flex-row items-center mb-6">
              <TextInput
                value={settlementAmount}
                onChangeText={setSettlementAmount}
                placeholder="0"
                className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-base"
                keyboardType="numeric"
                textAlign="center"
                returnKeyType="done"
                onSubmitEditing={() => Keyboard.dismiss()}
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
                  {t('debts.modal.cancel')}
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
                  {isSettling ? t('debts.modal.closing') : t('debts.modal.confirm')}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </Screen>
  );
}
