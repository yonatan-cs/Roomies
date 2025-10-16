import React, { useState } from 'react';
import {
  View,
  Text,
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
import { Screen } from '../components/Screen';
import { AsyncButton } from '../components/AsyncButton';
import { AppTextInput } from '../components/AppTextInput';
import { useTranslation } from 'react-i18next';
import { ThemedCard } from '../theme/components/ThemedCard';
import { ThemedText } from '../theme/components/ThemedText';
import { ThemedView } from '../theme/components/ThemedView';
import { useThemedStyles } from '../theme/useThemedStyles';

interface ForgotPasswordScreenProps {
  onBack: () => void;
}

export default function ForgotPasswordScreen({ onBack }: ForgotPasswordScreenProps) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const themed = useThemedStyles(tk => ({
    surfaceBg: { backgroundColor: tk.colors.surface },
    textSecondary: { color: tk.colors.text.secondary },
    borderColor: { borderColor: tk.colors.border.primary },
  }));

  const handleResetPassword = async () => {
    setError(null);
    
    if (!email.trim()) {
      setError(t('forgot.emailPh'));
      return;
    }

    if (!isValidEmail(email)) {
      setError(t('auth.emailPlaceholder'));
      return;
    }

    setLoading(true);

    try {
      await firebaseAuth.resetPassword(email.trim());
      setSuccess(true);
      
      Alert.alert(t('forgot.sentTitle'), t('forgot.sentBody'), [{ text: t('forgot.ok'), onPress: () => onBack() }]);
    } catch (error: any) {
      console.error('Reset password error:', error);
      setError(error.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  return (
    <Screen withPadding={true} keyboardVerticalOffset={0}>
          <View className="pt-20 pb-8">
            {/* Back Button */}
            <Pressable 
              onPress={onBack} 
              className="flex-row items-center mb-8"
              disabled={loading}
            >
              <Ionicons name="arrow-back" size={24} color="#007AFF" />
              <ThemedText className="text-blue-500 text-lg mr-2">{t('forgot.back')}</ThemedText>
            </Pressable>

            {/* Header */}
            <View className="items-center mb-12">
              <Ionicons name="key" size={80} color="#007AFF" />
              <ThemedText className="text-3xl font-bold mt-4 text-center heading-up">{t('forgot.title')}</ThemedText>
              <ThemedText className="text-lg mt-2 text-center" style={themed.textSecondary}>{t('forgot.subtitle')}</ThemedText>
            </View>

            {/* Email Input */}
            <View>
              <ThemedText className="text-base mb-2" style={themed.textSecondary}>{t('forgot.email')}</ThemedText>
              <AppTextInput
                value={email}
                onChangeText={setEmail}
                placeholder={t('forgot.emailPh')}
                className="border rounded-xl px-4 py-3 text-base"
                style={themed.borderColor}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading && !success}
                returnKeyType="done"
                onSubmitEditing={handleResetPassword}
              />
            </View>

            {/* Error Message */}
            {error && (
              <View className="bg-red-50 border border-red-200 rounded-xl p-4 mt-4">
                <ThemedText className="text-red-600 text-center">{error}</ThemedText>
              </View>
            )}

            {/* Success Message */}
            {success && (
              <View className="bg-green-50 border border-green-200 rounded-xl p-4 mt-4">
                <View className="flex-row items-center justify-center">
                  <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                  <ThemedText className="text-green-600 text-center mr-2">{t('forgot.sentTitle')}</ThemedText>
                </View>
              </View>
            )}

            {/* Reset Password Button */}
            <AsyncButton
              title={success ? t('forgot.sentTitle') : t('forgot.send')}
              onPress={handleResetPassword}
              loadingText={t('forgot.sending')}
              disabled={success}
              className="mt-8"
            />

            {/* Info Text */}
            <View className="mt-8 p-4 bg-blue-50 rounded-xl">
              <ThemedText className="text-blue-800 text-center text-sm leading-6">{t('forgot.info')}</ThemedText>
            </View>

            {/* Contact Support */}
            <ThemedText className="text-center text-sm mt-6" style={themed.textSecondary}>{t('forgot.support')}</ThemedText>
          </View>
    </Screen>
  );
}
