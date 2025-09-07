import React from 'react';
import { Pressable, Text, ActivityIndicator, View } from 'react-native';
import { useAsyncAction } from '../hooks/useAsyncAction';

type Props = {
  title: string;
  onPress: () => Promise<void>;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'small' | 'medium' | 'large';
  loadingText?: string;
  className?: string;
};

export function AsyncButton({ 
  title, 
  onPress, 
  disabled = false, 
  variant = 'primary',
  size = 'medium',
  loadingText,
  className = ''
}: Props) {
  const { run, loading } = useAsyncAction(onPress, {
    spinnerDelayMs: 180,
    minSpinnerVisibleMs: 250,
  });

  const isDisabled = disabled || loading;

  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return isDisabled 
          ? 'bg-gray-300' 
          : 'bg-blue-500 active:bg-blue-600';
      case 'secondary':
        return isDisabled 
          ? 'bg-gray-200' 
          : 'bg-gray-100 active:bg-gray-200 border border-gray-300';
      case 'danger':
        return isDisabled 
          ? 'bg-gray-300' 
          : 'bg-red-500 active:bg-red-600';
      default:
        return isDisabled ? 'bg-gray-300' : 'bg-blue-500';
    }
  };

  const getTextColor = () => {
    switch (variant) {
      case 'primary':
      case 'danger':
        return 'text-white';
      case 'secondary':
        return isDisabled ? 'text-gray-400' : 'text-gray-700';
      default:
        return 'text-white';
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return 'py-2 px-4';
      case 'medium':
        return 'py-3 px-6';
      case 'large':
        return 'py-4 px-8';
      default:
        return 'py-3 px-6';
    }
  };

  const getTextSize = () => {
    switch (size) {
      case 'small':
        return 'text-sm';
      case 'medium':
        return 'text-base';
      case 'large':
        return 'text-lg';
      default:
        return 'text-base';
    }
  };

  return (
    <Pressable
      disabled={isDisabled}
      onPress={() => run()}
      className={`${getVariantStyles()} ${getSizeStyles()} rounded-xl flex-row items-center justify-center gap-2 ${className}`}
      style={({ pressed }) => ({
        opacity: isDisabled ? 0.6 : pressed ? 0.8 : 1,
      })}
    >
      {loading && <ActivityIndicator size="small" color={variant === 'secondary' ? '#6b7280' : 'white'} />}
      <Text className={`${getTextColor()} ${getTextSize()} font-semibold text-center`}>
        {loading ? (loadingText || 'מעבד...') : title}
      </Text>
    </Pressable>
  );
}
