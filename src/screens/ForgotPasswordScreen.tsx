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
  TouchableWithoutFeedback,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { firebaseAuth } from '../services/firebase-auth';

interface ForgotPasswordScreenProps {
  onBack: () => void;
}

export default function ForgotPasswordScreen({ onBack }: ForgotPasswordScreenProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleResetPassword = async () => {
    setError(null);
    
    if (!email.trim()) {
      setError('אנא הכנס כתובת אימייל');
      return;
    }

    if (!isValidEmail(email)) {
      setError('כתובת אימייל לא חוקית');
      return;
    }

    setLoading(true);

    try {
      await firebaseAuth.resetPassword(email.trim());
      setSuccess(true);
      
      Alert.alert(
        'איפוס סיסמה נשלח',
        'קישור לאיפוס הסיסמה נשלח לכתובת האימייל שלך. אנא בדוק את תיבת הדואר שלך.',
        [
          { 
            text: 'בסדר', 
            onPress: () => onBack() 
          }
        ]
      );
    } catch (error: any) {
      console.error('Reset password error:', error);
      setError(error.message || 'שגיאה בשליחת איפוס סיסמה');
    } finally {
      setLoading(false);
    }
  };

  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView className="flex-1 px-6">
          <View className="pt-16 pb-8">
            {/* Back Button */}
            <Pressable 
              onPress={onBack} 
              className="flex-row items-center mb-8"
              disabled={loading}
            >
              <Ionicons name="arrow-back" size={24} color="#007AFF" />
              <Text className="text-blue-500 text-lg mr-2">חזור</Text>
            </Pressable>

            {/* Header */}
            <View className="items-center mb-12">
              <Ionicons name="key" size={80} color="#007AFF" />
              <Text className="text-3xl font-bold text-gray-900 mt-4 text-center">
                איפוס סיסמה
              </Text>
              <Text className="text-lg text-gray-600 mt-2 text-center">
                הכנס את כתובת האימייל שלך ונשלח לך קישור לאיפוס הסיסמה
              </Text>
            </View>

            {/* Email Input */}
            <View>
              <Text className="text-gray-700 text-base mb-2">כתובת אימייל</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="הכנס את כתובת האימייל שלך"
                className="border border-gray-300 rounded-xl px-4 py-3 text-base"
                textAlign="right"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading && !success}
              />
            </View>

            {/* Error Message */}
            {error && (
              <View className="bg-red-50 border border-red-200 rounded-xl p-4 mt-4">
                <Text className="text-red-600 text-center">{error}</Text>
              </View>
            )}

            {/* Success Message */}
            {success && (
              <View className="bg-green-50 border border-green-200 rounded-xl p-4 mt-4">
                <View className="flex-row items-center justify-center">
                  <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                  <Text className="text-green-600 text-center mr-2">
                    קישור נשלח בהצלחה!
                  </Text>
                </View>
              </View>
            )}

            {/* Reset Password Button */}
            <Pressable
              onPress={handleResetPassword}
              className={`py-4 px-6 rounded-xl mt-8 ${
                loading || success ? 'bg-gray-400' : 'bg-blue-500'
              }`}
              disabled={loading || success}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white text-lg font-semibold text-center">
                  {success ? 'נשלח בהצלחה' : 'שלח קישור לאיפוס'}
                </Text>
              )}
            </Pressable>

            {/* Info Text */}
            <View className="mt-8 p-4 bg-blue-50 rounded-xl">
              <Text className="text-blue-800 text-center text-sm leading-6">
                לאחר שליחת הקישור, בדוק את תיבת הדואר שלך (כולל תיקיית הספאם). 
                הקישור יהיה בתוקף למשך 60 דקות.
              </Text>
            </View>

            {/* Contact Support */}
            <Text className="text-gray-500 text-center text-sm mt-6">
              נתקלת בבעיה? צור קשר עם התמיכה הטכנית
            </Text>
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}
