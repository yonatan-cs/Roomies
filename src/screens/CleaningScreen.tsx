import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, TextInput, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useStore } from '../state/store';
import { cn } from '../utils/cn';
import ConfirmModal from '../components/ConfirmModal';
import { User, ChecklistItem } from '../types';

export default function CleaningScreen() {
  const [newTaskName, setNewTaskName] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [showConfirmDone, setShowConfirmDone] = useState(false);

  // Selectors to avoid broad store subscriptions
  const currentUser = useStore((s) => s.currentUser);
  const currentApartment = useStore((s) => s.currentApartment);
  const cleaningTask = useStore((s) => s.cleaningTask);
  const checklistItems = useStore((s) => s.checklistItems);
  const isMyCleaningTurn = useStore((s) => s.isMyCleaningTurn);
  const loadCleaningTask = useStore((s) => s.loadCleaningTask);
  const loadCleaningChecklist = useStore((s) => s.loadCleaningChecklist);
  const completeChecklistItem = useStore((s) => s.completeChecklistItem);
  const uncompleteChecklistItem = useStore((s) => s.uncompleteChecklistItem);
  const addChecklistItem = useStore((s) => s.addChecklistItem);
  const finishCleaningTurn = useStore((s) => s.finishCleaningTurn);

  // Load data when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      
      const loadData = async () => {
        if (isActive) {
          await Promise.all([
            loadCleaningTask(),
            loadCleaningChecklist(),
          ]);
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
    }, [loadCleaningTask, loadCleaningChecklist])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      loadCleaningTask(),
      loadCleaningChecklist(),
    ]);
    setRefreshing(false);
  };

  const handleAddTask = async () => {
    if (!newTaskName.trim()) return;
    try {
      await addChecklistItem(newTaskName.trim());
      setNewTaskName('');
    } catch (error) {
      console.error('Error adding task:', error);
    }
  };

  const handleToggleTask = async (item: ChecklistItem) => {
    if (!isMyCleaningTurn) return;
    
    try {
      if (item.completed) {
        await uncompleteChecklistItem(item.id);
      } else {
        await completeChecklistItem(item.id);
      }
    } catch (error) {
      console.error('Error toggling task:', error);
    }
  };

  const handleFinishTurn = async () => {
    try {
      await finishCleaningTurn();
      setShowConfirmDone(false);
    } catch (error) {
      console.error('Error finishing turn:', error);
    }
  };

  const getCompletionPercentage = () => {
    if (checklistItems.length === 0) return 0;
    const completedTasks = checklistItems.filter(item => item.completed);
    return Math.round((completedTasks.length / checklistItems.length) * 100);
  };

  const getCurrentTurnUser = () => {
    if (!cleaningTask || !currentApartment) return null;
    const currentTurnId = getCurrentTurnUserId();
    if (!currentTurnId) return null;
    return currentApartment.members.find((member) => member.id === currentTurnId) || null;
  };

  // Helper function to get current turn user ID from either Firestore or local type
  const getCurrentTurnUserId = (): string | null => {
    if (!cleaningTask) return null;
    // Firestore returns user_id, local type has currentTurn
    return (cleaningTask as any).user_id || cleaningTask.currentTurn || null;
  };

  const getNextInQueue = (): User[] => {
    if (!cleaningTask || !currentApartment) return [];
    
    const queue = cleaningTask.queue || [];
    const currentTurnId = getCurrentTurnUserId();
    if (!currentTurnId) return [];
    
    const currentIndex = queue.indexOf(currentTurnId);
    const nextIndex = (currentIndex + 1) % queue.length;
    
    return currentApartment.members.filter(member => 
      queue.slice(nextIndex + 1).includes(member.id)
    );
  };

  const displayMemberName = (uid: string): string => {
    if (!currentApartment) return 'משתמש';
    const member = currentApartment.members.find(m => m.id === uid);
    return member?.name || 'משתמש';
  };

  const renderChecklistItem = ({ item }: { item: ChecklistItem }) => {
    const canToggle = isMyCleaningTurn && !item.completed;
    
    return (
      <View
        className={`flex-row items-center justify-between px-4 py-3 mb-2 rounded-2xl
          ${item.completed ? 'bg-green-50' : 'bg-white'}
          shadow-sm`}
        style={{ borderWidth: 1, borderColor: item.completed ? '#86efac' : '#eee' }}
      >
        <TouchableOpacity
          disabled={!canToggle}
          onPress={() => handleToggleTask(item)}
          style={{ opacity: canToggle ? 1 : 0.5 }}
        >
          {/* Custom checkbox */}
          <View
            style={{
              width: 22, height: 22, borderRadius: 6,
              borderWidth: 2, borderColor: item.completed ? '#22c55e' : '#aaa',
              alignItems: 'center', justifyContent: 'center',
              backgroundColor: item.completed ? '#22c55e' : 'transparent'
            }}
          >
            {item.completed ? <Text style={{ color:'#fff', fontWeight:'bold' }}>✓</Text> : null}
          </View>
        </TouchableOpacity>

        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text
            numberOfLines={2}
            className={`text-base ${item.completed ? 'text-green-700' : 'text-gray-900'}`}
            style={{ textDecorationLine: item.completed ? 'line-through' : 'none' }}
          >
            {item.title || '—'}
          </Text>

          {item.completed && (
            <Text className="text-xs text-green-700 mt-1">
              הושלם {item.completed_at ? new Date(item.completed_at).toLocaleString('he-IL') : ''}
              {item.completed_by ? ` • ע״י ${displayMemberName(item.completed_by)}` : ''}
            </Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <ScrollView 
      className="flex-1 bg-gray-50"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View className="p-4">
        {/* Header with turn status */}
        <View className="mb-6">
          <Text className="text-2xl font-bold text-gray-900 mb-2">משימות ניקיון</Text>
          
          {getCurrentTurnUser() ? (
            <View className="bg-white rounded-2xl p-4 shadow-sm">
              <Text className="text-sm text-gray-600 mb-1">
                התור של: {getCurrentTurnUser()?.name}
                {isMyCleaningTurn ? ' (שלך)' : ''}
              </Text>
              
              {!isMyCleaningTurn && (
                <Text className="text-xs text-gray-500">
                  אתה במצב צפייה — רק מי שבתורו יכול לסמן משימות.
                </Text>
              )}
              
              {/* Progress bar */}
              <View className="mt-3">
                <View className="flex-row justify-between text-sm mb-1">
                  <Text className="text-sm text-gray-600">התקדמות</Text>
                  <Text className="text-sm text-gray-600">{getCompletionPercentage()}%</Text>
                </View>
                <View className="w-full bg-gray-200 rounded-full h-2">
                  <View 
                    className="bg-green-500 h-2 rounded-full" 
                    style={{ width: `${getCompletionPercentage()}%` }}
                  />
                </View>
              </View>
            </View>
          ) : (
            <Text className="text-sm text-gray-500">טוען...</Text>
          )}
        </View>

        {/* Add new task (only if it's my turn) */}
        {isMyCleaningTurn && (
          <View className="bg-white rounded-2xl p-4 mb-6 shadow-sm">
            <Text className="text-lg font-semibold text-gray-900 mb-3">הוסף משימה חדשה</Text>
            <View className="flex-row">
              <TextInput
                value={newTaskName}
                onChangeText={setNewTaskName}
                placeholder="שם המשימה..."
                className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-base ml-2"
                textAlign="right"
                onSubmitEditing={handleAddTask}
                returnKeyType="done"
              />
              <TouchableOpacity
                onPress={handleAddTask}
                className="bg-blue-500 px-4 py-2 rounded-xl"
                disabled={!newTaskName.trim()}
              >
                <Text className="text-white font-semibold">הוסף</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Checklist items */}
        <View className="bg-white rounded-2xl p-4 mb-6 shadow-sm">
          <Text className="text-lg font-semibold text-gray-900 mb-4">רשימת משימות</Text>
          
          {checklistItems.length > 0 ? (
            <FlatList
              data={checklistItems}
              keyExtractor={(item) => item.id}
              renderItem={renderChecklistItem}
              scrollEnabled={false}
              ListEmptyComponent={
                <Text className="text-sm text-gray-500 text-center py-4">
                  אין משימות (עדיין).
                </Text>
              }
            />
          ) : (
            <Text className="text-sm text-gray-500 text-center py-4">
              טוען משימות...
            </Text>
          )}
        </View>

        {/* Finish turn button (only if it's my turn and all tasks are completed) */}
        {isMyCleaningTurn && getCompletionPercentage() === 100 && checklistItems.length > 0 && (
          <TouchableOpacity
            onPress={() => setShowConfirmDone(true)}
            className="bg-green-500 rounded-2xl p-4 shadow-sm"
          >
            <Text className="text-white text-center font-semibold text-lg">
              סיים תור ניקיון
            </Text>
          </TouchableOpacity>
        )}

        {/* Next in queue */}
        {getNextInQueue().length > 0 && (
          <View className="bg-white rounded-2xl p-4 mt-6 shadow-sm">
            <Text className="text-lg font-semibold text-gray-900 mb-2">הבא בתור</Text>
            {getNextInQueue().slice(0, 3).map((member, index) => (
              <Text key={member.id} className="text-gray-600">
                {index + 1}. {member.name}
              </Text>
            ))}
          </View>
        )}
      </View>

      {/* Confirmation modal */}
      <ConfirmModal
        visible={showConfirmDone}
        title="סיים תור ניקיון"
        message="האם אתה בטוח שברצונך לסיים את התור שלך? זה יעביר את התור לחבר הבא."
        onConfirm={handleFinishTurn}
        onCancel={() => setShowConfirmDone(false)}
        confirmText="סיים תור"
        cancelText="ביטול"
      />
    </ScrollView>
  );
}
