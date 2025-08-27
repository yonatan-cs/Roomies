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
import { firestoreService } from '../services/firestore-service';

interface LoginScreenProps {
  onLogin: (user: any) => void;
  onSwitchToRegister: () => void;
  onSwitchToForgotPassword: () => void;
}

export default function LoginScreen({ 
  onLogin, 
  onSwitchToRegister, 
  onSwitchToForgotPassword 
}: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setError(null);
    
    if (!email.trim() || !password.trim()) {
      setError('אנא מלא את כל השדות');
      return;
    }

    if (!isValidEmail(email)) {
      setError('כתובת אימייל לא חוקית');
      return;
    }

    setLoading(true);

    try {
      // Sign in with Firebase Auth
      const authUser = await firebaseAuth.signIn(email.trim(), password);
      
      // Get user data from Firestore
      const userData = await firestoreService.getUser(authUser.localId);
      
      if (!userData) {
        // User doesn't exist in Firestore, this shouldn't happen
        throw new Error('נתוני המשתמש לא נמצאו');
      }

      // Combine auth and user data
      const user = {
        id: authUser.localId,
        email: authUser.email,
        name: userData.full_name,
        phone: userData.phone,
        current_apartment_id: userData.current_apartment_id,
      };

      onLogin(user);
    } catch (error: any) {
      console.error('Login error:', error);
      setError(error.message || 'שגיאה בהתחברות');
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
          <View className="pt-20 pb-8">
            {/* Header */}
            <View className="items-center mb-12">
              <Ionicons name="home" size={80} color="#007AFF" />
              <Text className="text-3xl font-bold text-gray-900 mt-4 text-center">
                דירת שותפים
              </Text>
              <Text className="text-lg text-gray-600 mt-2 text-center">
                התחבר לחשבון שלך
              </Text>
            </View>

            {/* Login Form */}
            <View className="space-y-4">
              {/* Email Input */}
              <View>
                <Text className="text-gray-700 text-base mb-2">אימייל</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="הכנס את כתובת האימייל"
                  className="border border-gray-300 rounded-xl px-4 py-3 text-base"
                  textAlign="right"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                />
              </View>

              {/* Password Input */}
              <View>
                <Text className="text-gray-700 text-base mb-2">סיסמה</Text>
                <View className="relative">
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="הכנס את הסיסמה"
                    className="border border-gray-300 rounded-xl px-4 py-3 text-base pr-12"
                    textAlign="right"
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!loading}
                  />
                  <Pressable
                    onPress={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-3"
                    disabled={loading}
                  >
                    <Ionicons 
                      name={showPassword ? "eye-off" : "eye"} 
                      size={24} 
                      color="#666" 
                    />
                  </Pressable>
                </View>
              </View>

              {/* Forgot Password Link */}
              <Pressable 
                onPress={onSwitchToForgotPassword}
                className="self-end"
                disabled={loading}
              >
                <Text className="text-blue-500 text-base">שכחת סיסמה?</Text>
              </Pressable>
            </View>

            {/* Error Message */}
            {error && (
              <View className="bg-red-50 border border-red-200 rounded-xl p-4 mt-4">
                <Text className="text-red-600 text-center">{error}</Text>
              </View>
            )}

            {/* Login Button */}
            <Pressable
              onPress={handleLogin}
              className={`py-4 px-6 rounded-xl mt-8 ${
                loading ? 'bg-gray-400' : 'bg-blue-500'
              }`}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white text-lg font-semibold text-center">
                  התחבר
                </Text>
              )}
            </Pressable>

            {/* Register Link */}
            <View className="flex-row justify-center items-center mt-6">
              <Pressable 
                onPress={onSwitchToRegister}
                disabled={loading}
              >
                <Text className="text-blue-500 text-base font-medium">הרשם כאן</Text>
              </Pressable>
              <Text className="text-gray-600 text-base mr-1">אין לך חשבון? </Text>
            </View>
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}
