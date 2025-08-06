import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Alert,
  TextInput
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../state/store';
import { cn } from '../utils/cn';

export default function CleaningScreen() {
  const [newTaskName, setNewTaskName] = useState('');
  const { 
    currentUser, 
    currentApartment, 
    cleaningTask, 
    cleaningChecklist,
    cleaningCompletions,
    markCleaned, 
    initializeCleaning,
    addCleaningTask,
    toggleCleaningTask,
    checkOverdueTasks
  } = useStore();

  // Initialize cleaning if not exists and check for overdue tasks
  useEffect(() => {
    if (currentApartment && currentApartment.members.length > 0 && !cleaningTask) {
      const userIds = currentApartment.members.map(member => member.id);
      initializeCleaning(userIds);
    }
    
    // Check for overdue tasks
    checkOverdueTasks();
  }, [currentApartment, cleaningTask, initializeCleaning, checkOverdueTasks]);

  const handleMarkCleaned = () => {
    if (!currentUser || !cleaningTask) return;

    const isMyTurn = cleaningTask.currentTurn === currentUser.id;
    if (!isMyTurn) {
      Alert.alert('לא התורה שלך', 'כרגע זה לא התורה שלך לנקות');
      return;
    }

    // Check if all tasks are completed
    const currentTaskCompletions = cleaningCompletions.filter(
      c => c.taskId === cleaningTask.id
    );
    const completedTasks = currentTaskCompletions.filter(c => c.completed);

    if (completedTasks.length < cleaningChecklist.length) {
      Alert.alert(
        'משימות לא הושלמו',
        'אנא השלם את כל המשימות לפני סיום הניקיון',
        [{ text: 'הבנתי' }]
      );
      return;
    }

    Alert.alert(
      'אישור ניקיון',
      'האם באמת השלמת את כל משימות הניקיון?',
      [
        { text: 'ביטול', style: 'cancel' },
        { 
          text: 'כן, סיימתי!', 
          onPress: () => {
            markCleaned(currentUser.id);
          }
        }
      ]
    );
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
      c => c.taskId === cleaningTask.id && c.checklistItemId === taskId
    );
    return completion?.completed || false;
  };

  const getCompletionPercentage = () => {
    if (!cleaningTask) return 0;
    const currentTaskCompletions = cleaningCompletions.filter(
      c => c.taskId === cleaningTask.id
    );
    const completedTasks = currentTaskCompletions.filter(c => c.completed);
    return Math.round((completedTasks.length / cleaningChecklist.length) * 100);
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
    return currentApartment.members.find(member => member.id === cleaningTask.currentTurn);
  };

  const getNextInQueue = () => {
    if (!cleaningTask || !currentApartment) return [];
    const currentIndex = cleaningTask.queue.indexOf(cleaningTask.currentTurn);
    const nextUsers = [];
    
    for (let i = 1; i < cleaningTask.queue.length; i++) {
      const nextIndex = (currentIndex + i) % cleaningTask.queue.length;
      const user = currentApartment.members.find(member => member.id === cleaningTask.queue[nextIndex]);
      if (user) nextUsers.push(user);
    }
    
    return nextUsers;
  };

  const formatDate = (date: Date | string) => {
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      if (isNaN(dateObj.getTime())) {
        return 'תאריך לא תקין';
      }
      return new Intl.DateTimeFormat('he-IL', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      }).format(dateObj);
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
      return new Intl.DateTimeFormat('he-IL', {
        weekday: 'long',
        day: 'numeric',
        month: 'short'
      }).format(dateObj);
    } catch (error) {
      return 'תאריך לא תקין';
    }
  };

  const currentTurnUser = getCurrentTurnUser();
  const nextUsers = getNextInQueue();
  const isMyTurn = currentUser && cleaningTask && cleaningTask.currentTurn === currentUser.id;

  if (!currentApartment || !cleaningTask) {
    return (
      <View className="flex-1 bg-white justify-center items-center px-6">
        <Ionicons name="brush-outline" size={80} color="#6b7280" />
        <Text className="text-xl text-gray-600 text-center mt-4">
          טוען נתוני ניקיון...
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-white px-6 pt-16 pb-6 shadow-sm">
        <Text className="text-2xl font-bold text-gray-900 text-center mb-2">
          סבב הניקיון
        </Text>
        <Text className="text-gray-600 text-center">
          {currentApartment.name}
        </Text>
      </View>

      <ScrollView className="flex-1 px-6 py-6">
        {/* Current Turn Card */}
        <View className="bg-white rounded-2xl p-6 mb-6 shadow-sm">
          <View className="items-center">
            <View className={cn(
              "w-16 h-16 rounded-full items-center justify-center mb-4",
              isMyTurn ? "bg-blue-100" : "bg-gray-100"
            )}>
              <Ionicons 
                name="person" 
                size={32} 
                color={isMyTurn ? "#007AFF" : "#6b7280"} 
              />
            </View>
            
            <Text className="text-xl font-semibold text-gray-900 mb-2">
              {currentTurnUser?.name || 'לא ידוע'}
            </Text>
            
            <View className={cn(
              "px-4 py-2 rounded-full mb-2",
              isMyTurn ? "bg-blue-100" : "bg-gray-100"
            )}>
              <Text className={cn(
                "font-medium",
                isMyTurn ? "text-blue-700" : "text-gray-600"
              )}>
                {isMyTurn ? 'התורה שלך!' : 'התורה שלו/שלה'}
              </Text>
            </View>

            {cleaningTask.dueDate && (
              <Text className={cn(
                "text-sm mb-4",
                isOverdue() ? "text-red-600" : "text-gray-600"
              )}>
                עד {formatDueDate(cleaningTask.dueDate)}
                {isOverdue() && ' (באיחור)'}
              </Text>
            )}

            {isMyTurn && (
              <>
                <Text className="text-sm text-gray-600 mb-2">
                  התקדמות: {getCompletionPercentage()}%
                </Text>
                <View className="w-full bg-gray-200 rounded-full h-2 mb-4">
                  <View 
                    className="bg-blue-500 h-2 rounded-full" 
                    style={{ width: `${getCompletionPercentage()}%` }}
                  />
                </View>
                <Pressable
                  onPress={handleMarkCleaned}
                  className={cn(
                    "py-3 px-8 rounded-xl",
                    getCompletionPercentage() === 100 ? "bg-green-500" : "bg-gray-300"
                  )}
                  disabled={getCompletionPercentage() !== 100}
                >
                  <Text className={cn(
                    "font-semibold text-lg text-center",
                    getCompletionPercentage() === 100 ? "text-white" : "text-gray-500"
                  )}>
                    {getCompletionPercentage() === 100 ? 'סיימתי, העבר תור! ✨' : 'השלם כל המשימות'}
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        </View>

        {/* Queue */}
        <View className="bg-white rounded-2xl p-6 mb-6 shadow-sm">
          <Text className="text-lg font-semibold text-gray-900 mb-4">
            התור הבא
          </Text>
          
          {nextUsers.map((user, index) => (
            <View key={user.id} className="flex-row items-center py-3">
              <View className="bg-gray-100 w-10 h-10 rounded-full items-center justify-center">
                <Text className="text-gray-600 font-medium">
                  {index + 2}
                </Text>
              </View>
              <Text className="text-gray-900 text-base mr-3">
                {user.name}
              </Text>
            </View>
          ))}
        </View>

        {/* Cleaning Tasks */}
        {isMyTurn && (
          <View className="bg-white rounded-2xl p-6 mb-6 shadow-sm">
            <Text className="text-lg font-semibold text-gray-900 mb-4">
              רשימת משימות ניקיון
            </Text>
            
            {cleaningChecklist.map((task) => {
              const isCompleted = getTaskCompletion(task.id);
              return (
                <Pressable
                  key={task.id}
                  onPress={() => handleToggleTask(task.id, !isCompleted)}
                  className="flex-row items-center py-3 px-2 rounded-xl mb-2 bg-gray-50"
                >
                  <View className={cn(
                    "w-6 h-6 rounded border-2 items-center justify-center ml-3",
                    isCompleted ? "bg-green-500 border-green-500" : "border-gray-300"
                  )}>
                    {isCompleted && (
                      <Ionicons name="checkmark" size={16} color="white" />
                    )}
                  </View>
                  <Text className={cn(
                    "flex-1 text-base",
                    isCompleted ? "text-gray-500 line-through" : "text-gray-900"
                  )}>
                    {task.name}
                  </Text>
                </Pressable>
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
              <Pressable
                onPress={handleAddTask}
                className="bg-blue-500 w-12 h-12 rounded-xl items-center justify-center mr-3"
              >
                <Ionicons name="add" size={24} color="white" />
              </Pressable>
            </View>
          </View>
        )}

        {/* Last Cleaning Info */}
        {cleaningTask.lastCleaned && (
          <View className="bg-white rounded-2xl p-6 mb-6 shadow-sm">
            <Text className="text-lg font-semibold text-gray-900 mb-3">
              ניקיון אחרון
            </Text>
            
            <View className="flex-row items-center">
              <Ionicons name="checkmark-circle" size={20} color="#10b981" />
              <View className="mr-3">
                <Text className="text-gray-600">
                  {formatDate(cleaningTask.lastCleaned)}
                </Text>
                {cleaningTask.lastCleanedBy && (
                  <Text className="text-sm text-gray-500">
                    על ידי {currentApartment.members.find(m => m.id === cleaningTask.lastCleanedBy)?.name}
                  </Text>
                )}
              </View>
            </View>
          </View>
        )}

        {/* Cleaning History */}
        {cleaningTask.history.length > 0 && (
          <View className="bg-white rounded-2xl p-6 shadow-sm">
            <Text className="text-lg font-semibold text-gray-900 mb-4">
              היסטוריית ניקיונות
            </Text>
            
            {cleaningTask.history.slice(-5).reverse().map((history) => {
              const user = currentApartment.members.find(m => m.id === history.userId);
              return (
                <View key={history.id} className="flex-row items-center py-2">
                  <Ionicons name="brush" size={16} color="#10b981" />
                  <View className="mr-3">
                    <Text className="text-gray-900">
                      {user?.name || 'משתמש לא ידוע'}
                    </Text>
                    <Text className="text-sm text-gray-500">
                      {formatDate(history.cleanedAt)}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}