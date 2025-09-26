import React from 'react';
import { Platform, Keyboard, KeyboardAvoidingView, Pressable, View, ScrollView } from 'react-native';
import { ThemedView } from '../theme/components/ThemedView';
import { useStore } from '../state/store';

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
  const appLanguage = useStore(s => s.appLanguage);
  const content = (
    <>
      {/* שכבת "הקש לסגור מקלדת" שלא חוסמת ילדים */}
      <Pressable
        onPress={() => Keyboard.dismiss()}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: -1 }}
        pointerEvents="box-only" // חשוב: לא לחסום טאצ' לילדים
        android_disableSound
      />
      {scroll ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ 
            padding: withPadding ? 16 : 0, 
            flexGrow: 1,
            alignItems: 'stretch',
            // Force LTR layout regardless of language, to match English orientation
            direction: 'ltr' as any,
          }}
          keyboardShouldPersistTaps="handled" // לחיצה מחוץ לאלמנטי הקלט תסגור מקלדת
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
        >
          {children}
        </ScrollView>
      ) : (
        <ThemedView style={{ flex: 1, padding: withPadding ? 16 : 0, alignItems: 'stretch', direction: 'ltr' as any }}>
          {children}
        </ThemedView>
      )}
    </>
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? behavior : undefined}
      keyboardVerticalOffset={keyboardVerticalOffset ?? Platform.select({ ios: 64, android: 0 })} // להתאים ל־Header אם צריך
    >
      <ThemedView style={{ flex: 1 }}>
        {content}
      </ThemedView>
    </KeyboardAvoidingView>
  );
}
