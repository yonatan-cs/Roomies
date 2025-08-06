import React from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../state/store';
import { cn } from '../utils/cn';

export default function CleaningScreen() {
  const { 
    currentUser, 
    currentApartment, 
    cleaningTask, 
    markCleaned, 
    initializeCleaning 
  } = useStore();

  // Initialize cleaning if not exists
  React.useEffect(() => {
    if (currentApartment && currentApartment.members.length > 0 && !cleaningTask) {
      const userIds = currentApartment.members.map(member => member.id);
      initializeCleaning(userIds);
    }
  }, [currentApartment, cleaningTask, initializeCleaning]);

  const handleMarkCleaned = () => {
    if (!currentUser || !cleaningTask) return;

    const isMyTurn = cleaningTask.currentTurn === currentUser.id;
    if (!isMyTurn) {
      Alert.alert('לא התורה שלך', 'כרגע זה לא התורה שלך לנקות');
      return;
    }

    Alert.alert(
      'אישור ניקיון',
      'האם באמת ניקית את הדירה?',
      [
        { text: 'ביטול', style: 'cancel' },
        { 
          text: 'כן, ניקיתי!', 
          onPress: () => {
            markCleaned(currentUser.id);
          }
        }
      ]
    );
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

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('he-IL', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
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
              "px-4 py-2 rounded-full mb-4",
              isMyTurn ? "bg-blue-100" : "bg-gray-100"
            )}>
              <Text className={cn(
                "font-medium",
                isMyTurn ? "text-blue-700" : "text-gray-600"
              )}>
                {isMyTurn ? 'התורה שלך!' : 'התורה שלו/שלה'}
              </Text>
            </View>

            {isMyTurn && (
              <Pressable
                onPress={handleMarkCleaned}
                className="bg-green-500 py-3 px-8 rounded-xl"
              >
                <Text className="text-white font-semibold text-lg">
                  ניקיתי! ✨
                </Text>
              </Pressable>
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