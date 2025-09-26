import React from 'react';
import { TextInput, Platform, InputAccessoryView, Button, View } from 'react-native';
import { useThemedStyles } from '../theme/useThemedStyles';
import { Keyboard } from 'react-native';

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  className?: string;
  textAlign?: 'left' | 'center' | 'right';
  [key: string]: any; // עבור props נוספים של TextInput
};

export function NumericInput({ 
  value, 
  onChangeText, 
  placeholder = "0", 
  className = "",
  textAlign = "center",
  ...props 
}: Props) {
  const accessoryId = 'numericDoneBar';
  const themed = useThemedStyles(tk => ({
    accessory: {
      backgroundColor: tk.colors.surface,
      borderTopColor: tk.colors.border.primary,
    },
  }));

  if (Platform.OS === 'ios') {
    return (
      <>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          keyboardType="numeric"
          inputAccessoryViewID={accessoryId}
          className={className}
          textAlign={textAlign}
          {...props}
        />
        <InputAccessoryView nativeID={accessoryId}>
          <View style={{ 
            flexDirection: 'row', 
            justifyContent: 'flex-end', 
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderTopWidth: 1,
            ...themed.accessory,
          }}>
            <Button 
              title="Done" 
              onPress={() => Keyboard.dismiss()} 
            />
          </View>
        </InputAccessoryView>
      </>
    );
  }

  // Android - פשוט TextInput רגיל
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      keyboardType="numeric"
      returnKeyType="done"
      onSubmitEditing={() => Keyboard.dismiss()}
      className={className}
      textAlign={textAlign}
      {...props}
    />
  );
}
