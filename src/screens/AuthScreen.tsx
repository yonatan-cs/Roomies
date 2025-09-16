import React, { useMemo, useState } from 'react';
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
import { useTranslation } from 'react-i18next';
import { useStore } from '../state/store';

interface AuthScreenProps {
  onAuthSuccess: (user: any) => void;
}

export default function AuthScreen({ onAuthSuccess }: AuthScreenProps) {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  // i18n
  const { t } = useTranslation();
  const appLanguage = useStore(s => s.appLanguage);
  const setAppLanguage = useStore(s => s.setAppLanguage);
  const isRTL = useMemo(() => appLanguage === 'he', [appLanguage]);

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
      setLoginError(t('auth.errors.fillAllFields'));
      return;
    }

    if (!isValidEmail(loginEmail)) {
      setLoginError(t('auth.errors.invalidEmail'));
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
        throw new Error(t('auth.errors.userDataNotFound'));
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
      setLoginError(error.message || t('auth.errors.loginFailed'));
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegister = async () => {
    setRegisterError(null);
    
    // Validation
    if (!registerEmail.trim() || !registerPassword.trim() || !confirmPassword.trim() || !fullName.trim()) {
      setRegisterError(t('auth.errors.fillAllFields'));
      return;
    }

    if (!isValidEmail(registerEmail)) {
      setRegisterError(t('auth.errors.invalidEmail'));
      return;
    }

    if (registerPassword.length < 6) {
      setRegisterError(t('auth.errors.invalidPasswordLength'));
      return;
    }

    if (registerPassword !== confirmPassword) {
      setRegisterError(t('auth.errors.passwordsMismatch'));
      return;
    }

    if (fullName.trim().length < 2) {
      setRegisterError(t('auth.errors.fullNameTooShort'));
      return;
    }

    if (phone.trim() && !isValidPhone(phone)) {
      setRegisterError(t('auth.errors.invalidPhone'));
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
        t('auth.errors.registerSuccessTitle'),
        t('auth.errors.registerSuccessBody'),
        [{ text: t('auth.errors.continue'), onPress: () => onAuthSuccess(user) }]
      );
    } catch (error: any) {
      console.error('Registration error:', error);
      setRegisterError(error.message || t('common.error'));
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
        {/* Language toggle */}
        <Pressable
          onPress={() => setAppLanguage(appLanguage === 'he' ? 'en' : 'he')}
          className="absolute p-2 bg-gray-100 rounded-full"
          style={{ right: 16, top: 60 }}
          accessibilityRole="button"
          accessibilityLabel={t('settings.language')}
        >
          <Ionicons name="language" size={22} color="#111827" />
        </Pressable>
        {/* Header */}
        <View className="items-center mb-8">
          <Ionicons name="home" size={80} color="#007AFF" />
          <Text className="text-3xl font-bold text-gray-900 mt-4 text-center">{t('auth.title')}</Text>
          <Text className="text-lg text-gray-600 mt-2 text-center">{t('auth.subtitle')}</Text>
        </View>

        {/* Tabs with subtle per-mode accent */}
        <View className="flex-row bg-gray-100 rounded-xl p-1 mb-8">
          <Pressable
            className={`flex-1 py-3 rounded-lg items-center ${tab === 'login' ? 'bg-white' : ''}`}
            onPress={() => setTab('login')}
          >
            <Text className={`font-semibold ${tab === 'login' ? 'text-blue-600' : 'text-gray-600'}`}>{t('auth.loginTab')}</Text>
            {tab === 'login' && (
              <View className="h-0.5 bg-blue-600 w-10 mt-2 rounded-full" />
            )}
          </Pressable>
          <Pressable
            className={`flex-1 py-3 rounded-lg items-center ${tab === 'register' ? 'bg-white' : ''}`}
            onPress={() => setTab('register')}
          >
            <Text className={`font-semibold ${tab === 'register' ? 'text-green-600' : 'text-gray-600'}`}>{t('auth.registerTab')}</Text>
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
              <Text className="text-gray-700 text-base mb-2">{t('auth.email')}</Text>
              <TextInput
                value={loginEmail}
                onChangeText={setLoginEmail}
                placeholder={t('auth.emailPlaceholder')}
                className="border border-gray-300 rounded-xl px-4 py-3 text-base bg-white"
                textAlign={isRTL ? 'right' : 'left'}
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
              <Text className="text-gray-700 text-base mb-2">{t('auth.password')}</Text>
              <View className="relative">
                <TextInput
                  value={loginPassword}
                  onChangeText={setLoginPassword}
                  placeholder={t('auth.passwordPlaceholder')}
                  className="border border-gray-300 rounded-xl px-4 py-3 text-base pr-12 bg-white"
                  textAlign={isRTL ? 'right' : 'left'}
                  secureTextEntry={!showLoginPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loginLoading}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                />
                <Pressable
                  onPress={() => setShowLoginPassword(!showLoginPassword)}
                  className="absolute top-3"
                  style={{ [isRTL ? 'left' : 'right']: 12 }}
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
              <Text className="text-blue-600 text-base">{t('auth.forgotPassword')}</Text>
            </Pressable>

            {/* Error Message */}
            {loginError && (
              <View className="bg-red-50 border border-red-200 rounded-xl p-4 mt-4">
                <Text className="text-red-600 text-center">{loginError}</Text>
              </View>
            )}

            {/* Login Button */}
            <AsyncButton
              title={t('auth.login')}
              onPress={handleLogin}
              loadingText={t('auth.loginLoading')}
              className="mt-8"
            />
          </View>
        )}

        {/* Register Form */}
        {tab === 'register' && (
          <View className="space-y-4">
            {/* Full Name Input (emphasized, calm) */}
            <View>
              <Text className="text-gray-700 text-base mb-2">{t('auth.fullName')}</Text>
              <TextInput
                value={fullName}
                onChangeText={setFullName}
                placeholder={t('auth.fullNamePlaceholder')}
                className="border border-gray-300 rounded-xl px-4 py-3 text-base bg-white"
                textAlign={isRTL ? 'right' : 'left'}
                autoCapitalize="words"
                editable={!registerLoading}
                returnKeyType="next"
                blurOnSubmit={false}
              />
            </View>

            {/* Email Input */}
            <View>
              <Text className="text-gray-700 text-base mb-2">{t('auth.email')} *</Text>
              <TextInput
                value={registerEmail}
                onChangeText={setRegisterEmail}
                placeholder={t('auth.emailPlaceholder')}
                className="border border-gray-300 rounded-xl px-4 py-3 text-base bg-white"
                textAlign={isRTL ? 'right' : 'left'}
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
              <Text className="text-gray-700 text-base mb-2">{t('auth.phone')}</Text>
              <NumericInput
                value={phone}
                onChangeText={setPhone}
                placeholder={t('auth.phonePlaceholder')}
                className="border border-gray-300 rounded-xl px-4 py-3 text-base bg-white"
                textAlign={isRTL ? 'right' : 'left'}
              />
            </View>

            {/* Password Input */}
            <View>
              <Text className="text-gray-700 text-base mb-2">{t('auth.password')} *</Text>
              <View className="relative">
                <TextInput
                  value={registerPassword}
                  onChangeText={setRegisterPassword}
                  placeholder={t('auth.passwordPlaceholder')}
                  className="border border-gray-300 rounded-xl px-4 py-3 text-base pr-12 bg-white"
                  textAlign={isRTL ? 'right' : 'left'}
                  secureTextEntry={!showRegisterPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!registerLoading}
                  returnKeyType="next"
                  blurOnSubmit={false}
                />
                <Pressable
                  onPress={() => setShowRegisterPassword(!showRegisterPassword)}
                  className="absolute top-3"
                  style={{ [isRTL ? 'left' : 'right']: 12 }}
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
              <Text className="text-gray-700 text-base mb-2">{t('auth.confirmPassword')}</Text>
              <View className="relative">
                <TextInput
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder={t('auth.confirmPasswordPlaceholder')}
                  className="border border-gray-300 rounded-xl px-4 py-3 text-base pr-12 bg-white"
                  textAlign={isRTL ? 'right' : 'left'}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!registerLoading}
                  returnKeyType="done"
                  onSubmitEditing={handleRegister}
                />
                <Pressable
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute top-3"
                  style={{ [isRTL ? 'left' : 'right']: 12 }}
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
              title={t('auth.register')}
              onPress={handleRegister}
              loadingText={t('auth.registerLoading')}
              variant="success"
              className="mt-6"
            />

            {/* Required Fields Note */}
            <Text className="text-gray-500 text-sm text-center mt-4">{t('auth.requiredNote')}</Text>
          </View>
        )}
      </View>
    </Screen>
  );
}
