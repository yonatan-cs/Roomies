import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Keyboard,
  TouchableWithoutFeedback,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { firebaseAuth } from '../services/firebase-auth';
import { firestoreService } from '../services/firestore-service';
import { Screen } from '../components/Screen';
import { AsyncButton } from '../components/AsyncButton';
import { NumericInput } from '../components/NumericInput';
import { AppTextInput } from '../components/AppTextInput';
import ForgotPasswordScreen from './ForgotPasswordScreen';
import { useTranslation } from 'react-i18next';
import { useStore } from '../state/store';
import { ThemedCard } from '../theme/components/ThemedCard';
import { ThemedText } from '../theme/components/ThemedText';
import { ThemedView } from '../theme/components/ThemedView';
import { useThemedStyles } from '../theme/useThemedStyles';
import { absEnd } from '../utils/rtl';
import { showThemedAlert } from '../components/ThemedAlert';

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
  const themed = useThemedStyles(tk => ({
    surfaceBg: { backgroundColor: tk.colors.surface },
    textSecondary: { color: tk.colors.text.secondary },
    textPrimary: { color: tk.colors.text.primary },
    borderColor: { borderColor: tk.colors.border.primary },
    inputBg: { backgroundColor: tk.colors.card },
    inputText: { color: tk.colors.text.primary },
  }));

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
      let userData = null;
      try {
        userData = await firestoreService.getUser(authUser.localId);
      } catch (error) {
        console.warn('⚠️ Login: getUser failed, continuing with minimal user data:', error);
        // Don't fail login if user data fetch fails - continue with minimal data
      }
      
      if (!userData) {
        // User doesn't exist in Firestore or fetch failed, create minimal user data
        console.log('📋 Login: Creating minimal user data for user:', authUser.localId);
        userData = {
          full_name: authUser.displayName || authUser.email?.split('@')[0] || 'User',
          display_name: authUser.displayName || authUser.email?.split('@')[0] || 'User',
          phone: null,
        };
      }

      // Get user's current apartment based on membership (don't fail if this fails)
      let currentApartment = null;
      try {
        currentApartment = await firestoreService.getUserCurrentApartment(authUser.localId);
      } catch (error) {
        console.warn('⚠️ Login: getUserCurrentApartment failed, continuing without apartment:', error);
        // Don't fail login if apartment fetch fails
      }

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
      // Check if error message is a known error code, otherwise use default
      const errorCode = error.message || 'AUTHENTICATION_FAILED';
      const translationKey = `auth.errors.${errorCode}`;
      const translatedError = t(translationKey, { defaultValue: t('auth.errors.loginFailed') });
      setLoginError(translatedError);
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
        display_name: fullName.trim(), // Add display_name field
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
        current_apartment_id: null, // Explicitly null for new users
      };

      // Call onAuthSuccess immediately to prevent timeout issues
      try {
        console.log('🎉 Registration successful, calling onAuthSuccess immediately...');
        console.log('🎉 User data being passed:', { id: user.id, email: user.email, current_apartment_id: user.current_apartment_id });
        console.log('🎉 onAuthSuccess function type:', typeof onAuthSuccess);
        console.log('🎉 onAuthSuccess function:', onAuthSuccess);
        
        onAuthSuccess(user);
        console.log('✅ onAuthSuccess called successfully');
      } catch (error) {
        console.error('❌ Error in onAuthSuccess:', error);
        console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace available');
        // Don't let errors prevent the registration flow from completing
        console.log('🔄 Registration completed with fallback - user will be directed to apartment selection');
        
        // Fallback: Try to set the user directly in the store and navigate
        try {
          console.log('🔄 Attempting fallback navigation...');
          // Import the store and set user directly
          const { useStore } = await import('../state/store');
          useStore.getState().setCurrentUser(user);
          console.log('✅ Fallback: User set in store');
        } catch (fallbackError) {
          console.error('❌ Fallback also failed:', fallbackError);
        }
      }

      // Additional fallback: Force navigation after a short delay
      setTimeout(async () => {
        console.log('🔄 Additional fallback: Checking if user is set...');
        try {
          const { useStore } = await import('../state/store');
          const currentUser = useStore.getState().currentUser;
          if (currentUser) {
            console.log('✅ Additional fallback: User found in store, navigation should work');
          } else {
            console.log('❌ Additional fallback: No user in store, setting user...');
            useStore.getState().setCurrentUser(user);
          }
        } catch (error) {
          console.error('❌ Additional fallback failed:', error);
        }
      }, 500);

      // Ensure auth is stabilized after onAuthSuccess (non-blocking)
      setTimeout(async () => {
        try {
          await firebaseAuth.getCurrentIdToken();
        } catch (_) {}
      }, 100);

      // Show informational alert (non-blocking for navigation)
      // Use setTimeout to ensure the alert doesn't block the async flow
      setTimeout(() => {
        showThemedAlert(
          t('auth.errors.registerSuccessTitle'),
          t('auth.errors.registerSuccessBody'),
          [{ text: t('common.ok') }]
        );
      }, 100);
    } catch (error: any) {
      console.error('Registration error:', error);
      // Check if error message is a known error code, otherwise use default
      const errorCode = error.message || 'AUTHENTICATION_FAILED';
      const translationKey = `auth.errors.${errorCode}`;
      const translatedError = t(translationKey, { defaultValue: t('common.error') });
      setRegisterError(translatedError);
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
      <View className="pt-20 pb-8">
        {/* Language toggle */}
        <Pressable
          onPress={() => setAppLanguage(appLanguage === 'he' ? 'en' : 'he')}
          className="absolute p-2 rounded-full"
          style={{ ...absEnd(16), top: 60, ...themed.surfaceBg }}
          accessibilityRole="button"
          accessibilityLabel={t('settings.language')}
        >
          <Ionicons name="language" size={22} color={themed.textPrimary.color} />
        </Pressable>
        {/* Header */}
        <View className="items-center mb-8">
          <Image 
            source={require('../../logo_inside.png')} 
            style={{ width: 140, height: 140 }}
            resizeMode="contain"
          />
          <ThemedText className="text-3xl font-bold mt-4 text-center heading-up">{t('auth.title')}</ThemedText>
          <ThemedText className="text-lg mt-2 text-center" style={themed.textSecondary}>{t('auth.subtitle')}</ThemedText>
        </View>

        {/* Tabs with subtle per-mode accent */}
        <View className="flex-row rounded-xl p-1 mb-8" style={themed.surfaceBg}>
          <Pressable
            className={`flex-1 py-3 rounded-lg items-center ${tab === 'login' ? '' : ''}`}
            style={tab === 'login' ? { backgroundColor: '#ffffff' } : undefined}
            onPress={() => setTab('login')}
          >
            <ThemedText className="font-semibold" style={tab === 'login' ? { color: '#111827' } : themed.textPrimary}>{t('auth.loginTab')}</ThemedText>
            {tab === 'login' && (
              <View className="h-0.5 bg-blue-600 w-10 mt-2 rounded-full" />
            )}
          </Pressable>
          <Pressable
            className={`flex-1 py-3 rounded-lg items-center ${tab === 'register' ? '' : ''}`}
            style={tab === 'register' ? { backgroundColor: '#ffffff' } : undefined}
            onPress={() => setTab('register')}
          >
            <ThemedText className="font-semibold" style={tab === 'register' ? { color: '#111827' } : themed.textPrimary}>{t('auth.registerTab')}</ThemedText>
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
              <ThemedText className="text-base mb-2" style={themed.textSecondary}>{t('auth.email')}</ThemedText>
              <AppTextInput
                value={loginEmail}
                onChangeText={setLoginEmail}
                placeholder={t('auth.emailPlaceholder')}
                className="border rounded-xl px-4 py-3 text-base"
                style={[themed.borderColor, themed.inputBg, themed.inputText]}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loginLoading}
                returnKeyType="next"
                blurOnSubmit={false}
                placeholderTextColor={themed.textSecondary.color}
              />
            </View>

            {/* Password Input */}
            <View>
              <ThemedText className="text-base mb-2" style={themed.textSecondary}>{t('auth.password')}</ThemedText>
              <View className="relative">
                <AppTextInput
                  value={loginPassword}
                  onChangeText={setLoginPassword}
                  placeholder={t('auth.passwordPlaceholder')}
                  className="border rounded-xl px-4 py-3 text-base pr-12"
                  style={[themed.borderColor, themed.inputBg, themed.inputText]}
                  secureTextEntry={!showLoginPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loginLoading}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                  placeholderTextColor={themed.textSecondary.color}
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
                    color={themed.textSecondary.color} 
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
              <ThemedText className="text-blue-600 text-base">{t('auth.forgotPassword')}</ThemedText>
            </Pressable>

            {/* Error Message */}
            {loginError && (
              <View className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mt-4">
                <ThemedText className="text-red-600 dark:text-red-400 text-center">{loginError}</ThemedText>
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
              <ThemedText className="text-base mb-2" style={themed.textSecondary}>{t('auth.fullName')}</ThemedText>
              <AppTextInput
                value={fullName}
                onChangeText={setFullName}
                placeholder={t('auth.fullNamePlaceholder')}
                className="border rounded-xl px-4 py-3 text-base"
                style={[themed.borderColor, themed.inputBg, themed.inputText]}
                autoCapitalize="words"
                editable={!registerLoading}
                returnKeyType="next"
                blurOnSubmit={false}
                placeholderTextColor={themed.textSecondary.color}
              />
            </View>

            {/* Email Input */}
            <View>
              <ThemedText className="text-base mb-2" style={themed.textSecondary}>{t('auth.email')} *</ThemedText>
              <AppTextInput
                value={registerEmail}
                onChangeText={setRegisterEmail}
                placeholder={t('auth.emailPlaceholder')}
                className="border rounded-xl px-4 py-3 text-base"
                style={[themed.borderColor, themed.inputBg, themed.inputText]}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!registerLoading}
                returnKeyType="next"
                blurOnSubmit={false}
                placeholderTextColor={themed.textSecondary.color}
              />
            </View>

            {/* Phone Input */}
            <View>
              <ThemedText className="text-base mb-2" style={themed.textSecondary}>{t('auth.phone')}</ThemedText>
              <NumericInput
                value={phone}
                onChangeText={setPhone}
                placeholder={t('auth.phonePlaceholder')}
                className="border rounded-xl px-4 py-3 text-base"
                style={[themed.borderColor, themed.inputBg, themed.inputText]}
                textAlign={isRTL ? 'right' : 'left'}
                placeholderTextColor={themed.textSecondary.color}
              />
            </View>

            {/* Password Input */}
            <View>
              <ThemedText className="text-base mb-2" style={themed.textSecondary}>{t('auth.password')} *</ThemedText>
              <View className="relative">
                <AppTextInput
                  value={registerPassword}
                  onChangeText={setRegisterPassword}
                  placeholder={t('auth.passwordPlaceholder')}
                  className="border rounded-xl px-4 py-3 text-base pr-12"
                  style={[themed.borderColor, themed.inputBg, themed.inputText]}
                  secureTextEntry={!showRegisterPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!registerLoading}
                  returnKeyType="next"
                  blurOnSubmit={false}
                  placeholderTextColor={themed.textSecondary.color}
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
                    color={themed.textSecondary.color} 
                  />
                </Pressable>
              </View>
            </View>

            {/* Confirm Password Input */}
            <View>
              <ThemedText className="text-base mb-2" style={themed.textSecondary}>{t('auth.confirmPassword')} *</ThemedText>
              <View className="relative">
                <AppTextInput
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder={t('auth.confirmPasswordPlaceholder')}
                  className="border rounded-xl px-4 py-3 text-base pr-12"
                  style={[themed.borderColor, themed.inputBg, themed.inputText]}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!registerLoading}
                  returnKeyType="done"
                  onSubmitEditing={handleRegister}
                  placeholderTextColor={themed.textSecondary.color}
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
                    color={themed.textSecondary.color} 
                  />
                </Pressable>
              </View>
            </View>

            {/* Error Message */}
            {registerError && (
              <View className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mt-4">
                <ThemedText className="text-red-600 dark:text-red-400 text-center">{registerError}</ThemedText>
                
                {/* Show helpful action for email exists error */}
                {registerError === t('auth.errors.EMAIL_EXISTS') && (
                  <View className="mt-3">
                    <ThemedText className="text-center text-sm mb-3" style={themed.textSecondary}>
                      {t('auth.errors.emailExistsMessage')}
                    </ThemedText>
                    <View className="space-y-2">
                      <Pressable
                        onPress={() => {
                          setTab('login');
                          setRegisterError(null);
                          setLoginError(null);
                        }}
                        className="py-2 px-4 rounded-lg"
                        style={{ backgroundColor: themed.textPrimary.color === '#f9fafb' ? '#3b82f6' : '#3b82f6' }}
                      >
                        <ThemedText className="text-white text-center font-medium">
                          {t('auth.errors.signInInstead')}
                        </ThemedText>
                      </Pressable>
                      <Pressable
                        onPress={() => {
                          setRegisterError(null);
                          setRegisterEmail('');
                        }}
                        className="py-2 px-4 rounded-lg"
                        style={themed.surfaceBg}
                      >
                        <ThemedText className="text-center font-medium" style={themed.textPrimary}>
                          {t('auth.errors.useDifferentEmail')}
                        </ThemedText>
                      </Pressable>
                    </View>
                  </View>
                )}
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
            <ThemedText className="text-sm text-center mt-4" style={themed.textSecondary}>{t('auth.requiredNote')}</ThemedText>
          </View>
        )}
      </View>
    </Screen>
  );
}
