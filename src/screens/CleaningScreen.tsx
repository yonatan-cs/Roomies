import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, RefreshControl, I18nManager } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useStore } from '../state/store';
import { cn } from '../utils/cn';
import { isTurnCompletedForCurrentCycleWithSettings, getCurrentCycleWithSettings } from '../utils/dateUtils';
import ConfirmModal from '../components/ConfirmModal';
import { User } from '../types';
import { Screen } from '../components/Screen';
import { AsyncButton } from '../components/AsyncButton';
import { useTranslation } from 'react-i18next';
import { impactLight, success } from '../utils/haptics';
import { useIsRTL } from '../hooks/useIsRTL';
import { getDisplayName } from '../utils/userDisplay';
import { ThemedCard } from '../theme/components/ThemedCard';
import { ThemedText } from '../theme/components/ThemedText';
import { useThemedStyles } from '../theme/useThemedStyles';
import { getTaskLabel } from '../utils/taskLabel';


export default function CleaningScreen() {
  const { t } = useTranslation();
  const isRTL = useIsRTL();
  const themed = useThemedStyles(tk => ({
    surfaceBg: { backgroundColor: tk.colors.surface },
    textPrimary: { color: tk.colors.text.primary },
    textSecondary: { color: tk.colors.text.secondary },
    borderColor: { borderColor: tk.colors.border.primary },
    cardBg: { backgroundColor: tk.colors.card },
  }));
  const appLanguage = useStore(s => s.appLanguage);
  const [showNotYourTurn, setShowNotYourTurn] = useState(false);
  const [showIncomplete, setShowIncomplete] = useState(false);
  const [showConfirmDone, setShowConfirmDone] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [turnCompleted, setTurnCompleted] = useState(false);
  const [isFinishingTurn, setIsFinishingTurn] = useState(false);

  // Selectors to avoid broad store subscriptions
  const currentUser = useStore((s) => s.currentUser);
  const currentApartment = useStore((s) => s.currentApartment);
  const cleaningTask = useStore((s) => s.cleaningTask);
  const initializeCleaning = useStore((s) => s.initializeCleaning);
  const checkOverdueTasks = useStore((s) => s.checkOverdueTasks);
  const cleaningSettings = useStore((s) => s.cleaningSettings);
  
  // New Firestore-based functionality
  const checklistItems = useStore((s) => s.checklistItems);
  const isMyCleaningTurn = useStore((s) => s.isMyCleaningTurn);
  const loadCleaningChecklist = useStore((s) => s.loadCleaningChecklist);
  const startCleaningChecklistListener = useStore((s) => s.startCleaningChecklistListener);
  const stopCleaningChecklistListener = useStore((s) => s.stopCleaningChecklistListener);
  const completeChecklistItem = useStore((s) => s.completeChecklistItem);
  const uncompleteChecklistItem = useStore((s) => s.uncompleteChecklistItem);
  const finishCleaningTurn = useStore((s) => s.finishCleaningTurn);

  // Initialize cleaning if not exists and check for overdue tasks
  useEffect(() => {
    const initialize = async () => {
      if (currentApartment && currentApartment.members.length > 0 && !cleaningTask) {
        await initializeCleaning();
      }
      await checkOverdueTasks();
    };
    
    initialize();
  }, [currentApartment, cleaningTask, initializeCleaning, checkOverdueTasks]);

  // Check if turn is completed for current cycle
  useEffect(() => {
    if (currentUser && cleaningTask && checklistItems.length > 0 && isMyCleaningTurn) {
      const isCompleted = isTurnCompletedForCurrentCycleWithSettings({
        uid: currentUser.id,
        task: {
          assigned_at: cleaningTask.assigned_at || null,
          frequency_days: cleaningTask.frequency_days || cleaningTask.intervalDays,
          last_completed_at: cleaningTask.last_completed_at || null,
          last_completed_by: cleaningTask.last_completed_by || null,
          dueDate: cleaningTask.dueDate ? cleaningTask.dueDate.toISOString() : null,
        },
        checklistItems: checklistItems.map(item => ({
          completed: item.completed,
          completed_by: item.completed_by,
          completed_at: item.completed_at,
        })),
        cleaningSettings,
      });
      setTurnCompleted(isCompleted);
    } else {
      // אם אין נתונים או זה לא התור שלי, אפס את turnCompleted
      setTurnCompleted(false);
    }
  }, [currentUser, cleaningTask, checklistItems, isMyCleaningTurn]);

  // Set up realtime listener when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      let isActive = true;
      
      const setupListener = async () => {
        if (isActive) {
          // Load initial data
          await loadCleaningChecklist();
          // Start realtime listener for live updates
          startCleaningChecklistListener();
        }
      };

      setupListener();

      return () => {
        isActive = false;
        // Stop listener when leaving screen to save resources
        stopCleaningChecklistListener();
      };
    }, [loadCleaningChecklist, startCleaningChecklistListener, stopCleaningChecklistListener])
  );

  // Use the unified turn check from the store
  const isMyTurn = isMyCleaningTurn;

  const handleMarkCleaned = async () => {
    if (!currentUser) return;

    if (!isMyTurn) {
      setShowNotYourTurn(true);
      return;
    }

    // Check if turn is already completed for current cycle
    if (turnCompleted && cleaningTask) {
      const { cycleEnd } = getCurrentCycleWithSettings({
        assigned_at: cleaningTask.assigned_at || null,
        frequency_days: cleaningTask.frequency_days || cleaningTask.intervalDays,
        dueDate: cleaningTask.dueDate ? cleaningTask.dueDate.toISOString() : null,
      }, cleaningSettings);
      // Show success message with next turn date
      setErrorMessage(t('cleaning.youCompleted') + ' ' + t('cleaning.untilDate', { date: cycleEnd.toLocaleDateString() }));
      return;
    }

    // Check if all checklist items are completed using the new system
    const completedTasks = checklistItems.filter(item => item.completed);

    if (completedTasks.length < checklistItems.length) {
      setShowIncomplete(true);
      return;
    }

    setShowConfirmDone(true);
  };


  const handleToggleTask = async (taskId: string, completed: boolean) => {
    // Don't allow toggling if turn is completed
    if (turnCompleted) {
      return;
    }

    try {
      if (completed) {
        await completeChecklistItem(taskId);
        impactLight(); // Light haptic for completing a task
      } else {
        await uncompleteChecklistItem(taskId);
        impactLight(); // Light haptic for uncompleting a task
      }
    } catch (error: any) {
      console.error('Error toggling task:', error);
      
      // Show detailed error to help with debugging
      let errorMessage = t('common.error');
      if (error.message?.includes('CHECKLIST_UPDATE_FAILED')) {
        if (error.message.includes('403')) {
          errorMessage = t('cleaning.modals.incompleteMsg');
        } else if (error.message.includes('404')) {
          errorMessage = t('common.error');
        } else {
          errorMessage = `${t('common.error')}: ${error.message}`;
        }
      }
      
      setErrorMessage(errorMessage);
    }
  };

  const handleFinishTurn = async () => {
    if (isFinishingTurn) return; // Prevent double-click
    
    setIsFinishingTurn(true);
    try {
      await finishCleaningTurn();
      success(); // Success haptic for completing cleaning turn
      setShowConfirmDone(false);
      setTurnCompleted(true); // Mark as completed locally
      // No need to reload - the realtime listener will update automatically
    } catch (error) {
      console.error('Error finishing turn:', error);
      setErrorMessage(t('common.error'));
    } finally {
      setIsFinishingTurn(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      // Only load checklist data on refresh to reduce Firestore reads
      await loadCleaningChecklist();
    } catch (error) {
      console.error('Error refreshing:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const getTaskCompletion = (taskId: string) => {
    // Use the new checklistItems system
    const item = checklistItems.find(item => item.id === taskId);
    return item?.completed || false;
  };

  // Enhanced completion percentage that shows live updates from other users
  const getCompletionPercentage = () => {
    if (checklistItems.length === 0) return 0;
    
    const completedTasks = checklistItems.filter(item => item.completed);
    return Math.round((completedTasks.length / checklistItems.length) * 100);
  };

  const isOverdue = () => {
    if (!cleaningTask) return false;
    
    // אם יש רק שותף אחד בדירה - אין איחור, הוא תמיד בתור
    if (currentApartment?.members.length === 1) {
      return false;
    }
    
    try {
      // Calculate due date aligned to anchor day
      const { cycleEnd } = getCurrentCycleWithSettings({
        assigned_at: cleaningTask.assigned_at || null,
        frequency_days: cleaningSettings.intervalDays,
      }, cleaningSettings);
      return new Date() > cycleEnd;
    } catch (error) {
      return false;
    }
  };

  const getCurrentTurnUser = () => {
    if (!cleaningTask || !currentApartment) return null;
    // Use the user_id field (compatible with Firestore rules)
    const currentTurnUserId = (cleaningTask as any).user_id;
    return currentApartment.members.find((member) => member.id === currentTurnUserId) || null;
  };

  const getNextInQueue = (): User[] => {
    if (!cleaningTask || !currentApartment) return [];
    const currentTurnUserId = (cleaningTask as any).user_id;
    const currentIndex = cleaningTask.queue.indexOf(currentTurnUserId);
    const nextUsers: User[] = [];
    for (let i = 1; i < cleaningTask.queue.length; i++) {
      const nextIndex = (currentIndex + i) % cleaningTask.queue.length;
      const user = currentApartment.members.find((member) => member.id === cleaningTask.queue[nextIndex]);
      if (user) nextUsers.push(user);
    }
    return nextUsers;
  };

  const currentTurnUser = getCurrentTurnUser();
  const nextUsers = getNextInQueue();
  const preferredDow = currentTurnUser ? cleaningSettings.preferredDayByUser[currentTurnUser.id] : undefined;

  // Cycle key to force re-mount of checklist items when cycle changes
  const cycleKey = cleaningTask?.assigned_at
    ? new Date(cleaningTask.assigned_at).getTime()
    : 0;

  const formatDate = (date: Date | string) => {
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      if (isNaN(dateObj.getTime())) {
        return t('common.invalidDate');
      }
      const locale = appLanguage === 'he' ? 'he-IL' : 'en-US';
      return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(dateObj);
    } catch (error) {
      return t('common.invalidDate');
    }
  };

  const formatDueDate = (date: Date | string) => {
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      if (isNaN(dateObj.getTime())) {
        return t('common.invalidDate');
      }
      const locale = appLanguage === 'he' ? 'he-IL' : 'en-US';
      return new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'short' }).format(dateObj);
    } catch (error) {
      return t('common.invalidDate');
    }
  };

  // Helper function to display member name for live updates
  const displayMemberName = (uid: string): string => {
    if (!currentApartment) return t('common.user');
    const member = currentApartment.members.find(m => m.id === uid);
    return getDisplayName(member) || t('common.user');
  };

  if (!currentApartment || !cleaningTask) {
    return (
      <View className="flex-1 justify-center items-center px-6" style={themed.surfaceBg}>
        <Ionicons name="brush-outline" size={80} color="#6b7280" />
        <ThemedText className="text-xl text-center mt-4" style={themed.textSecondary}>{t('cleaning.loading')}</ThemedText>
      </View>
    );
  }

  return (
    <Screen withPadding={false} keyboardVerticalOffset={0} scroll={false}>
      <ThemedCard className="px-6 pt-20 pb-6 shadow-sm">
        <Text style={{ textAlign: 'center', ...themed.textPrimary }} className="text-2xl font-bold mb-2 w-full">{t('cleaning.title')}</Text>
        <Text style={{ textAlign: 'center', color: themed.textSecondary.color }} className="w-full">{currentApartment.name}</Text>
        <View className="flex-row items-center justify-center mt-2">
          <View className="px-3 py-1 rounded-full" style={themed.surfaceBg}>
            <ThemedText className="text-sm" style={themed.textSecondary}>
              {cleaningSettings.intervalDays === 7 ? t('cleaning.scheduleWeekly') : t('cleaning.scheduleDays', { count: cleaningSettings.intervalDays })} • {t('cleaning.rotatesOn', { day: t(`days.${cleaningSettings.anchorDow}`) })}
            </ThemedText>
          </View>
        </View>
      </ThemedCard>

      <ScrollView 
        className="flex-1 px-6 py-6"
        contentContainerStyle={{ alignItems: 'stretch' }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Current Turn Card */}
        <ThemedCard className="rounded-2xl p-6 mb-6 shadow-sm">
          <View className="items-center">
            <View className={cn('w-16 h-16 rounded-full items-center justify-center mb-4', isMyTurn ? 'bg-blue-100' : '')} style={!isMyTurn ? themed.surfaceBg : undefined}>
              <Ionicons name="person" size={32} color={isMyTurn ? '#007AFF' : '#6b7280'} />
            </View>

            <ThemedText className="text-xl font-semibold mb-1 flex-1">
              {getDisplayName(currentApartment.members.find((m) => m.id === (cleaningTask as any).user_id)) || t('cleaning.unknownUser')}
            </ThemedText>

            {(() => {
              const dow = cleaningSettings.preferredDayByUser[(cleaningTask as any).user_id];
              if (dow === undefined) return null;
              return <ThemedText className="text-sm mb-1" style={themed.textSecondary}>{t('cleaning.recommendedDay', { day: t(`days.${dow}`) })}</ThemedText>;
            })()}

            {(() => {
              // Calculate due date aligned to anchor day
              const { cycleEnd } = getCurrentCycleWithSettings({
                assigned_at: cleaningTask.assigned_at || null,
                frequency_days: cleaningSettings.intervalDays,
              }, cleaningSettings);
              const overdue = new Date() > cycleEnd;
              return (
                <ThemedText className={cn('text-sm mb-4', overdue ? 'text-red-600' : '')} style={!overdue ? themed.textSecondary : undefined}>
                  {t('cleaning.untilDate', { date: formatDueDate(cycleEnd) })}{overdue && t('cleaning.overdue')}
                </ThemedText>
              );
            })()}

            {isMyTurn && (
              <>
                <ThemedText className="text-sm mb-2" style={themed.textSecondary}>{t('cleaning.progress', { percent: getCompletionPercentage() })}</ThemedText>
                <View className="w-full rounded-full h-2 mb-4" style={{ backgroundColor: '#e5e7eb' }}>
                  <View className="bg-blue-500 h-2 rounded-full" style={{ width: `${getCompletionPercentage()}%` }} />
                </View>
                <AsyncButton
                  title={turnCompleted ? t('cleaning.youCompleted') : (getCompletionPercentage() === 100 ? t('cleaning.finishTurnCta') : t('cleaning.completeAllTasks'))}
                  onPress={handleMarkCleaned}
                  disabled={turnCompleted || getCompletionPercentage() !== 100 || isFinishingTurn}
                  loadingText={t('cleaning.processing')}
                  variant={getCompletionPercentage() === 100 ? 'success' : 'primary'}
                  className={cn(
                    'py-3 px-8 rounded-xl', 
                    turnCompleted ? 'bg-gray-400' : (getCompletionPercentage() === 100 ? 'bg-green-500' : 'bg-gray-600')
                  )}
                />
              </>
            )}

            {/* Show live progress even when it's not my turn */}
            {!isMyTurn && checklistItems.length > 0 && (
              <View className="w-full mt-4">
                <ThemedText className="text-sm mb-2 text-center" style={themed.textSecondary}>{t('cleaning.progressCurrent', { percent: getCompletionPercentage() })}</ThemedText>
                <View className="w-full rounded-full h-2" style={{ backgroundColor: '#e5e7eb' }}>
                  <View className="bg-green-500 h-2 rounded-full" style={{ width: `${getCompletionPercentage()}%` }} />
                </View>
              </View>
            )}
          </View>
        </ThemedCard>

        {/* Live Progress Section - Show completed tasks by others */}
        {!isMyTurn && checklistItems.length > 0 && (
          <ThemedCard className="rounded-2xl p-6 mb-6 shadow-sm">
            <ThemedText className="text-lg font-semibold mb-4">{t('cleaning.liveProgress')}</ThemedText>
            {checklistItems.map((item) => {
              const isRTL = I18nManager.isRTL;
              return (
                <View 
                  key={item.id} 
                  className="flex-row items-center py-3 px-3 rounded-xl mb-2"
                  style={themed.cardBg}
                >
                  <View 
                    className={cn(
                      'w-7 h-7 rounded-full border-2 items-center justify-center',
                      item.completed ? 'bg-green-500 border-green-500' : '',
                      isRTL ? 'ml-3' : 'mr-3'
                    )} 
                    style={!item.completed ? { backgroundColor: '#f3f4f6', ...themed.borderColor } : undefined}
                  >
                    {item.completed && <Ionicons name="checkmark" size={14} color="white" />}
                  </View>
                  <ThemedText 
                    className={cn(
                      'flex-1 text-base',
                      item.completed ? 'text-green-600 line-through' : '',
                      isRTL ? 'text-right' : 'text-left'
                    )}
                  >
                    {getTaskLabel(item)}
                  </ThemedText>
                  {item.completed && item.completed_by && (
                    <Text className={cn("text-xs text-green-600", isRTL ? "mr-2" : "ml-2")}>
                      ✓ {displayMemberName(item.completed_by)}
                    </Text>
                  )}
                </View>
              );
            })}
          </ThemedCard>
        )}

        {/* Queue */}
        <ThemedCard className="rounded-2xl p-6 mb-6 shadow-sm">
          <ThemedText className="text-lg font-semibold mb-4">{t('cleaning.nextQueue')}</ThemedText>
          {(() => {
            // אם יש רק שותף אחד בדירה - הוא תמיד בתור
            if (currentApartment?.members.length === 1) {
              return (
                <View 
                  className="items-center py-3"
                  style={{ 
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'center'
                  }}
                >
                  <View className="bg-blue-100 w-10 h-10 rounded-full items-center justify-center">
                    <Text className="text-blue-600 font-medium">1</Text>
                  </View>
                  <ThemedText className="text-base flex-1" style={{ marginStart: isRTL ? 0 : 12, marginEnd: isRTL ? 12 : 0 }}>{getDisplayName(currentApartment.members[0])}</ThemedText>
                  <Text className="text-blue-600 text-sm">{t('cleaning.alwaysInTurn')}</Text>
                </View>
              );
            }
            
            // אם יש מספר שותפים - הצג את התור הרגיל
            const currentIndex = cleaningTask.queue.indexOf((cleaningTask as any).user_id);
            return cleaningTask.queue.slice(1).map((_, i) => {
              const idx = (currentIndex + i + 1) % cleaningTask.queue.length;
              const userId = cleaningTask.queue[idx];
              const user = currentApartment.members.find((m) => m.id === userId);
              if (!user) return null;
              return (
                <View 
                  key={user.id} 
                  className="items-center py-3"
                  style={{ 
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'center'
                  }}
                >
                  <View className="w-10 h-10 rounded-full items-center justify-center" style={themed.surfaceBg}>
                    <ThemedText style={themed.textSecondary} className="font-medium">{i + 2}</ThemedText>
                  </View>
                  <ThemedText className="text-base flex-1" style={{ marginStart: isRTL ? 0 : 12, marginEnd: isRTL ? 12 : 0 }}>{getDisplayName(user)}</ThemedText>
                </View>
              );
            });
          })()}
        </ThemedCard>

        {/* Cleaning Tasks */}
        {(isMyTurn || turnCompleted) && (
          <ThemedCard className="rounded-2xl p-6 mb-6 shadow-sm">
            <View className="flex-row items-center justify-between mb-4">
              <ThemedText className="text-lg font-semibold flex-1">{t('cleaning.tasksList')}</ThemedText>
            </View>

            {checklistItems.map((item) => {
              const isCompleted = item.completed;
              // אם זה לא התור שלי, הכפתורים צריכים להיות חסומים
              // אם זה התור שלי, הכפתורים חסומים רק אם סיימתי את התור
              const isDisabled = !isMyTurn || turnCompleted;
              const isRTL = I18nManager.isRTL;
              
              // When turn is completed, show tasks as completed but grayed out
              const showAsCompletedAndDisabled = isCompleted && turnCompleted;
              
              return (
                <View 
                  key={`${cycleKey}-${item.id}`} 
                  className="flex-row items-center py-4 px-3 rounded-xl mb-3"
                  style={themed.cardBg}
                >
                  <Pressable 
                    onPress={() => !isDisabled && handleToggleTask(item.id, !isCompleted)} 
                    className={cn(
                      'w-8 h-8 rounded-full border-2 items-center justify-center shadow-sm',
                      showAsCompletedAndDisabled ? '' : (
                        isDisabled ? '' : (isCompleted ? 'bg-green-500 border-green-500' : '')
                      ),
                      isRTL ? 'ml-3' : 'mr-3'
                    )}
                    style={[
                      showAsCompletedAndDisabled ? {
                        backgroundColor: '#9ca3af',
                        borderColor: '#9ca3af',
                        shadowOpacity: 0
                      } : isDisabled ? { 
                        backgroundColor: '#6b7280', 
                        borderColor: '#6b7280',
                        shadowOpacity: 0
                      } : !isCompleted ? {
                        backgroundColor: '#f3f4f6',
                        borderColor: '#d1d5db',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 1 },
                        shadowRadius: 2,
                        elevation: 2,
                      } : {
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 1 },
                        shadowRadius: 2,
                        elevation: 2,
                      },
                      isCompleted && !showAsCompletedAndDisabled ? {
                        shadowColor: '#10b981',
                        shadowOffset: { width: 0, height: 2 },
                        shadowRadius: 4,
                        elevation: 3,
                      } : undefined
                    ]}
                    disabled={isDisabled}
                  >
                    {isCompleted && <Ionicons name="checkmark" size={18} color="white" />}
                  </Pressable>
                  <ThemedText 
                    className={cn(
                      'flex-1 text-base leading-6',
                      isCompleted ? 'line-through' : '',
                      isRTL ? 'text-right' : 'text-left'
                    )} 
                    style={isCompleted ? themed.textSecondary : undefined}
                  >
                    {getTaskLabel(item)}
                  </ThemedText>
                </View>
              );
            })}

          </ThemedCard>
        )}

        {/* Last Cleaning Info */}
        {cleaningTask.last_completed_at && (
          <ThemedCard className="rounded-2xl p-6 mb-6 shadow-sm">
            <ThemedText className="text-lg font-semibold mb-3">{t('cleaning.lastCleaning')}</ThemedText>
            <View className="flex-row items-center">
              <Ionicons name="checkmark-circle" size={20} color="#10b981" />
              <View className="mr-3">
                <ThemedText style={themed.textSecondary}>{new Date(cleaningTask.last_completed_at).toLocaleString()}</ThemedText>
                {cleaningTask.last_completed_by && (
                  <ThemedText className="text-sm" style={themed.textSecondary}>{t('cleaning.byUser', { name: getDisplayName(currentApartment.members.find((m) => m.id === cleaningTask.last_completed_by)) })}</ThemedText>
                )}
              </View>
            </View>
          </ThemedCard>
        )}

        {/* Cleaning History */}
        {cleaningTask.last_completed_at && (
          <ThemedCard className="rounded-2xl p-6 shadow-sm">
            <ThemedText className="text-lg font-semibold mb-4">{t('cleaning.history')}</ThemedText>
            {/* Show last cleaning from the new system */}
            <View className="flex-row items-center py-2">
              <Ionicons name="brush" size={16} color="#10b981" />
              <View className="mr-3">
                <ThemedText className="flex-1">{cleaningTask.last_completed_by ? (getDisplayName(currentApartment.members.find((m) => m.id === cleaningTask.last_completed_by)) || t('cleaning.unknownUser')) : t('cleaning.unknownUser')}</ThemedText>
                <ThemedText className="text-sm" style={themed.textSecondary}>
                  {new Date(cleaningTask.last_completed_at).toLocaleString()}
                </ThemedText>
              </View>
            </View>
            
            {/* Show old history if available */}
            {cleaningTask.history.length > 0 && cleaningTask.history.slice(-4).reverse().map((history) => {
              const user = currentApartment.members.find((m) => m.id === history.userId);
              return (
                <View key={history.id} className="flex-row items-center py-2">
                  <Ionicons name="brush" size={16} color="#10b981" />
                  <View className="mr-3">
                    <ThemedText className="flex-1">{getDisplayName(user) || t('cleaning.unknownUser')}</ThemedText>
                    <ThemedText className="text-sm" style={themed.textSecondary}>{new Date(history.cleanedAt).toLocaleString()}</ThemedText>
                  </View>
                </View>
              );
            })}
          </ThemedCard>
        )}
      </ScrollView>

      {/* Modals */}
      <ConfirmModal visible={showNotYourTurn} title={t('cleaning.modals.notYourTurnTitle')} message={t('cleaning.modals.notYourTurnMsg')} confirmText={t('cleaning.modals.understood')} cancelText="" onConfirm={() => setShowNotYourTurn(false)} onCancel={() => setShowNotYourTurn(false)} />
      <ConfirmModal visible={showIncomplete} title={t('cleaning.modals.incompleteTitle')} message={t('cleaning.modals.incompleteMsg')} confirmText={t('cleaning.modals.understood')} cancelText="" onConfirm={() => setShowIncomplete(false)} onCancel={() => setShowIncomplete(false)} />
      <ConfirmModal
        visible={showConfirmDone}
        title={t('cleaning.modals.confirmTitle')}
        message={t('cleaning.modals.confirmMsg')}
        confirmText={isFinishingTurn ? t('cleaning.modals.processing') : t('cleaning.modals.confirmYes')}
        cancelText={t('common.cancel')}
        onConfirm={handleFinishTurn}
        onCancel={() => setShowConfirmDone(false)}
      />
      
      {/* Error message modal */}
      {errorMessage && (
        <ConfirmModal
          visible={!!errorMessage}
          title={t('cleaning.modals.errorTitle')}
          message={errorMessage}
          confirmText={t('cleaning.modals.understood')}
          cancelText=""
          onConfirm={() => setErrorMessage(null)}
          onCancel={() => setErrorMessage(null)}
        />
      )}
    </Screen>
  );
}