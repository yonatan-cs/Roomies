import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedCard } from '../theme/components/ThemedCard';
import { ThemedText } from '../theme/components/ThemedText';
import { cn } from '../utils/cn';

interface QuickStatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  iconName: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  valueColor?: 'green' | 'red' | 'blue' | 'gray';
}

export default function QuickStatsCard({
  title,
  value,
  subtitle,
  iconName,
  onPress,
  valueColor = 'gray'
}: QuickStatsCardProps) {
  const colorClasses = {
    green: 'text-green-600',
    red: 'text-red-600',
    blue: 'text-blue-600',
    gray: 'text-gray-900' // Keep brand color for gray
  };

  return (
    <Pressable onPress={onPress} disabled={!onPress}>
      <ThemedCard className="p-4 rounded-2xl shadow-sm">
        <View className="flex-row items-center mb-2">
          <Ionicons name={iconName} size={20} color="#6b7280" />
          <ThemedText className="text-sm mr-2">{title}</ThemedText>
        </View>
        <ThemedText className={cn("text-2xl font-bold heading-up", colorClasses[valueColor])}>
          {value}
        </ThemedText>
        {subtitle && (
          <ThemedText className="text-xs mt-1">
            {subtitle}
          </ThemedText>
        )}
      </ThemedCard>
    </Pressable>
  );
}