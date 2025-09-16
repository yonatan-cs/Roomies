import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, TextInput, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useStore } from '../state/store';
import { cn } from '../utils/cn';
import { isTurnCompletedForCurrentCycle, getCurrentCycle } from '../utils/dateUtils';
import ConfirmModal from '../components/ConfirmModal';
import { User } from '../types';
import { Screen } from '../components/Screen';
import { AsyncButton } from '../components/AsyncButton';
import { useTranslation } from 'react-i18next';
import { impactLight, success } from '../utils/haptics';


export default function CleaningScreen() {
  const { t } = useTranslation();
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
      const isCompleted = isTurnCompletedForCurrentCycle({
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
        }))
      });
      setTurnCompleted(isCompleted);
    } else {
      // אם אין נתונים או זה לא התור שלי, אפס את turnCompleted
      setTurnCompleted(false);
    }
  }, [currentUser, cleaningTask, checklistItems, isMyCleaningTurn]);

  // Load checklist data when screen comes into focus (for live updates)
  useFocusEffect(
    React.useCallback(() => {
      let isActive = true;
      let pollInterval: NodeJS.Timeout | null = null;
      
      const loadData = async () => {
        if (isActive) {
          await loadCleaningChecklist();
        }
      };

      // Load data immediately
      loadData();

      // Smart polling: only poll when it's not my turn (to see live updates from others)
      if (!isMyCleaningTurn && checklistItems.length > 0) {
        pollInterval = setInterval(() => {
          if (isActive) {
            loadCleaningChecklist();
          }
        }, 5000); // Poll every 5 seconds when watching others
      }

      return () => {
        isActive = false;
        if (pollInterval) {
          clearInterval(pollInterval);
        }
      };
    }, [loadCleaningChecklist, isMyCleaningTurn, checklistItems.length])
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
      const { cycleEnd } = getCurrentCycle({
        assigned_at: cleaningTask.assigned_at || null,
        frequency_days: cleaningTask.frequency_days || cleaningTask.intervalDays,
        dueDate: cleaningTask.dueDate ? cleaningTask.dueDate.toISOString() : null,
      });
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
      // Reload data to get fresh state
      await Promise.all([
        loadCleaningChecklist(),
        checkOverdueTasks()
      ]);
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
      await Promise.all([
        loadCleaningChecklist(),
        checkOverdueTasks()
      ]);
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
      // Calculate due date from assigned_at instead of using stale dueDate field
      const { cycleEnd } = getCurrentCycle({
        assigned_at: cleaningTask.assigned_at || null,
        frequency_days: cleaningSettings.intervalDays,
      });
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
    return member?.name || t('common.user');
  };

  if (!currentApartment || !cleaningTask) {
    return (
      <View className="flex-1 bg-white justify-center items-center px-6">
        <Ionicons name="brush-outline" size={80} color="#6b7280" />
        <Text className="text-xl text-gray-600 text-center mt-4">{t('cleaning.loading')}</Text>
      </View>
    );
  }

  return (
    <Screen withPadding={false} keyboardVerticalOffset={0} scroll={false}>
      <View className="bg-white px-6 pt-16 pb-6 shadow-sm">
        <Text className="text-2xl font-bold text-gray-900 text-center mb-2">{t('cleaning.title')}</Text>
        <Text className="text-gray-600 text-center">{currentApartment.name}</Text>
        <View className="flex-row items-center justify-center mt-2">
          <View className="px-3 py-1 rounded-full bg-gray-100">
            <Text className="text-gray-700 text-sm">
              {cleaningSettings.intervalDays === 7 ? t('cleaning.scheduleWeekly') : t('cleaning.scheduleDays', { count: cleaningSettings.intervalDays })} • {t('cleaning.rotatesOn', { day: t(`days.${cleaningSettings.anchorDow}`) })}
            </Text>
          </View>
        </View>
      </View>

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
        <View className="bg-white rounded-2xl p-6 mb-6 shadow-sm">
          <View className="items-center">
            <View className={cn('w-16 h-16 rounded-full items-center justify-center mb-4', isMyTurn ? 'bg-blue-100' : 'bg-gray-100')}>
              <Ionicons name="person" size={32} color={isMyTurn ? '#007AFF' : '#6b7280'} />
            </View>

            <Text className="text-xl font-semibold text-gray-900 mb-1">
              {currentApartment.members.find((m) => m.id === (cleaningTask as any).user_id)?.name || t('cleaning.unknownUser')}
            </Text>

            {(() => {
              const dow = cleaningSettings.preferredDayByUser[(cleaningTask as any).user_id];
              if (dow === undefined) return null;
              return <Text className="text-sm text-gray-500 mb-1">{t('cleaning.recommendedDay', { day: t(`days.${dow}`) })}</Text>;
            })()}

            {(() => {
              // Calculate due date from assigned_at instead of using stale dueDate field
              const { cycleEnd } = getCurrentCycle({
                assigned_at: cleaningTask.assigned_at || null,
                frequency_days: cleaningSettings.intervalDays,
              });
              const overdue = new Date() > cycleEnd;
              return (
                <Text className={cn('text-sm mb-4', overdue ? 'text-red-600' : 'text-gray-600')}>
                  {t('cleaning.untilDate', { date: formatDueDate(cycleEnd) })}{overdue && t('cleaning.overdue')}
                </Text>
              );
            })()}

            {isMyTurn && (
              <>
                <Text className="text-sm text-gray-600 mb-2">{t('cleaning.progress', { percent: getCompletionPercentage() })}</Text>
                <View className="w-full bg-gray-200 rounded-full h-2 mb-4">
                  <View className="bg-blue-500 h-2 rounded-full" style={{ width: `${getCompletionPercentage()}%` }} />
                </View>
                <AsyncButton
                  title={turnCompleted ? t('cleaning.youCompleted') : (getCompletionPercentage() === 100 ? t('cleaning.finishTurnCta') : t('cleaning.completeAllTasks'))}
                  onPress={handleMarkCleaned}
                  disabled={turnCompleted || getCompletionPercentage() !== 100 || isFinishingTurn}
                  loadingText={t('cleaning.processing')}
                  className={cn(
                    'py-3 px-8 rounded-xl', 
                    turnCompleted ? 'bg-gray-400' : (getCompletionPercentage() === 100 ? 'bg-green-500' : 'bg-gray-300')
                  )}
                />
              </>
            )}

            {/* Show live progress even when it's not my turn */}
            {!isMyTurn && checklistItems.length > 0 && (
              <View className="w-full mt-4">
                <Text className="text-sm text-gray-600 mb-2 text-center">{t('cleaning.progressCurrent', { percent: getCompletionPercentage() })}</Text>
                <View className="w-full bg-gray-200 rounded-full h-2">
                  <View className="bg-green-500 h-2 rounded-full" style={{ width: `${getCompletionPercentage()}%` }} />
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Live Progress Section - Show completed tasks by others */}
        {!isMyTurn && checklistItems.length > 0 && (
          <View className="bg-white rounded-2xl p-6 mb-6 shadow-sm">
            <Text className="text-lg font-semibold text-gray-900 mb-4">{t('cleaning.liveProgress')}</Text>
            {checklistItems.map((item) => (
              <View key={item.id} className="flex-row items-center py-2">
                <View className={cn('w-5 h-5 rounded border-2 items-center justify-center ml-3', 
                  item.completed ? 'bg-green-500 border-green-500' : 'border-gray-300')}>
                  {item.completed && <Ionicons name="checkmark" size={12} color="white" />}
                </View>
                <Text className={cn('flex-1 text-base', item.completed ? 'text-green-600 line-through' : 'text-gray-900')}>
                  {item.title}
                </Text>
                {item.completed && item.completed_by && (
                  <Text className="text-xs text-green-600">
                    ✓ {displayMemberName(item.completed_by)}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Queue */}
        <View className="bg-white rounded-2xl p-6 mb-6 shadow-sm">
          <Text className="text-lg font-semibold text-gray-900 mb-4">{t('cleaning.nextQueue')}</Text>
          {(() => {
            // אם יש רק שותף אחד בדירה - הוא תמיד בתור
            if (currentApartment?.members.length === 1) {
              return (
                <View className="flex-row items-center py-3">
                  <View className="bg-blue-100 w-10 h-10 rounded-full items-center justify-center">
                    <Text className="text-blue-600 font-medium">1</Text>
                  </View>
                  <Text className="text-gray-900 text-base mr-3">{currentApartment.members[0].name}</Text>
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
                <View key={user.id} className="flex-row items-center py-3">
                  <View className="bg-gray-100 w-10 h-10 rounded-full items-center justify-center">
                    <Text className="text-gray-600 font-medium">{i + 2}</Text>
                  </View>
                  <Text className="text-gray-900 text-base mr-3">{user.name}</Text>
                </View>
              );
            });
          })()}
        </View>

        {/* Cleaning Tasks */}
        {isMyTurn && (
          <View className="bg-white rounded-2xl p-6 mb-6 shadow-sm">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-lg font-semibold text-gray-900">{t('cleaning.tasksList')}</Text>
            </View>

            {checklistItems.map((item) => {
              const isCompleted = item.completed;
              // אם זה לא התור שלי, הכפתורים צריכים להיות חסומים
              // אם זה התור שלי, הכפתורים חסומים רק אם סיימתי את התור
              const isDisabled = !isMyTurn || turnCompleted;
              return (
                <View key={`${cycleKey}-${item.id}`} className="flex-row items-center py-3 px-2 rounded-xl mb-2 bg-gray-50">
                  <Pressable 
                    onPress={() => !isDisabled && handleToggleTask(item.id, !isCompleted)} 
                    className={cn(
                      'w-6 h-6 rounded border-2 items-center justify-center ml-3', 
                      isDisabled ? 'bg-gray-200 border-gray-200' : (isCompleted ? 'bg-green-500 border-green-500' : 'border-gray-300')
                    )}
                    disabled={isDisabled}
                  >
                    {isCompleted && <Ionicons name="checkmark" size={16} color="white" />}
                  </Pressable>
                  <Text className={cn('flex-1 text-base', isCompleted ? 'text-gray-500 line-through' : 'text-gray-900')}>{item.title}</Text>
                </View>
              );
            })}

          </View>
        )}

        {/* Last Cleaning Info */}
        {cleaningTask.last_completed_at && (
          <View className="bg-white rounded-2xl p-6 mb-6 shadow-sm">
            <Text className="text-lg font-semibold text-gray-900 mb-3">{t('cleaning.lastCleaning')}</Text>
            <View className="flex-row items-center">
              <Ionicons name="checkmark-circle" size={20} color="#10b981" />
              <View className="mr-3">
                <Text className="text-gray-600">{new Date(cleaningTask.last_completed_at).toLocaleString()}</Text>
                {cleaningTask.last_completed_by && (
                  <Text className="text-sm text-gray-500">{t('cleaning.byUser', { name: currentApartment.members.find((m) => m.id === cleaningTask.last_completed_by)?.name })}</Text>
                )}
              </View>
            </View>
          </View>
        )}

        {/* Cleaning History */}
        {cleaningTask.last_completed_at && (
          <View className="bg-white rounded-2xl p-6 shadow-sm">
            <Text className="text-lg font-semibold text-gray-900 mb-4">{t('cleaning.history')}</Text>
            {/* Show last cleaning from the new system */}
            <View className="flex-row items-center py-2">
              <Ionicons name="brush" size={16} color="#10b981" />
              <View className="mr-3">
                <Text className="text-gray-900">{cleaningTask.last_completed_by ? (currentApartment.members.find((m) => m.id === cleaningTask.last_completed_by)?.name || t('cleaning.unknownUser')) : t('cleaning.unknownUser')}</Text>
                <Text className="text-sm text-gray-500">
                  {new Date(cleaningTask.last_completed_at).toLocaleString()}
                </Text>
              </View>
            </View>
            
            {/* Show old history if available */}
            {cleaningTask.history.length > 0 && cleaningTask.history.slice(-4).reverse().map((history) => {
              const user = currentApartment.members.find((m) => m.id === history.userId);
              return (
                <View key={history.id} className="flex-row items-center py-2">
                  <Ionicons name="brush" size={16} color="#10b981" />
                  <View className="mr-3">
                    <Text className="text-gray-900">{user?.name || t('cleaning.unknownUser')}</Text>
                    <Text className="text-sm text-gray-500">{new Date(history.cleanedAt).toLocaleString()}</Text>
                  </View>
                </View>
              );
            })}
          </View>
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