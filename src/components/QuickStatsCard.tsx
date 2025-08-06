import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
    gray: 'text-gray-900'
  };

  return (
    <Pressable
      onPress={onPress}
      className="bg-white p-4 rounded-2xl shadow-sm"
      disabled={!onPress}
    >
      <View className="flex-row items-center mb-2">
        <Ionicons name={iconName} size={20} color="#6b7280" />
        <Text className="text-gray-600 text-sm mr-2">{title}</Text>
      </View>
      <Text className={cn("text-2xl font-bold", colorClasses[valueColor])}>
        {value}
      </Text>
      {subtitle && (
        <Text className="text-xs text-gray-500 mt-1">
          {subtitle}
        </Text>
      )}
    </Pressable>
  );
}