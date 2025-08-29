import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useStore } from '../state/store';
import { cn } from '../utils/cn';
import ConfirmModal from '../components/ConfirmModal';
import { User } from '../types';

const HEBREW_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

export default function CleaningScreen() {
  const [newTaskName, setNewTaskName] = useState('');
  const [renameTaskId, setRenameTaskId] = useState<string | null>(null);
  const [renameTaskName, setRenameTaskName] = useState('');

  const [showNotYourTurn, setShowNotYourTurn] = useState(false);
  const [showIncomplete, setShowIncomplete] = useState(false);
  const [showConfirmDone, setShowConfirmDone] = useState(false);

  // Selectors to avoid broad store subscriptions
  const currentUser = useStore((s) => s.currentUser);
  const currentApartment = useStore((s) => s.currentApartment);
  const cleaningTask = useStore((s) => s.cleaningTask);
  const cleaningChecklist = useStore((s) => s.cleaningChecklist);
  const cleaningCompletions = useStore((s) => s.cleaningCompletions);
  const initializeCleaning = useStore((s) => s.initializeCleaning);
  const markCleaned = useStore((s) => s.markCleaned);
  const addCleaningTask = useStore((s) => s.addCleaningTask);
  const toggleCleaningTask = useStore((s) => s.toggleCleaningTask);
  const renameCleaningTask = useStore((s) => s.renameCleaningTask);
  const removeCleaningTask = useStore((s) => s.removeCleaningTask);
  const checkOverdueTasks = useStore((s) => s.checkOverdueTasks);
  const cleaningSettings = useStore((s) => s.cleaningSettings);
  
  // New live functionality
  const checklistItems = useStore((s) => s.checklistItems);
  const isMyCleaningTurn = useStore((s) => s.isMyCleaningTurn);
  const loadCleaningChecklist = useStore((s) => s.loadCleaningChecklist);

  // Initialize cleaning if not exists and check for overdue tasks
  useEffect(() => {
    if (currentApartment && currentApartment.members.length > 0 && !cleaningTask) {
      initializeCleaning();
    }
    checkOverdueTasks();
  }, [currentApartment, cleaningTask, initializeCleaning, checkOverdueTasks]);

  // Load checklist data when screen comes into focus (for live updates)
  useFocusEffect(
    React.useCallback(() => {
      let isActive = true;
      
      const loadData = async () => {
        if (isActive) {
          await loadCleaningChecklist();
        }
      };

      loadData();

      // Live updates: polling every 4 seconds when screen is focused
      const interval = setInterval(() => {
        if (isActive) {
          loadCleaningChecklist();
        }
      }, 4000);

      return () => {
        isActive = false;
        clearInterval(interval);
      };
    }, [loadCleaningChecklist])
  );

  const isMyTurn = currentUser && cleaningTask && cleaningTask.currentTurn === currentUser.id;

  const handleMarkCleaned = () => {
    if (!currentUser || !cleaningTask) return;

    if (!isMyTurn) {
      setShowNotYourTurn(true);
      return;
    }

    const currentTaskCompletions = cleaningCompletions.filter((c) => c.taskId === cleaningTask.id);
    const completedTasks = currentTaskCompletions.filter((c) => c.completed);

    if (completedTasks.length < cleaningChecklist.length) {
      setShowIncomplete(true);
      return;
    }

    setShowConfirmDone(true);
  };

  const handleAddTask = () => {
    if (!newTaskName.trim()) return;
    addCleaningTask(newTaskName.trim());
    setNewTaskName('');
  };

  const handleToggleTask = (taskId: string, completed: boolean) => {
    toggleCleaningTask(taskId, completed);
  };

  const getTaskCompletion = (taskId: string) => {
    if (!cleaningTask) return false;
    const completion = cleaningCompletions.find(
      (c) => c.taskId === cleaningTask.id && c.checklistItemId === taskId
    );
    return completion?.completed || false;
  };

  // Enhanced completion percentage that shows live updates from other users
  const getCompletionPercentage = () => {
    if (!cleaningTask) return 0;
    
    // If we have live checklist items, use them for more accurate progress
    if (checklistItems.length > 0) {
      const completedTasks = checklistItems.filter(item => item.completed);
      return Math.round((completedTasks.length / checklistItems.length) * 100);
    }
    
    // Fallback to local completions
    const currentTaskCompletions = cleaningCompletions.filter((c) => c.taskId === cleaningTask.id);
    const completedTasks = currentTaskCompletions.filter((c) => c.completed);
    return Math.round((completedTasks.length / Math.max(cleaningChecklist.length, 1)) * 100);
  };

  const isOverdue = () => {
    if (!cleaningTask || !cleaningTask.dueDate) return false;
    try {
      const dueDate = new Date(cleaningTask.dueDate);
      if (isNaN(dueDate.getTime())) return false;
      return new Date() > dueDate;
    } catch (error) {
      return false;
    }
  };

  const getCurrentTurnUser = () => {
    if (!cleaningTask || !currentApartment) return null;
    return currentApartment.members.find((member) => member.id === cleaningTask.currentTurn) || null;
  };

  const getNextInQueue = (): User[] => {
    if (!cleaningTask || !currentApartment) return [];
    const currentIndex = cleaningTask.queue.indexOf(cleaningTask.currentTurn);
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
    <View className="flex-1 bg-gray-50">
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

      <ScrollView className="flex-1 px-6 py-6">
        {/* Current Turn Card */}
        <View className="bg-white rounded-2xl p-6 mb-6 shadow-sm">
          <View className="items-center">
            <View className={cn('w-16 h-16 rounded-full items-center justify-center mb-4', isMyTurn ? 'bg-blue-100' : 'bg-gray-100')}>
              <Ionicons name="person" size={32} color={isMyTurn ? '#007AFF' : '#6b7280'} />
            </View>

            <Text className="text-xl font-semibold text-gray-900 mb-1">
              {currentApartment.members.find((m) => m.id === cleaningTask.currentTurn)?.name || 'לא ידוע'}
            </Text>

            {(() => {
              const dow = cleaningSettings.preferredDayByUser[cleaningTask.currentTurn];
              if (dow === undefined) return null;
              return <Text className="text-sm text-gray-500 mb-1">מומלץ לנקות ביום {HEBREW_DAYS[dow]}</Text>;
            })()}

            {cleaningTask.dueDate && (
              <Text className={cn('text-sm mb-4', isOverdue() ? 'text-red-600' : 'text-gray-600')}>
                עד {formatDueDate(cleaningTask.dueDate)}{isOverdue() && ' (באיחור)'}
              </Text>
            )}

            {isMyTurn && (
              <>
                <Text className="text-sm text-gray-600 mb-2">התקדמות: {getCompletionPercentage()}%</Text>
                <View className="w-full bg-gray-200 rounded-full h-2 mb-4">
                  <View className="bg-blue-500 h-2 rounded-full" style={{ width: `${getCompletionPercentage()}%` }} />
                </View>
                <Pressable onPress={handleMarkCleaned} className={cn('py-3 px-8 rounded-xl', getCompletionPercentage() === 100 ? 'bg-green-500' : 'bg-gray-300')} disabled={getCompletionPercentage() !== 100}>
                  <Text className={cn('font-semibold text-lg text-center', getCompletionPercentage() === 100 ? 'text-white' : 'text-gray-500')}>
                    {getCompletionPercentage() === 100 ? 'סיימתי, העבר תור! ✨' : 'השלם כל המשימות'}
                  </Text>
                </Pressable>
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
            const currentIndex = cleaningTask.queue.indexOf(cleaningTask.currentTurn);
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

            {cleaningChecklist.map((task) => {
              const isCompleted = getTaskCompletion(task.id);
              const isEditing = renameTaskId === task.id;
              return (
                <View key={task.id} className="flex-row items-center py-3 px-2 rounded-xl mb-2 bg-gray-50">
                  <Pressable onPress={() => handleToggleTask(task.id, !isCompleted)} className={cn('w-6 h-6 rounded border-2 items-center justify-center ml-3', isCompleted ? 'bg-green-500 border-green-500' : 'border-gray-300')}>
                    {isCompleted && <Ionicons name="checkmark" size={16} color="white" />}
                  </Pressable>
                  {isEditing ? (
                    <TextInput
                      value={renameTaskName}
                      onChangeText={setRenameTaskName}
                      className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-base mr-2"
                      textAlign="right"
                      onSubmitEditing={() => {
                        if (renameTaskName.trim()) {
                          renameCleaningTask(task.id, renameTaskName.trim());
                          setRenameTaskId(null);
                          setRenameTaskName('');
                        } else {
                          setRenameTaskId(null);
                        }
                      }}
                      returnKeyType="done"
                    />
                  ) : (
                    <Text className={cn('flex-1 text-base', isCompleted ? 'text-gray-500 line-through' : 'text-gray-900')}>{task.name}</Text>
                  )}
                  {!isEditing ? (
                    <View className="flex-row">
                      <Pressable onPress={() => { setRenameTaskId(task.id); setRenameTaskName(task.name); }} className="p-2 mr-1">
                        <Ionicons name="pencil" size={18} color="#6b7280" />
                      </Pressable>
                      <Pressable onPress={() => removeCleaningTask(task.id)} className="p-2">
                        <Ionicons name="trash" size={18} color="#ef4444" />
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable onPress={() => { setRenameTaskId(null); setRenameTaskName(''); }} className="p-2">
                      <Ionicons name="close" size={18} color="#ef4444" />
                    </Pressable>
                  )}
                </View>
              );
            })}

            {/* Add new task */}
            <View className="flex-row items-center mt-4">
              <TextInput
                value={newTaskName}
                onChangeText={setNewTaskName}
                placeholder="הוסף משימה חדשה..."
                className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-base"
                textAlign="right"
                onSubmitEditing={handleAddTask}
                returnKeyType="done"
              />
              <Pressable onPress={handleAddTask} className="bg-blue-500 w-12 h-12 rounded-xl items-center justify-center mr-3">
                <Ionicons name="add" size={24} color="white" />
              </Pressable>
            </View>
          </View>
        )}

        {/* Last Cleaning Info */}
        {cleaningTask.lastCleaned && (
          <View className="bg-white rounded-2xl p-6 mb-6 shadow-sm">
            <Text className="text-lg font-semibold text-gray-900 mb-3">ניקיון אחרון</Text>
            <View className="flex-row items-center">
              <Ionicons name="checkmark-circle" size={20} color="#10b981" />
              <View className="mr-3">
                <Text className="text-gray-600">{new Intl.DateTimeFormat('he-IL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(cleaningTask.lastCleaned))}</Text>
                {cleaningTask.lastCleanedBy && (
                  <Text className="text-sm text-gray-500">על ידי {currentApartment.members.find((m) => m.id === cleaningTask.lastCleanedBy)?.name}</Text>
                )}
              </View>
            </View>
          </View>
        )}

        {/* Cleaning History */}
        {cleaningTask.history.length > 0 && (
          <View className="bg-white rounded-2xl p-6 shadow-sm">
            <Text className="text-lg font-semibold text-gray-900 mb-4">היסטוריית ניקיונות</Text>
            {cleaningTask.history.slice(-5).reverse().map((history) => {
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
        confirmText="כן, סיימתי!"
        cancelText="ביטול"
        onConfirm={() => {
          if (currentUser) markCleaned(currentUser.id);
          setShowConfirmDone(false);
        }}
        onCancel={() => setShowConfirmDone(false)}
      />
    </View>
  );
}