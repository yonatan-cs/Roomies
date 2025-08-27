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

interface RegisterScreenProps {
  onRegister: (user: any) => void;
  onSwitchToLogin: () => void;
}

export default function RegisterScreen({ onRegister, onSwitchToLogin }: RegisterScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async () => {
    setError(null);
    
    // Validation
    if (!email.trim() || !password.trim() || !confirmPassword.trim() || !fullName.trim()) {
      setError('אנא מלא את כל השדות הנדרשים');
      return;
    }

    if (!isValidEmail(email)) {
      setError('כתובת אימייל לא חוקית');
      return;
    }

    if (password.length < 6) {
      setError('הסיסמה חייבת להכיל לפחות 6 תווים');
      return;
    }

    if (password !== confirmPassword) {
      setError('הסיסמאות אינן תואמות');
      return;
    }

    if (fullName.trim().length < 2) {
      setError('השם חייב להכיל לפחות 2 תווים');
      return;
    }

    if (phone.trim() && !isValidPhone(phone)) {
      setError('מספר טלפון לא חוקי');
      return;
    }

    setLoading(true);

    try {
      // Create user with Firebase Auth
      const authUser = await firebaseAuth.signUp(
        email.trim(), 
        password, 
        fullName.trim()
      );

      // Create user document in Firestore
      const userData = {
        email: authUser.email,
        full_name: fullName.trim(),
        phone: phone.trim() || undefined,
      };

      await firestoreService.createUser(userData);

      // Combine auth and user data
      const user = {
        id: authUser.localId,
        email: authUser.email,
        name: fullName.trim(),
        phone: phone.trim(),
      };

      Alert.alert(
        'הרשמה בוצעה בהצלחה!',
        'החשבון שלך נוצר בהצלחה. כעת תוכל להתחיל להשתמש באפליקציה.',
        [{ text: 'המשך', onPress: () => onRegister(user) }]
      );
    } catch (error: any) {
      console.error('Registration error:', error);
      setError(error.message || 'שגיאה ברישום המשתמש');
    } finally {
      setLoading(false);
    }
  };

  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const isValidPhone = (phone: string): boolean => {
    // Israeli phone number regex (basic validation)
    const phoneRegex = /^0[5-9]\d{8}$/;
    return phoneRegex.test(phone.replace(/[-\s]/g, ''));
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView className="flex-1 px-6">
          <View className="pt-16 pb-8">
            {/* Header */}
            <View className="items-center mb-8">
              <Ionicons name="person-add" size={60} color="#007AFF" />
              <Text className="text-2xl font-bold text-gray-900 mt-4 text-center">
                צור חשבון חדש
              </Text>
              <Text className="text-base text-gray-600 mt-2 text-center">
                הצטרף לקהילת דירות השותפים
              </Text>
            </View>

            {/* Registration Form */}
            <View className="space-y-4">
              {/* Full Name Input */}
              <View>
                <Text className="text-gray-700 text-base mb-2">שם מלא *</Text>
                <TextInput
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="הכנס את שמך המלא"
                  className="border border-gray-300 rounded-xl px-4 py-3 text-base"
                  textAlign="right"
                  autoCapitalize="words"
                  editable={!loading}
                />
              </View>

              {/* Email Input */}
              <View>
                <Text className="text-gray-700 text-base mb-2">אימייל *</Text>
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

              {/* Phone Input */}
              <View>
                <Text className="text-gray-700 text-base mb-2">טלפון</Text>
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="054-1234567 (אופציונלי)"
                  className="border border-gray-300 rounded-xl px-4 py-3 text-base"
                  textAlign="right"
                  keyboardType="phone-pad"
                  editable={!loading}
                />
              </View>

              {/* Password Input */}
              <View>
                <Text className="text-gray-700 text-base mb-2">סיסמה *</Text>
                <View className="relative">
                  <TextInput
                    value={password}
                    onChangeText={setPassword}
                    placeholder="לפחות 6 תווים"
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

              {/* Confirm Password Input */}
              <View>
                <Text className="text-gray-700 text-base mb-2">אישור סיסמה *</Text>
                <View className="relative">
                  <TextInput
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="הזן שוב את הסיסמה"
                    className="border border-gray-300 rounded-xl px-4 py-3 text-base pr-12"
                    textAlign="right"
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!loading}
                  />
                  <Pressable
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute left-3 top-3"
                    disabled={loading}
                  >
                    <Ionicons 
                      name={showConfirmPassword ? "eye-off" : "eye"} 
                      size={24} 
                      color="#666" 
                    />
                  </Pressable>
                </View>
              </View>
            </View>

            {/* Error Message */}
            {error && (
              <View className="bg-red-50 border border-red-200 rounded-xl p-4 mt-4">
                <Text className="text-red-600 text-center">{error}</Text>
              </View>
            )}

            {/* Register Button */}
            <Pressable
              onPress={handleRegister}
              className={`py-4 px-6 rounded-xl mt-6 ${
                loading ? 'bg-gray-400' : 'bg-blue-500'
              }`}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white text-lg font-semibold text-center">
                  צור חשבון
                </Text>
              )}
            </Pressable>

            {/* Login Link */}
            <View className="flex-row justify-center items-center mt-6">
              <Pressable 
                onPress={onSwitchToLogin}
                disabled={loading}
              >
                <Text className="text-blue-500 text-base font-medium"> התחבר כאן </Text>
              </Pressable>
              <Text className="text-gray-600 text-base mr-1">יש לך כבר חשבון? </Text>
            </View>

            {/* Required Fields Note */}
            <Text className="text-gray-500 text-sm text-center mt-4">
              * שדות חובה
            </Text>
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}
