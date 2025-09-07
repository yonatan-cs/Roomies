import React from 'react';
import { Platform, Keyboard, KeyboardAvoidingView, Pressable, View, ScrollView } from 'react-native';

// מסך בסיסי: מרחיק מהקצה, מרים מול מקלדת, ולחיצה בחוץ סוגרת מקלדת
type Props = {
  children: React.ReactNode;
  scroll?: boolean;             // אם יש הרבה תוכן
  withPadding?: boolean;        // ריווח פנימי
  behavior?: 'padding' | 'position' | 'height'; // לשליטה ידנית
  keyboardVerticalOffset?: number; // התאמה ל-header
};

export function Screen({
  children,
  scroll = true,
  withPadding = true,
  behavior = 'padding',
  keyboardVerticalOffset,
}: Props) {
  const content = (
    <Pressable
      onPress={() => Keyboard.dismiss()}
      style={{ flex: 1 }}
      android_disableSound
    >
      {scroll ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ 
            padding: withPadding ? 16 : 0, 
            flexGrow: 1 
          }}
          keyboardShouldPersistTaps="handled" // לחיצה מחוץ לאלמנטי הקלט תסגור מקלדת
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={{ flex: 1, padding: withPadding ? 16 : 0 }}>
          {children}
        </View>
      )}
    </Pressable>
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? behavior : undefined}
      keyboardVerticalOffset={keyboardVerticalOffset ?? Platform.select({ ios: 64, android: 0 })} // להתאים ל־Header אם צריך
    >
      {content}
    </KeyboardAvoidingView>
  );
}
