import React, { useEffect, useMemo, useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Modal,
  FlatList,
  Alert,
  Share,
  Platform,
  Animated,
  Dimensions,
  StyleSheet,
  I18nManager,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedCard } from '../theme/components/ThemedCard';
import { ThemedText } from '../theme/components/ThemedText';
import { ThemedView } from '../theme/components/ThemedView';
import { useThemedStyles } from '../theme/useThemedStyles';
import { useTheme } from '../theme/ThemeProvider';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useStore } from '../state/store';
import { cn } from '../utils/cn';
import { getUserDisplayInfo, getDisplayName } from '../utils/userDisplay';
import { impactMedium, impactLight, selection } from '../utils/haptics';
import AddExpenseModal from '../components/AddExpenseModal';
import { useTranslation } from 'react-i18next';
import { useIsRTL } from '../hooks/useIsRTL';
import i18n from '../i18n';

type RootStackParamList = {
  Settings: undefined;
  Shopping: undefined;
  AddExpense: undefined;
  Budget: undefined;
  Cleaning: undefined;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;


export default function DashboardScreen() {
  const { theme, activeScheme } = useTheme();
  const isRTL = useIsRTL();
  
  // Debug: Check RTL status
  console.log('Dashboard RTL Debug:', { 
    isRTL, 
    I18nManagerIsRTL: I18nManager.isRTL,
    language: i18n.language 
  });
  
  const themed = useThemedStyles(tk => ({
    surfaceBg: { backgroundColor: tk.colors.surface },
    textSecondary: { color: tk.colors.text.secondary },
    backgroundBg: { backgroundColor: tk.colors.background },
    closeButtonBg: { backgroundColor: tk.colors.surface },
  }));
  const { t } = useTranslation();
  const appLanguage = useStore(s => s.appLanguage);
  const navigation = useNavigation<NavigationProp>();
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [showHighlightsModal, setShowHighlightsModal] = useState(false);
  const [timeRange, setTimeRange] = useState<'all' | 'year' | 'month' | '30days'>('all');
  
  // Add Expense Modal State
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  
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
    loadCleaningChecklist,
    loadCleaningStats,
    cleaningStats,
    backfillCleaningStats
  } = useStore();

  // Load all data from Firestore when component mounts (OPTIMIZED to reduce reads)
  useEffect(() => {
    const loadAllData = async () => {
      try {
        console.log('🔄 Dashboard: Loading all data from Firestore...');
        
        // Load apartment members only if needed
        if (currentApartment) {
          await refreshApartmentMembers();
        }
        
        // Load only essential data on mount - other data loads on focus
        await Promise.all([
          loadExpenses(),
          loadDebtSettlements(),
        ]);

        // Backfill cleaning stats if needed (one-time migration)
        await backfillCleaningStats();
        
        console.log('✅ Dashboard: Essential data loaded successfully');
      } catch (error) {
        console.error('❌ Dashboard: Error loading data:', error);
      }
    };

    loadAllData();
  }, [currentApartment?.id]); // Only reload when apartment actually changes

  // Refresh data when screen comes into focus (OPTIMIZED to reduce Firestore reads)
  useFocusEffect(useCallback(() => {
    const refreshData = async () => {
      try {
        console.log('🔄 Dashboard: Refreshing data on focus...');
        // Load additional data that wasn't loaded on mount
        await Promise.all([
          loadShoppingItems(),
          loadCleaningTask(),
          loadCleaningChecklist(),
          loadCleaningStats(),
        ]);
        console.log('✅ Dashboard: Additional data loaded successfully');
      } catch (error) {
        console.error('❌ Dashboard: Error refreshing data:', error);
      }
    };

    // Load additional data when screen comes into focus
    refreshData();

    // REMOVED: Polling every 15 seconds to reduce Firestore reads
    // This was causing excessive reads - now only refreshes on focus

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [])); // REMOVED dependencies to prevent unnecessary re-runs

  const balances = useMemo(() => getBalances(), [expenses, debtSettlements]);
  const myBalance = balances.find(b => b.userId === currentUser?.id);

  // Quick Stats Calculations
  const monthlyExpenses = useMemo(() => {
    const now = new Date();
    const thisMonth = expenses.filter(expense => {
      try {
        // Skip hidden debt settlement expenses
        if (expense.isHiddenDebtSettlement) {
          return false;
        }
        
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
  const totalExpenses = expenses
    .filter(expense => !expense.isHiddenDebtSettlement)
    .reduce((sum, expense) => sum + expense.amount, 0);
  
  // Calculate cleaning count using reliable statistics
  const cleaningCount = useMemo(() => {
    // Use real cleaning stats if available
    if (cleaningStats) {
      return cleaningStats.totalCleans || 0;
    }
    
    // Fallback to old calculation if stats not loaded yet
    if (!cleaningTask || !currentApartment) return 0;
    
    // If there's only one member, count based on last_completed_at
    if (currentApartment.members.length === 1) {
      return cleaningTask.last_completed_at ? 1 : 0;
    }
    
    // For multiple members, estimate based on queue position and completion history
    if (cleaningTask.last_completed_at && cleaningTask.queue && cleaningTask.queue.length > 0) {
      const currentIndex = cleaningTask.queue.findIndex(userId => userId === (cleaningTask as any).user_id);
      const queueLength = cleaningTask.queue.length;
      
      // Calculate estimated cleanings based on queue rotations
      // Each time the queue rotates, it means queue.length cleanings were completed
      let estimatedCleanings = 0;
      
      // If we have a last_completed_at, we know at least one cleaning was done
      if (cleaningTask.last_completed_at) {
        estimatedCleanings = 1;
        
        // Add cleanings based on queue position
        // If currentIndex > 0, it means the queue has rotated at least once
        if (currentIndex > 0) {
          // Each rotation means queue.length cleanings were completed
          const fullRotations = Math.floor(currentIndex / queueLength);
          const partialRotation = currentIndex % queueLength;
          
          estimatedCleanings += fullRotations * queueLength + partialRotation;
        }
      }
      
      return Math.max(estimatedCleanings, 0);
    }
    
    return 0;
  }, [cleaningStats, cleaningTask, currentApartment]);
  
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

    // Filter expenses by time range and exclude hidden debt settlement expenses
    const now = new Date();
    let filteredExpenses = expenses.filter(expense => !expense.isHiddenDebtSettlement);
    
    switch (timeRange) {
      case '30days':
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        filteredExpenses = filteredExpenses.filter(expense => {
          const expenseDate = new Date(expense.date);
          return expenseDate >= thirtyDaysAgo;
        });
        break;
      case 'month':
        filteredExpenses = filteredExpenses.filter(expense => {
          const expenseDate = new Date(expense.date);
          return expenseDate.getMonth() === now.getMonth() && 
                 expenseDate.getFullYear() === now.getFullYear();
        });
        break;
      case 'year':
        filteredExpenses = filteredExpenses.filter(expense => {
          const expenseDate = new Date(expense.date);
          return expenseDate.getFullYear() === now.getFullYear();
        });
        break;
      case 'all':
      default:
        // filteredExpenses already has hidden expenses filtered out
        break;
    }

    const totalExpenses = filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0);

    // King of Expenses - who paid the most (only current members)
    const currentMemberIds = new Set(currentApartment.members.map(m => m.id));
    const expensesByUser = filteredExpenses
      .filter(expense => currentMemberIds.has(expense.paidBy))
      .reduce((acc, expense) => {
        acc[expense.paidBy] = (acc[expense.paidBy] || 0) + expense.amount;
        return acc;
      }, {} as Record<string, number>);

    const kingOfExpenses = Object.entries(expensesByUser)
      .sort(([,a], [,b]) => b - a)[0];

    // Shopping King - who bought the most items (filter by time range and current members)
    const shoppingByUser = shoppingItems
      .filter(item => {
        if (!item.purchased || !item.purchasedBy) return false;
        
        // Only include current members
        if (!currentMemberIds.has(item.purchasedBy)) return false;
        
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

    // Cleaning King - who did the most cleanings (filter by time range and current members)
    const cleaningByUser = (() => {
      const result: Record<string, number> = {};
      
      // Use real cleaning stats if available (for 'all' time range)
      if (cleaningStats && timeRange === 'all') {
        // Filter by current members only
        Object.entries(cleaningStats.perUser || {}).forEach(([userId, count]) => {
          if (currentMemberIds.has(userId)) {
            result[userId] = count;
          }
        });
        return result;
      }
      
      // Fallback to old calculation for specific time ranges
      // Add cleaning counts from old history system if available
      if (cleaningTask?.history) {
        cleaningTask.history
          .filter(entry => {
            if (!entry.userId) return false;
            
            // Only include current members
            if (!currentMemberIds.has(entry.userId)) return false;
            
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
          .forEach(entry => {
            result[entry.userId!] = (result[entry.userId!] || 0) + 1;
          });
      }
      
      // Add last cleaning from new system if it matches time range
      if (cleaningTask?.last_completed_at && cleaningTask?.last_completed_by) {
        const completionDate = new Date(cleaningTask.last_completed_at);
        let includeLastCleaning = false;
        
        switch (timeRange) {
          case '30days':
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            includeLastCleaning = completionDate >= thirtyDaysAgo;
            break;
          case 'month':
            includeLastCleaning = completionDate.getMonth() === now.getMonth() && 
                                 completionDate.getFullYear() === now.getFullYear();
            break;
          case 'year':
            includeLastCleaning = completionDate.getFullYear() === now.getFullYear();
            break;
          case 'all':
          default:
            includeLastCleaning = true;
        }
        
        if (includeLastCleaning && currentMemberIds.has(cleaningTask.last_completed_by)) {
          result[cleaningTask.last_completed_by] = (result[cleaningTask.last_completed_by] || 0) + 1;
        }
      }
      
      return result;
    })();

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

    // Calculate average per member based on actual shares of CURRENT members only
    // Each member's share = total expenses / number of participants in each expense
    const memberShares = new Map<string, number>();
    
    filteredExpenses.forEach(expense => {
      const sharePerPerson = expense.amount / expense.participants.length;
      expense.participants.forEach(participantId => {
        // Only count shares for current apartment members
        if (currentMemberIds.has(participantId)) {
          memberShares.set(participantId, (memberShares.get(participantId) || 0) + sharePerPerson);
        }
      });
    });
    
    // Calculate average share across all current members only
    const currentMemberShares = Array.from(memberShares.entries())
      .filter(([memberId]) => currentMemberIds.has(memberId))
      .map(([, share]) => share);
    
    const totalCurrentMemberShares = currentMemberShares.reduce((sum, share) => sum + share, 0);
    const averagePerMember = currentApartment.members.length > 0 ? 
      totalCurrentMemberShares / currentApartment.members.length : 0;

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
    return currentApartment.members.find(member => member.id === (cleaningTask as any).user_id);
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
    
    // Check if user is still a member of the apartment
    const member = currentApartment?.members.find(m => m.id === userId);
    if (member) {
      return getDisplayName(member);
    }
    
    // If user is not a member anymore, show "לא ידוע" instead of "אורח"
    return t('common.unknown');
  };

  const currentTurnUser = getCurrentTurnUser();
  const isMyTurn = currentUser && cleaningTask && (cleaningTask as any).user_id === currentUser.id;


  // Share highlights function
  const shareHighlights = async () => {
    try {
      const timeRangeText = timeRange === 'all' ? t('dashboard.allTime') : 
                           timeRange === 'year' ? t('dashboard.thisYear') :
                           timeRange === 'month' ? t('dashboard.thisMonth') : t('dashboard.last30Days');

      let shareText = t('dashboard.shareTextHeader', { timeRange: timeRangeText }) + '\n\n';
      
      shareText += t('dashboard.shareTextTotalExpenses', { amount: formatCurrency(highlightsStats.totalExpenses) }) + '\n';
      
      if (highlightsStats.kingOfExpenses) {
        const kingName = highlightsStats.kingOfExpenses.userId === currentUser?.id 
          ? getDisplayName(currentUser) 
          : getUserName(highlightsStats.kingOfExpenses.userId);
        shareText += t('dashboard.shareTextKingOfExpenses', { 
          name: kingName, 
          amount: formatCurrency(highlightsStats.kingOfExpenses.amount) 
        }) + '\n';
      }
      
      if (highlightsStats.shoppingKing) {
        const shoppingKingName = highlightsStats.shoppingKing.userId === currentUser?.id 
          ? getDisplayName(currentUser) 
          : getUserName(highlightsStats.shoppingKing.userId);
        shareText += t('dashboard.shareTextShoppingKing', { 
          name: shoppingKingName, 
          count: highlightsStats.shoppingKing.count 
        }) + '\n';
      }
      
      if (highlightsStats.cleaningKing) {
        const cleaningKingName = highlightsStats.cleaningKing.userId === currentUser?.id 
          ? getDisplayName(currentUser) 
          : getUserName(highlightsStats.cleaningKing.userId);
        shareText += t('dashboard.shareTextCleaningKing', { 
          name: cleaningKingName, 
          count: highlightsStats.cleaningKing.count 
        }) + '\n';
      }
      
      if (highlightsStats.biggestExpenseLast30Days) {
        shareText += t('dashboard.shareTextBiggestExpense', { 
          amount: formatCurrency(highlightsStats.biggestExpenseLast30Days.amount),
          title: highlightsStats.biggestExpenseLast30Days.title
        }) + '\n';
      }
      
      shareText += '\n' + t('dashboard.shareTextFooter');

      await Share.share({
        message: shareText,
        title: t('dashboard.shareModalTitle'),
      });
    } catch (error) {
      console.error('Error sharing highlights:', error);
      Alert.alert(t('common.error'), t('dashboard.alerts.cannotShare'));
    }
  };

  return (
    <View className="flex-1" style={themed.backgroundBg}>
      <ThemedCard className="px-6 pt-20 pb-6 shadow-sm">
        <View 
          className="items-center justify-between mb-2"
          style={{ 
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center'
          }}
        >
          <ThemedText className="text-2xl font-bold flex-1">
            {t('dashboard.greeting', { name: getDisplayName(currentUser) })}
          </ThemedText>
          <Pressable
            onPress={() => {
              impactLight(); // Haptic feedback for settings navigation
              navigation.navigate('Settings');
            }}
            className="w-10 h-10 rounded-full items-center justify-center"
            style={themed.surfaceBg}
          >
            <Ionicons name="person-outline" size={20} color={theme.colors.text.secondary} />
          </Pressable>
        </View>
        <ThemedText style={themed.textSecondary}>
          {currentApartment?.name || t('dashboard.apartmentFallback')}
        </ThemedText>
      </ThemedCard>

      <ScrollView className="flex-1 px-6 py-6">
        {/* Quick Actions */}
      <View className="flex-row justify-center gap-4 mb-6">
          <Pressable
            onPress={() => {
              impactMedium(); // Haptic feedback for shopping action
              navigation.navigate('Shopping');
            }}
            className="bg-blue-500 rounded-full px-8 py-4 shadow-lg active:scale-95"
            style={{
              shadowColor: '#3b82f6',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.3,
              shadowRadius: 4,
              elevation: 4,
            }}
          >
            <View className="flex-row items-center">
              <Ionicons name="basket-outline" size={22} color="white" />
              <ThemedText className="font-medium text-base" style={{ marginStart: 8, color: '#ffffff' }}>{t('dashboard.actionShopping')}</ThemedText>
            </View>
          </Pressable>
          
          <Pressable
            onPress={() => {
              impactMedium(); // Haptic feedback for add expense action
              setShowAddExpenseModal(true);
            }}
            className="bg-green-500 rounded-full px-8 py-4 shadow-lg active:scale-95"
            style={{
              shadowColor: '#10b981',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.3,
              shadowRadius: 4,
              elevation: 4,
            }}
          >
            <View className="flex-row items-center">
              <Ionicons name="add-circle-outline" size={22} color="white" />
              <ThemedText className="font-medium text-base" style={{ marginStart: 8, color: '#ffffff' }}>{t('dashboard.actionAddExpense')}</ThemedText>
            </View>
          </Pressable>
        </View>

        {/* Quick Stats Cards */}
        <View className="flex-row flex-wrap mb-6 gap-3">
          {/* My Balance */}
          <Pressable
            onPress={() => {
              impactLight(); // Haptic feedback for budget navigation
              navigation.navigate('Budget');
            }}
            className="w-[48%] mb-2"
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 3,
            }}
          >
            <ThemedCard className="p-4 rounded-2xl">
              <View 
                className="items-center mb-2"
                style={{ 
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center'
                }}
              >
                <Ionicons name="wallet-outline" size={20} color={theme.colors.text.secondary} />
                <ThemedText className="text-sm flex-1" style={[themed.textSecondary, { marginStart: isRTL ? 0 : 8, marginEnd: isRTL ? 8 : 0 }]}>{t('dashboard.cardMyBalance')}</ThemedText>
              </View>
              <ThemedText className={cn(
                "text-2xl font-bold",
                (myBalance?.netBalance ?? 0) >= 0 ? "text-green-600" : "text-red-600"
              )}>
                {myBalance ? formatCurrency(Math.abs(myBalance.netBalance ?? 0)) : '₪0'}
              </ThemedText>
              <ThemedText className="text-xs" style={themed.textSecondary}>
                {(myBalance?.netBalance ?? 0) >= 0 ? t('dashboard.comesToYou') : t('dashboard.youOwe')}
              </ThemedText>
            </ThemedCard>
          </Pressable>

          {/* Cleaning Turn */}
          <Pressable
            onPress={() => {
              impactLight(); // Haptic feedback for cleaning navigation
              navigation.navigate('Cleaning');
            }}
            className="w-[48%] mb-2"
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 3,
            }}
          >
            <ThemedCard className="p-4 rounded-2xl">
              <View 
                className="items-center mb-2"
                style={{ 
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center'
                }}
              >
                <Ionicons name="brush-outline" size={20} color={theme.colors.text.secondary} />
                <ThemedText className="text-sm flex-1" style={[themed.textSecondary, { marginStart: isRTL ? 0 : 8, marginEnd: isRTL ? 8 : 0 }]}>{t('dashboard.cleaningTurn')}</ThemedText>
              </View>
              <ThemedText className="text-lg font-bold">
                {getDisplayName(currentTurnUser) || t('common.unknown')}
              </ThemedText>
              <ThemedText className={cn(
                "text-xs",
                isMyTurn ? "text-blue-600" : ""
              )} style={!isMyTurn ? themed.textSecondary : undefined}>
                {isMyTurn ? t('dashboard.yourTurn') : t('dashboard.theirTurn')}
              </ThemedText>
            </ThemedCard>
          </Pressable>

          {/* Shopping Items */}
          <Pressable
            onPress={() => {
              impactLight(); // Haptic feedback for shopping navigation
              navigation.navigate('Shopping');
            }}
            className="w-[48%] mb-2"
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 3,
            }}
          >
            <ThemedCard className="p-4 rounded-2xl">
              <View 
                className="items-center mb-2"
                style={{ 
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center'
                }}
              >
                <Ionicons name="basket-outline" size={20} color={theme.colors.text.secondary} />
                <ThemedText className="text-sm flex-1" style={[themed.textSecondary, { marginStart: isRTL ? 0 : 8, marginEnd: isRTL ? 8 : 0 }]}>{t('dashboard.toBuy')}</ThemedText>
              </View>
              <ThemedText className="text-2xl font-bold">
                {pendingShoppingItems.length}
              </ThemedText>
            </ThemedCard>
          </Pressable>

          {/* Roommates */}
          <Pressable
            onPress={() => {
              impactLight(); // Haptic feedback for settings navigation
              navigation.navigate('Settings');
            }}
            className="w-[48%] mb-2"
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 4,
              elevation: 3,
            }}
          >
            <ThemedCard className="p-4 rounded-2xl">
              <View 
                className="items-center mb-2"
                style={{ 
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center'
                }}
              >
                <Ionicons name="people-outline" size={20} color={theme.colors.text.secondary} />
                <ThemedText className="text-sm flex-1" style={[themed.textSecondary, { marginStart: isRTL ? 0 : 8, marginEnd: isRTL ? 8 : 0 }]}>{t('dashboard.roommates')}</ThemedText>
              </View>
              <ThemedText className="text-2xl font-bold">
                {currentApartment?.members.length || 0}
              </ThemedText>
              <View 
                className="mt-1"
                style={{ 
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center'
                }}
              >
                {currentApartment?.members.slice(0, 3).map((member, index) => (
                  <View
                    key={member.id}
                    className={cn(
                      "w-5 h-5 rounded-full items-center justify-center",
                      index > 0 && (isRTL ? "-ml-1" : "-mr-1"),
                      activeScheme === 'dark' ? "bg-gray-700" : "bg-blue-100"
                    )}
                  >
                    <ThemedText 
                      className="text-xs font-medium"
                      style={{ 
                        color: activeScheme === 'dark' ? '#ffffff' : '#1d4ed8' 
                      }}
                    >
                      {getUserDisplayInfo(member).initial}
                    </ThemedText>
                  </View>
                ))}
              </View>
            </ThemedCard>
          </Pressable>
        </View>

        {/* My Debts */}
        <ThemedCard className="rounded-2xl p-6 mb-6 shadow-lg"
          style={{
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3,
          }}
        >
          <ThemedText className="text-lg font-semibold mb-4" style={{ color: theme.colors.text.primary, textAlign: 'center' }}>
            {t('dashboard.myDebts')}
          </ThemedText>
          
          {myBalance && myBalance.owed && myBalance.owes && (
            <View>
              {/* Who owes me */}
              {Object.entries(myBalance.owed)
                .filter(([_, amount]) => amount > 0)
                .slice(0, 3)
                .map(([userId, amount]) => (
                <View 
                  key={`owed-${userId}`} 
                  className="items-center py-2"
                  style={{ 
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <ThemedText className="flex-1" style={themed.textSecondary}>
                    {t('dashboard.owesYou', { name: getUserName(userId) })}
                  </ThemedText>
                  <ThemedText className="font-medium" style={{ color: '#16a34a' }}>
                    {formatCurrency(amount)}
                  </ThemedText>
                </View>
              ))}
              
              {/* Who I owe */}
              {Object.entries(myBalance.owes)
                .filter(([_, amount]) => amount > 0)
                .slice(0, 3)
                .map(([userId, amount]) => (
                <View 
                  key={`owes-${userId}`} 
                  className="items-center py-2"
                  style={{ 
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <ThemedText className="flex-1" style={themed.textSecondary}>
                    {t('dashboard.youOweTo', { name: getUserName(userId) })}
                  </ThemedText>
                  <ThemedText className="font-medium" style={{ color: '#dc2626' }}>
                    {formatCurrency(amount)}
                  </ThemedText>
                </View>
              ))}

              {Object.keys(myBalance.owed).length === 0 && Object.keys(myBalance.owes).length === 0 && (
                <Text style={{ textAlign: 'center', color: themed.textSecondary.color }} className="py-4 w-full">
                  {t('dashboard.allCleared')}
                </Text>
              )}

              <Pressable
                onPress={() => navigation.navigate('Budget')}
                className="bg-blue-100 py-2 px-4 rounded-xl mt-3"
              >
                <Text style={{ textAlign: 'center', color: '#1d4ed8' }} className="font-medium w-full">
                  {t('dashboard.showAll')}
                </Text>
              </Pressable>
            </View>
          )}

          {myBalance && (!myBalance.owed || !myBalance.owes) && (
            <Text style={{ textAlign: 'center', color: themed.textSecondary.color }} className="py-4 w-full">
              {t('dashboard.loadingDebts')}
            </Text>
          )}

          {!myBalance && (
            <Text style={{ textAlign: 'center', color: themed.textSecondary.color }} className="py-4 w-full">
              {t('dashboard.noDebtsData')}
            </Text>
          )}
        </ThemedCard>


        {/* Quick Look Button */}
        <View className="items-center mt-4">
          <Pressable
            onPress={() => setShowHighlightsModal(true)}
            className="bg-orange-500 rounded-full px-8 py-4 shadow-lg active:scale-95"
            accessibilityLabel={`🔍 ${t('dashboard.quickLook')}`}
            accessibilityHint={t('dashboard.quickLook')}
            style={{
              shadowColor: '#f97316',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 8,
            }}
          >
            <View 
              className="items-center"
              style={{ 
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center'
              }}
            >
              <ThemedText className="text-lg font-semibold" style={{ marginStart: isRTL ? 0 : 8, marginEnd: isRTL ? 8 : 0, color: '#ffffff' }}>
                {t('dashboard.quickLook')}
              </ThemedText>
              <ThemedText className="text-xl">🔍</ThemedText>
            </View>
          </Pressable>
        </View>
      </ScrollView>

      {/* Highlights Modal */}
      <Modal
        visible={showHighlightsModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowHighlightsModal(false)}
      >
        <ThemedView className="flex-1" style={themed.surfaceBg}>
          {/* Header */}
          <ThemedCard className="px-6 pt-20 pb-6 shadow-sm">
            <View className="flex-row items-center mb-4">
              <Pressable
                onPress={() => setShowHighlightsModal(false)}
                className="w-10 h-10 rounded-full items-center justify-center"
                style={themed.surfaceBg}
              >
                <Ionicons name="arrow-forward" size={24} color={themed.textSecondary.color} />
              </Pressable>
              
              <Text style={{ textAlign: 'center' }} className="text-2xl font-bold flex-1 w-full">
                {t('dashboard.highlightsTitle')}
              </Text>
            </View>
          </ThemedCard>

          <ScrollView className="flex-1 px-6 py-6">
            {/* Time Range Filter */}
            <ThemedCard 
              className="rounded-2xl p-4 mb-6 shadow-sm"
              style={activeScheme === 'dark' ? { borderColor: theme.colors.border.primary, borderWidth: StyleSheet.hairlineWidth } : undefined}
            >
              <ThemedText className="text-sm mb-3" style={themed.textSecondary}>{t('dashboard.timeRange')}</ThemedText>
              <View className="flex-row gap-2">
                {[
                  { key: 'all', label: t('dashboard.allTime') },
                  { key: 'year', label: t('dashboard.thisYear') },
                  { key: 'month', label: t('dashboard.thisMonth') },
                  { key: '30days', label: t('dashboard.last30Days') }
                ].map((option) => (
                  <Pressable
                    key={option.key}
                    onPress={() => setTimeRange(option.key as any)}
                    className={cn(
                      "flex-1 py-2 px-3 rounded-lg",
                      timeRange === option.key 
                        ? "bg-blue-500" 
                        : ""
                    )}
                    style={timeRange !== option.key ? themed.surfaceBg : undefined}
                  >
                    <Text style={{ textAlign: 'center', color: timeRange === option.key ? '#ffffff' : themed.textSecondary.color }} className="text-sm font-medium w-full">
                      {option.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ThemedCard>

            {/* Statistics Cards */}
            <View className="space-y-4">
              {/* Total Spent & King of Expenses */}
              <View className="flex-row gap-4">
                <ThemedCard 
                  className="flex-1 rounded-2xl p-6 shadow-sm"
                  style={activeScheme === 'dark' ? { borderColor: theme.colors.border.primary, borderWidth: StyleSheet.hairlineWidth } : undefined}
                >
                  <ThemedText className="text-sm mb-2" style={themed.textSecondary}>{t('dashboard.totalExpenses')}</ThemedText>
                  <ThemedText className="text-2xl font-bold mb-1" style={{ color: '#2563eb' }}>
                    {formatCurrency(highlightsStats.totalExpenses)}
                  </ThemedText>
                  <ThemedText className="text-xs" style={themed.textSecondary}>
                    ({timeRange === 'all' ? t('dashboard.allTime') : 
                      timeRange === 'year' ? t('dashboard.thisYear') :
                      timeRange === 'month' ? t('dashboard.thisMonth') : t('dashboard.last30Days')})
                  </ThemedText>
                </ThemedCard>
                
                <ThemedCard 
                  className="flex-1 rounded-2xl p-6 shadow-sm"
                  style={activeScheme === 'dark' ? { borderColor: theme.colors.border.primary, borderWidth: StyleSheet.hairlineWidth } : undefined}
                >
                  <ThemedText className="text-sm mb-2" style={themed.textSecondary}>{t('dashboard.kingOfExpenses')}</ThemedText>
                  {highlightsStats.kingOfExpenses ? (
                    <>
                      <ThemedText className="text-lg font-bold mb-1" style={{ color: '#ca8a04' }}>
                        {getUserName(highlightsStats.kingOfExpenses.userId)}
                      </ThemedText>
                      <ThemedText className="text-sm" style={themed.textSecondary}>
                        {formatCurrency(highlightsStats.kingOfExpenses.amount)}
                      </ThemedText>
                      <ThemedText className="text-xs" style={themed.textSecondary}>
                        {t('dashboard.percentageOfTotal', { percentage: highlightsStats.kingOfExpenses.percentage.toFixed(1) })}
                      </ThemedText>
                      <ThemedText className="text-xs mt-1" style={themed.textSecondary}>
                        {t('dashboard.giveHimCrown')}
                      </ThemedText>
                    </>
                  ) : (
                    <ThemedText style={themed.textSecondary}>{t('dashboard.noData')}</ThemedText>
                  )}
                </ThemedCard>
              </View>

              {/* Cleanings Done & Shopping King */}
              <View className="flex-row gap-4">
                <ThemedCard 
                  className="flex-1 rounded-2xl p-6 shadow-sm"
                  style={activeScheme === 'dark' ? { borderColor: theme.colors.border.primary, borderWidth: StyleSheet.hairlineWidth } : undefined}
                >
                  <ThemedText className="text-sm mb-2" style={themed.textSecondary}>{t('dashboard.cleaningsDone')}</ThemedText>
                  <ThemedText className="text-2xl font-bold mb-1" style={{ color: '#16a34a' }}>
                    {cleaningStats ? cleaningCount : '—'}
                  </ThemedText>
                  <ThemedText className="text-xs" style={themed.textSecondary}>
                    {t('dashboard.totalCleaningsCounter')}
                  </ThemedText>
                </ThemedCard>
                
                <ThemedCard 
                  className="flex-1 rounded-2xl p-6 shadow-sm"
                  style={activeScheme === 'dark' ? { borderColor: theme.colors.border.primary, borderWidth: StyleSheet.hairlineWidth } : undefined}
                >
                  <ThemedText className="text-sm mb-2" style={themed.textSecondary}>{t('dashboard.shoppingChampion')}</ThemedText>
                  {highlightsStats.shoppingKing ? (
                    <>
                      <ThemedText className="text-lg font-bold mb-1" style={{ color: '#ea580c' }}>
                        {getUserName(highlightsStats.shoppingKing.userId)}
                      </ThemedText>
                      <ThemedText className="text-sm" style={themed.textSecondary}>
                        {t('dashboard.itemsCount', { count: highlightsStats.shoppingKing.count })}
                      </ThemedText>
                      <ThemedText className="text-xs" style={themed.textSecondary}>
                        {t('dashboard.shopLikeNoTomorrow')}
                      </ThemedText>
                    </>
                  ) : (
                    <ThemedText style={themed.textSecondary}>{t('dashboard.noData')}</ThemedText>
                  )}
                </ThemedCard>
              </View>

              {/* Biggest Expense & Average */}
              <View className="flex-row gap-4">
                <ThemedCard 
                  className="flex-1 rounded-2xl p-6 shadow-sm"
                  style={activeScheme === 'dark' ? { borderColor: theme.colors.border.primary, borderWidth: StyleSheet.hairlineWidth } : undefined}
                >
                  <ThemedText className="text-sm mb-2" style={themed.textSecondary}>
                    {t('dashboard.biggestExpense', { range: timeRange === '30days' ? '(30)' : 
                      timeRange === 'month' ? `(${t('dashboard.thisMonth')})` :
                      timeRange === 'year' ? `(${t('dashboard.thisYear')})` : `(${t('dashboard.allTime')})` })}
                  </ThemedText>
                  {highlightsStats.biggestExpenseLast30Days ? (
                    <>
                      <ThemedText className="text-lg font-bold mb-1" style={{ color: '#dc2626' }}>
                        {formatCurrency(highlightsStats.biggestExpenseLast30Days.amount)}
                      </ThemedText>
                      <ThemedText className="text-sm" style={themed.textSecondary}>
                        {highlightsStats.biggestExpenseLast30Days.title}
                      </ThemedText>
                    </>
                  ) : (
                    <ThemedText style={themed.textSecondary}>{t('dashboard.noExpensesLastMonth')}</ThemedText>
                  )}
                </ThemedCard>
                
                <ThemedCard 
                  className="flex-1 rounded-2xl p-6 shadow-sm"
                  style={activeScheme === 'dark' ? { borderColor: theme.colors.border.primary, borderWidth: StyleSheet.hairlineWidth } : undefined}
                >
                  <ThemedText className="text-sm mb-2" style={themed.textSecondary}>{t('dashboard.avgPerMember')}</ThemedText>
                  <ThemedText className="text-lg font-bold mb-1" style={{ color: '#9333ea' }}>
                    {formatCurrency(highlightsStats.averagePerMember)}
                  </ThemedText>
                  <ThemedText className="text-xs" style={themed.textSecondary}>{t('dashboard.perMonth')}</ThemedText>
                </ThemedCard>
              </View>
            </View>

            {/* No Data State */}
            {highlightsStats.totalExpenses === 0 && (
              <ThemedCard 
                className="rounded-2xl p-8 items-center shadow-sm mt-6"
                style={activeScheme === 'dark' ? { borderColor: theme.colors.border.primary, borderWidth: StyleSheet.hairlineWidth } : undefined}
              >
                <Ionicons name="stats-chart-outline" size={64} color={themed.textSecondary.color} />
                <ThemedText className="text-lg font-medium mt-4 mb-2">
                  {t('dashboard.noData')}
                </ThemedText>
                <Text style={{ textAlign: 'center', color: themed.textSecondary.color }} className="w-full">
                  {t('dashboard.startShoppingCleaning')}
                </Text>
              </ThemedCard>
            )}

            {/* Action Buttons */}
            <View className="flex-row mt-8 gap-4">
              <Pressable
                onPress={() => setShowHighlightsModal(false)}
                className="flex-1 py-4 px-6 rounded-xl"
                style={themed.closeButtonBg}
              >
                <Text style={{ textAlign: 'center', color: themed.textSecondary.color }} className="font-medium w-full">
                  {t('dashboard.close')}
                </Text>
              </Pressable>
              
              <Pressable
                onPress={shareHighlights}
                className="flex-1 bg-blue-500 py-4 px-6 rounded-xl"
              >
                <Text style={{ textAlign: 'center', color: '#ffffff' }} className="font-medium w-full">
                  {t('dashboard.share')}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        </ThemedView>
      </Modal>

      {/* Add Expense Modal */}
      <AddExpenseModal
        visible={showAddExpenseModal}
        onClose={() => setShowAddExpenseModal(false)}
        title={t('dashboard.actionAddExpense')}
      />
    </View>
  );
}