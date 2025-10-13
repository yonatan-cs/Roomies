import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedCard } from '../../theme/components/ThemedCard';
import { ThemedText } from '../../theme/components/ThemedText';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { useTranslation } from 'react-i18next';
import { useIsRTL } from '../../hooks/useIsRTL';
import * as Haptics from 'expo-haptics';

/**
 * Mock Ad Item Component
 * This is a placeholder ad that works in Expo Go without native code.
 * 
 * ADMOB RESTORE: Replace with RealNativeAdItem before App Store deployment
 */

interface MockAdItemProps {
  variant?: 'shopping' | 'expense';
}

export default function MockAdItem({ variant = 'shopping' }: MockAdItemProps) {
  const { t } = useTranslation();
  const isRTL = useIsRTL();
  const themed = useThemedStyles(tk => ({
    borderColor: { borderColor: tk.colors.border.primary },
    textSecondary: { color: tk.colors.text.secondary },
    adBg: { backgroundColor: '#f9fafb' }, // Light gray background
  }));

  const handleAdPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    // In mock mode, do nothing
    console.log('📢 Mock ad clicked - will open real ad in production');
  };

  return (
    <Pressable onPress={handleAdPress}>
      <ThemedCard 
        className="rounded-xl p-4 mb-3"
        style={[
          { borderWidth: 1, borderStyle: 'dashed' },
          themed.borderColor,
          themed.adBg
        ]}
      >
        {/* Sponsored Tag */}
        <View 
          className="absolute top-2 z-10"
          style={isRTL ? { left: 8 } : { right: 8 }}
        >
          <View className="bg-gray-400 px-2 py-1 rounded">
            <Text className="text-white text-xs font-medium">
              {t('ads.sponsored')}
            </Text>
          </View>
        </View>

        {/* Ad Content */}
        <View 
          className="items-center"
          style={{ 
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center'
          }}
        >
          {/* Ad Icon */}
          <View className="w-12 h-12 bg-blue-100 rounded-lg items-center justify-center mr-3">
            <Ionicons name="star" size={24} color="#3b82f6" />
          </View>

          {/* Ad Text */}
          <View className="flex-1">
            <ThemedText className="text-base font-semibold mb-1">
              {t('ads.mockTitle')}
            </ThemedText>
            <ThemedText className="text-sm" style={themed.textSecondary}>
              {t('ads.mockDescription')}
            </ThemedText>
          </View>

          {/* CTA Arrow */}
          <Ionicons 
            name={isRTL ? "chevron-back" : "chevron-forward"} 
            size={20} 
            color="#9ca3af" 
          />
        </View>
      </ThemedCard>
    </Pressable>
  );
}

