import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
  Share
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../state/store';
import Clipboard from '@react-native-clipboard/clipboard';

export default function SettingsScreen() {
  const { currentUser, currentApartment, setCurrentUser } = useStore();
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState(currentUser?.name || '');

  const handleSaveName = () => {
    if (!newName.trim()) {
      Alert.alert('שגיאה', 'השם לא יכול להיות ריק');
      return;
    }

    if (currentUser) {
      setCurrentUser({
        ...currentUser,
        name: newName.trim()
      });
    }
    setEditingName(false);
  };

  const handleCopyCode = async () => {
    if (!currentApartment?.code) return;
    
    try {
      Clipboard.setString(currentApartment.code);
      Alert.alert('הועתק!', 'קוד הדירה הועתק ללוח');
    } catch (error) {
      Alert.alert('שגיאה', 'לא ניתן להעתיק את הקוד');
    }
  };

  const handleShareCode = async () => {
    if (!currentApartment) return;

    try {
      await Share.share({
        message: `הצטרף לדירת השותפים שלנו!\nשם הדירה: ${currentApartment.name}\nקוד הצטרפות: ${currentApartment.code}`,
        title: 'הצטרפות לדירת שותפים'
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleLeaveApartment = () => {
    Alert.alert(
      'עזיבת דירה',
      'האם אתה בטוח שברצונך לעזוב את הדירה? פעולה זו אינה ניתנת לביטול.',
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'כן, עזוב דירה',
          style: 'destructive',
          onPress: () => {
            // In a real app, this would call an API to remove the user from the apartment
            // For now, we'll just reset the current apartment
            useStore.setState({ 
              currentApartment: undefined,
              cleaningTask: undefined,
              expenses: [],
              shoppingItems: []
            });
          }
        }
      ]
    );
  };

  if (!currentUser || !currentApartment) {
    return (
      <View className="flex-1 bg-white justify-center items-center">
        <Text className="text-gray-500">טוען...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-white px-6 pt-16 pb-6 shadow-sm">
        <Text className="text-2xl font-bold text-gray-900 text-center">
          הגדרות
        </Text>
      </View>

      <ScrollView className="flex-1 px-6 py-6">
        {/* Apartment Details */}
        <View className="bg-white rounded-2xl p-6 mb-6 shadow-sm">
          <Text className="text-lg font-semibold text-gray-900 mb-4">
            פרטי הדירה
          </Text>
          
          <View className="mb-4">
            <Text className="text-gray-600 text-sm mb-1">שם הדירה</Text>
            <Text className="text-gray-900 text-lg font-medium">
              {currentApartment.name}
            </Text>
          </View>

          <View className="mb-4">
            <Text className="text-gray-600 text-sm mb-1">קוד הצטרפות</Text>
            <View className="flex-row items-center justify-between bg-gray-50 p-3 rounded-xl">
              <Text className="text-gray-900 text-lg font-mono font-bold">
                {currentApartment.code}
              </Text>
              <View className="flex-row">
                <Pressable
                  onPress={handleCopyCode}
                  className="bg-blue-100 p-2 rounded-lg ml-2"
                >
                  <Ionicons name="copy-outline" size={20} color="#007AFF" />
                </Pressable>
                <Pressable
                  onPress={handleShareCode}
                  className="bg-green-100 p-2 rounded-lg"
                >
                  <Ionicons name="share-outline" size={20} color="#10b981" />
                </Pressable>
              </View>
            </View>
          </View>

          <Text className="text-xs text-gray-500">
            שתף את הקוד עם שותפים חדשים כדי שיוכלו להצטרף לדירה
          </Text>
        </View>

        {/* Roommates */}
        <View className="bg-white rounded-2xl p-6 mb-6 shadow-sm">
          <Text className="text-lg font-semibold text-gray-900 mb-4">
            שותפים בדירה ({currentApartment.members.length})
          </Text>
          
          {currentApartment.members.map((member) => (
            <View key={member.id} className="flex-row items-center py-3">
              <View className="w-12 h-12 bg-blue-100 rounded-full items-center justify-center">
                <Text className="text-blue-700 font-semibold text-lg">
                  {member.name.charAt(0)}
                </Text>
              </View>
              <View className="mr-3 flex-1">
                <Text className="text-gray-900 font-medium">
                  {member.name} {member.id === currentUser.id && '(אתה)'}
                </Text>
                <Text className="text-gray-500 text-sm">
                  {member.email || 'אין אימייל'}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* My Profile */}
        <View className="bg-white rounded-2xl p-6 mb-6 shadow-sm">
          <Text className="text-lg font-semibold text-gray-900 mb-4">
            הפרופיל שלי
          </Text>
          
          <View className="mb-4">
            <Text className="text-gray-600 text-sm mb-2">שם מלא</Text>
            {editingName ? (
              <View className="flex-row items-center">
                <TextInput
                  value={newName}
                  onChangeText={setNewName}
                  className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-base"
                  textAlign="right"
                  autoFocus
                />
                <View className="flex-row mr-3">
                  <Pressable
                    onPress={handleSaveName}
                    className="bg-green-100 p-2 rounded-lg ml-2"
                  >
                    <Ionicons name="checkmark" size={20} color="#10b981" />
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setEditingName(false);
                      setNewName(currentUser.name || '');
                    }}
                    className="bg-red-100 p-2 rounded-lg"
                  >
                    <Ionicons name="close" size={20} color="#ef4444" />
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable
                onPress={() => setEditingName(true)}
                className="flex-row items-center justify-between bg-gray-50 p-3 rounded-xl"
              >
                <Text className="text-gray-900 text-base">
                  {currentUser.name}
                </Text>
                <Ionicons name="pencil-outline" size={20} color="#6b7280" />
              </Pressable>
            )}
          </View>

          <View className="mb-4">
            <Text className="text-gray-600 text-sm mb-1">אימייל</Text>
            <Text className="text-gray-500">
              {currentUser.email || 'לא מוגדר'}
            </Text>
          </View>
        </View>

        {/* Danger Zone */}
        <View className="bg-white rounded-2xl p-6 shadow-sm border-2 border-red-100">
          <Text className="text-lg font-semibold text-red-600 mb-4">
            אזור סכנה
          </Text>
          
          <Pressable
            onPress={handleLeaveApartment}
            className="bg-red-500 py-3 px-6 rounded-xl"
          >
            <Text className="text-white font-semibold text-center">
              עזיבת הדירה
            </Text>
          </Pressable>
          
          <Text className="text-xs text-gray-500 text-center mt-2">
            פעולה זו תסיר אותך מהדירה ותמחק את כל הנתונים המקומיים
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}