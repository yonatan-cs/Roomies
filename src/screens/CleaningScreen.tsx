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

const HEBREW_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

export default function CleaningScreen() {
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
      setErrorMessage(`מעולה, ניקית! התור יעבור לשותף הבא בתאריך ${cycleEnd.toLocaleDateString('he-IL')}`);
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
      } else {
        await uncompleteChecklistItem(taskId);
      }
    } catch (error: any) {
      console.error('Error toggling task:', error);
      
      // Show detailed error to help with debugging
      let errorMessage = 'שגיאה בעדכון המשימה';
      if (error.message?.includes('CHECKLIST_UPDATE_FAILED')) {
        if (error.message.includes('403')) {
          errorMessage = 'אין הרשאה לעדכן את המשימה. ודא שאתה חבר בדירה וזה התור שלך לנקות.';
        } else if (error.message.includes('404')) {
          errorMessage = 'המשימה לא נמצאה. נסה לרענן את המסך.';
        } else {
          errorMessage = `שגיאה בעדכון המשימה: ${error.message}`;
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
      setShowConfirmDone(false);
      setTurnCompleted(true); // Mark as completed locally
      // Reload data to get fresh state
      await Promise.all([
        loadCleaningChecklist(),
        checkOverdueTasks()
      ]);
    } catch (error) {
      console.error('Error finishing turn:', error);
      setErrorMessage('שגיאה בסיום התור. נסה שוב.');
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
        return 'תאריך לא תקין';
      }
      return new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(dateObj);
    } catch (error) {
      return 'תאריך לא תקין';
    }
  };

  const formatDueDate = (date: Date | string) => {
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      if (isNaN(dateObj.getTime())) {
        return 'תאריך לא תקין';
      }
      return new Intl.DateTimeFormat('he-IL', { weekday: 'long', day: 'numeric', month: 'short' }).format(dateObj);
    } catch (error) {
      return 'תאריך לא תקין';
    }
  };

  // Helper function to display member name for live updates
  const displayMemberName = (uid: string): string => {
    if (!currentApartment) return 'משתמש';
    const member = currentApartment.members.find(m => m.id === uid);
    return member?.name || 'משתמש';
  };

  if (!currentApartment || !cleaningTask) {
    return (
      <View className="flex-1 bg-white justify-center items-center px-6">
        <Ionicons name="brush-outline" size={80} color="#6b7280" />
        <Text className="text-xl text-gray-600 text-center mt-4">טוען נתוני ניקיון...</Text>
      </View>
    );
  }

  return (
    <Screen withPadding={false} keyboardVerticalOffset={0} scroll={false}>
      <View className="bg-white px-6 pt-16 pb-6 shadow-sm">
        <Text className="text-2xl font-bold text-gray-900 text-center mb-2">סבב הניקיון</Text>
        <Text className="text-gray-600 text-center">{currentApartment.name}</Text>
        <View className="flex-row items-center justify-center mt-2">
          <View className="px-3 py-1 rounded-full bg-gray-100">
            <Text className="text-gray-700 text-sm">
              {cleaningSettings.intervalDays === 7 ? 'שבועי' : `${cleaningSettings.intervalDays} ימים`} • מתחלף ביום {HEBREW_DAYS[cleaningSettings.anchorDow]}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView 
        className="flex-1 px-6 py-6"
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
              {currentApartment.members.find((m) => m.id === (cleaningTask as any).user_id)?.name || 'לא ידוע'}
            </Text>

            {(() => {
              const dow = cleaningSettings.preferredDayByUser[(cleaningTask as any).user_id];
              if (dow === undefined) return null;
              return <Text className="text-sm text-gray-500 mb-1">מומלץ לנקות ביום {HEBREW_DAYS[dow]}</Text>;
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
                  עד {formatDueDate(cycleEnd)}{overdue && ' (באיחור)'}
                </Text>
              );
            })()}

            {isMyTurn && (
              <>
                <Text className="text-sm text-gray-600 mb-2">התקדמות: {getCompletionPercentage()}%</Text>
                <View className="w-full bg-gray-200 rounded-full h-2 mb-4">
                  <View className="bg-blue-500 h-2 rounded-full" style={{ width: `${getCompletionPercentage()}%` }} />
                </View>
                <AsyncButton
                  title={turnCompleted ? 'השלמת את הניקיון! ✅' : (getCompletionPercentage() === 100 ? 'סיימתי, העבר תור! ✨' : 'השלם כל המשימות')}
                  onPress={handleMarkCleaned}
                  disabled={turnCompleted || getCompletionPercentage() !== 100 || isFinishingTurn}
                  loadingText="מעבד..."
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
                <Text className="text-sm text-gray-600 mb-2 text-center">התקדמות נוכחית: {getCompletionPercentage()}%</Text>
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
            <Text className="text-lg font-semibold text-gray-900 mb-4">התקדמות בזמן אמת</Text>
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
          <Text className="text-lg font-semibold text-gray-900 mb-4">התור הבא</Text>
          {(() => {
            // אם יש רק שותף אחד בדירה - הוא תמיד בתור
            if (currentApartment?.members.length === 1) {
              return (
                <View className="flex-row items-center py-3">
                  <View className="bg-blue-100 w-10 h-10 rounded-full items-center justify-center">
                    <Text className="text-blue-600 font-medium">1</Text>
                  </View>
                  <Text className="text-gray-900 text-base mr-3">{currentApartment.members[0].name}</Text>
                  <Text className="text-blue-600 text-sm">(תמיד בתור)</Text>
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
              <Text className="text-lg font-semibold text-gray-900">רשימת משימות ניקיון</Text>
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
            <Text className="text-lg font-semibold text-gray-900 mb-3">ניקיון אחרון</Text>
            <View className="flex-row items-center">
              <Ionicons name="checkmark-circle" size={20} color="#10b981" />
              <View className="mr-3">
                <Text className="text-gray-600">{new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(cleaningTask.last_completed_at))}</Text>
                {cleaningTask.last_completed_by && (
                  <Text className="text-sm text-gray-500">על ידי {currentApartment.members.find((m) => m.id === cleaningTask.last_completed_by)?.name}</Text>
                )}
              </View>
            </View>
          </View>
        )}

        {/* Cleaning History */}
        {cleaningTask.last_completed_at && (
          <View className="bg-white rounded-2xl p-6 shadow-sm">
            <Text className="text-lg font-semibold text-gray-900 mb-4">היסטוריית ניקיונות</Text>
            {/* Show last cleaning from the new system */}
            <View className="flex-row items-center py-2">
              <Ionicons name="brush" size={16} color="#10b981" />
              <View className="mr-3">
                <Text className="text-gray-900">
                  {cleaningTask.last_completed_by ? 
                    currentApartment.members.find((m) => m.id === cleaningTask.last_completed_by)?.name || 'משתמש לא ידוע' 
                    : 'משתמש לא ידוע'
                  }
                </Text>
                <Text className="text-sm text-gray-500">
                  {new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(cleaningTask.last_completed_at))}
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
                    <Text className="text-gray-900">{user?.name || 'משתמש לא ידוע'}</Text>
                    <Text className="text-sm text-gray-500">{new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(history.cleanedAt))}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Modals */}
      <ConfirmModal visible={showNotYourTurn} title="לא התור שלך" message="כרגע זה לא התור שלך לנקות" confirmText="הבנתי" cancelText="" onConfirm={() => setShowNotYourTurn(false)} onCancel={() => setShowNotYourTurn(false)} />
      <ConfirmModal visible={showIncomplete} title="משימות לא הושלמו" message="אנא השלם את כל המשימות לפני סיום הניקיון" confirmText="הבנתי" cancelText="" onConfirm={() => setShowIncomplete(false)} onCancel={() => setShowIncomplete(false)} />
      <ConfirmModal
        visible={showConfirmDone}
        title="אישור ניקיון"
        message="האם באמת השלמת את כל משימות הניקיון?"
        confirmText={isFinishingTurn ? "מעבד..." : "כן, סיימתי!"}
        cancelText="ביטול"
        onConfirm={handleFinishTurn}
        onCancel={() => setShowConfirmDone(false)}
      />
      
      {/* Error message modal */}
      {errorMessage && (
        <ConfirmModal
          visible={!!errorMessage}
          title="שגיאה"
          message={errorMessage}
          confirmText="הבנתי"
          cancelText=""
          onConfirm={() => setErrorMessage(null)}
          onCancel={() => setErrorMessage(null)}
        />
      )}
    </Screen>
  );
}