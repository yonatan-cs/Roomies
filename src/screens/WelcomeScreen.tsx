import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Keyboard,
  TouchableWithoutFeedback
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../state/store';

export default function WelcomeScreen() {
  const [mode, setMode] = useState<'select' | 'create' | 'join'>('select');
  const [apartmentName, setApartmentName] = useState('');
  const [userName, setUserName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { setCurrentUser, createApartment, joinApartment } = useStore();

  const handleCreateApartment = () => {
    setError(null);
    if (!apartmentName.trim() || !userName.trim()) {
      setError('אנא מלא את כל השדות');
      return;
    }

    // Create user
    const userId = Date.now().toString();
    const user = { id: userId, name: userName.trim() };
    setCurrentUser(user);

    // Create apartment with only creator; rotation will initialize on first visit to Cleaning
    createApartment(apartmentName.trim());
  };

  const handleJoinApartment = () => {
    setError(null);
    if (!userName.trim() || !joinCode.trim()) {
      setError('אנא מלא את כל השדות');
      return;
    }

    joinApartment(joinCode.trim().toUpperCase(), userName.trim());
  };

  if (mode === 'select') {
    return (
      <View className="flex-1 bg-white px-6">
        <View className="flex-1 justify-center">
          <View className="items-center mb-12">
            <Ionicons name="home" size={80} color="#007AFF" />
            <Text className="text-3xl font-bold text-gray-900 mt-4 text-center">
              דירת שותפים
            </Text>
            <Text className="text-lg text-gray-600 mt-2 text-center">
              ניהול חכם לחיים משותפים
            </Text>
          </View>

          <View className="space-y-4">
            <Pressable
              onPress={() => setMode('create')}
              className="bg-blue-500 py-4 px-6 rounded-xl flex-row items-center justify-center"
            >
              <Ionicons name="add-circle-outline" size={24} color="white" />
              <Text className="text-white text-lg font-semibold mr-2">יצירת דירה חדשה</Text>
            </Pressable>

            <Pressable
              onPress={() => setMode('join')}
              className="bg-gray-100 py-4 px-6 rounded-xl flex-row items-center justify-center"
            >
              <Ionicons name="people-outline" size={24} color="#007AFF" />
              <Text className="text-blue-500 text-lg font-semibold mr-2">הצטרפות לדירה קיימת</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView className="flex-1 px-6">
          <View className="pt-16 pb-8">
            <Pressable onPress={() => setMode('select')} className="flex-row items-center mb-6">
              <Ionicons name="arrow-back" size={24} color="#007AFF" />
              <Text className="text-blue-500 text-lg mr-2">חזור</Text>
            </Pressable>

            <Text className="text-2xl font-bold text-gray-900 text-center mb-8">
              {mode === 'create' ? 'יצירת דירה חדשה' : 'הצטרפות לדירה'}
            </Text>

            <View className="space-y-4">
              <View>
                <Text className="text-gray-700 text-base mb-2">השם שלך</Text>
                <TextInput
                  value={userName}
                  onChangeText={setUserName}
                  placeholder="הכנס את שמך"
                  className="border border-gray-300 rounded-xl px-4 py-3 text-base"
                  textAlign="right"
                />
              </View>

              {mode === 'create' && (
                <View>
                  <Text className="text-gray-700 text-base mb-2">שם הדירה</Text>
                  <TextInput
                    value={apartmentName}
                    onChangeText={setApartmentName}
                    placeholder="דירת השותפים שלנו"
                    className="border border-gray-300 rounded-xl px-4 py-3 text-base"
                    textAlign="right"
                  />
                </View>
              )}

              {mode === 'join' && (
                <View>
                  <Text className="text-gray-700 text-base mb-2">קוד דירה</Text>
                  <TextInput
                    value={joinCode}
                    onChangeText={setJoinCode}
                    placeholder="הכנס קוד דירה"
                    className="border border-gray-300 rounded-xl px-4 py-3 text-base"
                    textAlign="center"
                    autoCapitalize="characters"
                    maxLength={6}
                  />
                </View>
              )}
            </View>

            {error && (
              <Text className="text-red-600 text-center mt-4">{error}</Text>
            )}

            <Pressable
              onPress={mode === 'create' ? handleCreateApartment : handleJoinApartment}
              className="bg-blue-500 py-4 px-6 rounded-xl mt-8"
            >
              <Text className="text-white text-lg font-semibold text-center">
                {mode === 'create' ? 'יצירת הדירה' : 'הצטרפות'}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}
