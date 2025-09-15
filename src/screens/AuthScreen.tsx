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
import { Screen } from '../components/Screen';
import { AsyncButton } from '../components/AsyncButton';
import { NumericInput } from '../components/NumericInput';
import ForgotPasswordScreen from './ForgotPasswordScreen';

interface AuthScreenProps {
  onAuthSuccess: (user: any) => void;
}

export default function AuthScreen({ onAuthSuccess }: AuthScreenProps) {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Register form state
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPassword, setRegisterPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);

  const handleLogin = async () => {
    setLoginError(null);
    
    if (!loginEmail.trim() || !loginPassword.trim()) {
      setLoginError('אנא מלא את כל השדות');
      return;
    }

    if (!isValidEmail(loginEmail)) {
      setLoginError('כתובת אימייל לא חוקית');
      return;
    }

    setLoginLoading(true);

    try {
      // Sign in with Firebase Auth
      const authUser = await firebaseAuth.signIn(loginEmail.trim(), loginPassword);
      
      // Wait a moment for authentication to be fully ready
      console.log('⏳ Waiting for authentication to stabilize after sign in...');
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Get user data from Firestore
      const userData = await firestoreService.getUser(authUser.localId);
      
      if (!userData) {
        // User doesn't exist in Firestore, this shouldn't happen
        throw new Error('נתוני המשתמש לא נמצאו');
      }

      // Get user's current apartment based on membership
      const currentApartment = await firestoreService.getUserCurrentApartment(authUser.localId);

      // Combine auth and user data
      const user = {
        id: authUser.localId,
        email: authUser.email,
        name: userData.full_name,
        display_name: userData.display_name || userData.full_name,
        phone: userData.phone,
        current_apartment_id: currentApartment?.id,
      };

      onAuthSuccess(user);
    } catch (error: any) {
      console.error('Login error:', error);
      setLoginError(error.message || 'שגיאה בהתחברות');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegister = async () => {
    setRegisterError(null);
    
    // Validation
    if (!registerEmail.trim() || !registerPassword.trim() || !confirmPassword.trim() || !fullName.trim()) {
      setRegisterError('אנא מלא את כל השדות הנדרשים');
      return;
    }

    if (!isValidEmail(registerEmail)) {
      setRegisterError('כתובת אימייל לא חוקית');
      return;
    }

    if (registerPassword.length < 6) {
      setRegisterError('הסיסמה חייבת להכיל לפחות 6 תווים');
      return;
    }

    if (registerPassword !== confirmPassword) {
      setRegisterError('הסיסמאות אינן תואמות');
      return;
    }

    if (fullName.trim().length < 2) {
      setRegisterError('השם חייב להכיל לפחות 2 תווים');
      return;
    }

    if (phone.trim() && !isValidPhone(phone)) {
      setRegisterError('מספר טלפון לא חוקי');
      return;
    }

    setRegisterLoading(true);

    try {
      // Create user with Firebase Auth
      const authUser = await firebaseAuth.signUp(
        registerEmail.trim(), 
        registerPassword, 
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
        display_name: fullName.trim(),
        phone: phone.trim(),
      };

      Alert.alert(
        'הרשמה בוצעה בהצלחה!',
        'החשבון שלך נוצר בהצלחה. כעת תוכל להתחיל להשתמש באפליקציה.',
        [{ text: 'המשך', onPress: () => onAuthSuccess(user) }]
      );
    } catch (error: any) {
      console.error('Registration error:', error);
      setRegisterError(error.message || 'שגיאה ברישום המשתמש');
    } finally {
      setRegisterLoading(false);
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

  // Show forgot password screen
  if (showForgotPassword) {
    return (
      <ForgotPasswordScreen
        onBack={() => setShowForgotPassword(false)}
      />
    );
  }

  return (
    <Screen withPadding={true} keyboardVerticalOffset={0}>
      <View className="pt-16 pb-8">
        {/* Header */}
        <View className="items-center mb-8">
          <Ionicons name="home" size={80} color="#007AFF" />
          <Text className="text-3xl font-bold text-gray-900 mt-4 text-center">
            דירת שותפים
          </Text>
          <Text className="text-lg text-gray-600 mt-2 text-center">
            ניהול חכם לחיים משותפים
          </Text>
        </View>

        {/* Tabs with subtle per-mode accent */}
        <View className="flex-row bg-gray-100 rounded-xl p-1 mb-8">
          <Pressable
            className={`flex-1 py-3 rounded-lg items-center ${tab === 'login' ? 'bg-white' : ''}`}
            onPress={() => setTab('login')}
          >
            <Text className={`font-semibold ${tab === 'login' ? 'text-blue-600' : 'text-gray-600'}`}>
              התחברות
            </Text>
            {tab === 'login' && (
              <View className="h-0.5 bg-blue-600 w-10 mt-2 rounded-full" />
            )}
          </Pressable>
          <Pressable
            className={`flex-1 py-3 rounded-lg items-center ${tab === 'register' ? 'bg-white' : ''}`}
            onPress={() => setTab('register')}
          >
            <Text className={`font-semibold ${tab === 'register' ? 'text-green-600' : 'text-gray-600'}`}>
              הרשמה
            </Text>
            {tab === 'register' && (
              <View className="h-0.5 bg-green-600 w-10 mt-2 rounded-full" />
            )}
          </Pressable>
        </View>

        {/* Login Form */}
        {tab === 'login' && (
          <View className="space-y-4">
            {/* Email Input (emphasized, calm) */}
            <View>
              <Text className="text-gray-700 text-base mb-2">אימייל</Text>
              <TextInput
                value={loginEmail}
                onChangeText={setLoginEmail}
                placeholder="הכנס את כתובת האימייל"
                className="border border-gray-300 rounded-xl px-4 py-3 text-base bg-white"
                textAlign="right"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loginLoading}
                returnKeyType="next"
                blurOnSubmit={false}
              />
            </View>

            {/* Password Input */}
            <View>
              <Text className="text-gray-700 text-base mb-2">סיסמה</Text>
              <View className="relative">
                <TextInput
                  value={loginPassword}
                  onChangeText={setLoginPassword}
                  placeholder="הכנס את הסיסמה"
                  className="border border-gray-300 rounded-xl px-4 py-3 text-base pr-12 bg-white"
                  textAlign="right"
                  secureTextEntry={!showLoginPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loginLoading}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                />
                <Pressable
                  onPress={() => setShowLoginPassword(!showLoginPassword)}
                  className="absolute left-3 top-3"
                  disabled={loginLoading}
                >
                  <Ionicons 
                    name={showLoginPassword ? "eye-off" : "eye"} 
                    size={24} 
                    color="#666" 
                  />
                </Pressable>
              </View>
            </View>

            {/* Forgot Password Link */}
            <Pressable 
              onPress={() => setShowForgotPassword(true)}
              className="self-end"
              disabled={loginLoading}
            >
              <Text className="text-blue-600 text-base">שכחת סיסמה?</Text>
            </Pressable>

            {/* Error Message */}
            {loginError && (
              <View className="bg-red-50 border border-red-200 rounded-xl p-4 mt-4">
                <Text className="text-red-600 text-center">{loginError}</Text>
              </View>
            )}

            {/* Login Button */}
            <AsyncButton
              title="התחבר"
              onPress={handleLogin}
              loadingText="מתחבר..."
              className="mt-8"
            />
          </View>
        )}

        {/* Register Form */}
        {tab === 'register' && (
          <View className="space-y-4">
            {/* Full Name Input (emphasized, calm) */}
            <View>
              <Text className="text-gray-700 text-base mb-2">שם מלא *</Text>
              <TextInput
                value={fullName}
                onChangeText={setFullName}
                placeholder="הכנס את שמך המלא"
                className="border border-gray-300 rounded-xl px-4 py-3 text-base bg-white"
                textAlign="right"
                autoCapitalize="words"
                editable={!registerLoading}
                returnKeyType="next"
                blurOnSubmit={false}
              />
            </View>

            {/* Email Input */}
            <View>
              <Text className="text-gray-700 text-base mb-2">אימייל *</Text>
              <TextInput
                value={registerEmail}
                onChangeText={setRegisterEmail}
                placeholder="הכנס את כתובת האימייל"
                className="border border-gray-300 rounded-xl px-4 py-3 text-base bg-white"
                textAlign="right"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!registerLoading}
                returnKeyType="next"
                blurOnSubmit={false}
              />
            </View>

            {/* Phone Input */}
            <View>
              <Text className="text-gray-700 text-base mb-2">טלפון</Text>
              <NumericInput
                value={phone}
                onChangeText={setPhone}
                placeholder="054-1234567 (אופציונלי)"
                className="border border-gray-300 rounded-xl px-4 py-3 text-base bg-white"
                textAlign="right"
              />
            </View>

            {/* Password Input */}
            <View>
              <Text className="text-gray-700 text-base mb-2">סיסמה *</Text>
              <View className="relative">
                <TextInput
                  value={registerPassword}
                  onChangeText={setRegisterPassword}
                  placeholder="לפחות 6 תווים"
                  className="border border-gray-300 rounded-xl px-4 py-3 text-base pr-12 bg-white"
                  textAlign="right"
                  secureTextEntry={!showRegisterPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!registerLoading}
                  returnKeyType="next"
                  blurOnSubmit={false}
                />
                <Pressable
                  onPress={() => setShowRegisterPassword(!showRegisterPassword)}
                  className="absolute left-3 top-3"
                  disabled={registerLoading}
                >
                  <Ionicons 
                    name={showRegisterPassword ? "eye-off" : "eye"} 
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
                  className="border border-gray-300 rounded-xl px-4 py-3 text-base pr-12 bg-white"
                  textAlign="right"
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!registerLoading}
                  returnKeyType="done"
                  onSubmitEditing={handleRegister}
                />
                <Pressable
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute left-3 top-3"
                  disabled={registerLoading}
                >
                  <Ionicons 
                    name={showConfirmPassword ? "eye-off" : "eye"} 
                    size={24} 
                    color="#666" 
                  />
                </Pressable>
              </View>
            </View>

            {/* Error Message */}
            {registerError && (
              <View className="bg-red-50 border border-red-200 rounded-xl p-4 mt-4">
                <Text className="text-red-600 text-center">{registerError}</Text>
              </View>
            )}

            {/* Register Button */}
            <AsyncButton
              title="צור חשבון"
              onPress={handleRegister}
              loadingText="יוצר חשבון..."
              variant="success"
              className="mt-6"
            />

            {/* Required Fields Note */}
            <Text className="text-gray-500 text-sm text-center mt-4">
              * שדות חובה
            </Text>
          </View>
        )}
      </View>
    </Screen>
  );
}
