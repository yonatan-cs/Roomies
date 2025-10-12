import React, { useRef, useCallback } from 'react';
import { View, Platform } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { ThemedText } from '../theme/components/ThemedText';
import { useThemedStyles } from '../theme/useThemedStyles';
import { useTranslation } from 'react-i18next';
import { useIsRTL } from '../hooks/useIsRTL';
import { useTheme } from '../theme/ThemeProvider';

interface IntervalPickerProps {
  selectedInterval: number; // Number of days for cleaning rotation interval
  onIntervalChange: (interval: number) => void;
  style?: any;
}

export const IntervalPicker: React.FC<IntervalPickerProps> = ({ 
  selectedInterval, 
  onIntervalChange, 
  style 
}) => {
  const { t } = useTranslation();
  const { activeScheme } = useTheme();
  const themed = useThemedStyles(tk => ({
    textPrimary: { color: tk.colors.text.primary },
    textSecondary: { color: tk.colors.text.secondary },
    lightBg: { backgroundColor: activeScheme === 'dark' ? '#374151' : '#f9fafb' },
    border: { borderColor: tk.colors.border.primary },
  }));
  const isRTL = useIsRTL();
  
  // Prevent onValueChange from firing during initial render
  const didFirstRender = useRef(false);

  // Create array of interval options: 1, 2, 3, 4, 5, 6, 7, 14, 30 days
  const intervalOptions = [
    { value: 1, label: t('settings.intervalLabels.oneDay') },
    { value: 2, label: t('settings.intervalLabels.twoDays') },
    { value: 3, label: t('settings.intervalLabels.threeDays') },
    { value: 4, label: t('settings.intervalLabels.fourDays') },
    { value: 5, label: t('settings.intervalLabels.fiveDays') },
    { value: 6, label: t('settings.intervalLabels.sixDays') },
    { value: 7, label: t('settings.intervalLabels.oneWeek') },
    { value: 14, label: t('settings.intervalLabels.twoWeeks') },
    { value: 30, label: t('settings.intervalLabels.oneMonth') }
  ];

  // Safe handler that skips the first render trigger
  const handleValueChange = useCallback((itemValue: number) => {
    // Skip the first render trigger to prevent state update on unmounted component
    if (!didFirstRender.current) {
      didFirstRender.current = true;
      return;
    }
    onIntervalChange(itemValue);
  }, [onIntervalChange]);

  return (
    <View style={[style, { 
      backgroundColor: themed.lightBg.backgroundColor,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: themed.border.borderColor,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 1,
      },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    }]}>
      <Picker
        selectedValue={selectedInterval}
        onValueChange={handleValueChange}
        style={{
          height: Platform.OS === 'ios' ? 200 : 50,
          backgroundColor: 'transparent',
        }}
        itemStyle={{
          color: themed.textPrimary.color,
          fontSize: 16,
          textAlign: isRTL ? 'right' : 'left',
          fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
        }}
        dropdownIconColor={themed.textSecondary.color}
        mode={Platform.OS === 'android' ? 'dropdown' : 'dialog'}
      >
        {intervalOptions.map((option) => (
          <Picker.Item
            key={option.value}
            label={option.label}
            value={option.value}
            color={themed.textPrimary.color}
          />
        ))}
      </Picker>
    </View>
  );
};

