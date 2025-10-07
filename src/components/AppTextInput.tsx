import React, { useRef, useEffect } from 'react';
import { TextInput, TextInputProps, Platform, TextStyle } from 'react-native';
import { useIsRTL } from '../hooks/useIsRTL';

// English-only comments
// RTL-aware TextInput wrapper that applies proper text alignment and writing direction
export function AppTextInput({ style, multiline, value, onChangeText, ...rest }: TextInputProps) {
  const isRTL = useIsRTL();
  const textInputRef = useRef<TextInput>(null);
  const selectionRef = useRef<{ start: number; end: number } | null>(null);

  const rtlStyle: TextStyle = {
    textAlign: isRTL ? 'right' : 'left',
    writingDirection: isRTL ? 'rtl' : 'ltr',
    ...(Platform.OS === 'android' && multiline && { textAlignVertical: 'top' as const }),
  };

  // Handle Android selection preservation to prevent cursor jumps
  useEffect(() => {
    if (Platform.OS === 'android' && textInputRef.current && selectionRef.current) {
      // Restore selection after value change to prevent cursor jumping
      setTimeout(() => {
        textInputRef.current?.setSelection(
          selectionRef.current!.start,
          selectionRef.current!.end
        );
      }, 0);
    }
  }, [value]);

  const handleSelectionChange = (event: any) => {
    selectionRef.current = {
      start: event.nativeEvent.selection.start,
      end: event.nativeEvent.selection.end,
    };
  };

  const handleChangeText = (text: string) => {
    onChangeText?.(text);
  };

  return (
    <TextInput
      ref={textInputRef}
      style={[rtlStyle, style]}
      multiline={multiline}
      value={value}
      onChangeText={handleChangeText}
      onSelectionChange={handleSelectionChange}
      {...rest}
    />
  );
}
