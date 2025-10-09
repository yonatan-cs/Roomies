import React, { useRef, useCallback } from 'react';
import { View, Platform } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { ThemedText } from '../theme/components/ThemedText';
import { useThemedStyles } from '../theme/useThemedStyles';
import { useTranslation } from 'react-i18next';
import { useIsRTL } from '../hooks/useIsRTL';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme/ThemeProvider';

interface DayPickerProps {
  selectedDay: number; // 0=Sunday, 1=Monday, ..., 6=Saturday
  onDayChange: (day: number) => void;
  style?: any;
}

export const DayPicker: React.FC<DayPickerProps> = ({ 
  selectedDay, 
  onDayChange, 
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

  // Create array of day options
  const dayOptions = Array.from({ length: 7 }, (_, index) => ({
    value: index,
    label: t(`days.${index}`)
  }));

  // Safe handler that skips the first render trigger
  const handleValueChange = useCallback((itemValue: number) => {
    // Skip the first render trigger to prevent state update on unmounted component
    if (!didFirstRender.current) {
      didFirstRender.current = true;
      return;
    }
    onDayChange(itemValue);
  }, [onDayChange]);

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
        selectedValue={selectedDay}
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
        {dayOptions.map((day) => (
          <Picker.Item
            key={day.value}
            label={day.label}
            value={day.value}
            color={themed.textPrimary.color}
          />
        ))}
      </Picker>
    </View>
  );
};
