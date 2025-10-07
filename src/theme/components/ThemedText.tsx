import React from 'react';
import { Text, TextProps, StyleSheet, TextStyle, StyleProp } from 'react-native';
import { useTheme } from '../ThemeProvider';
import { useIsRTL } from '../../hooks/useIsRTL';

// English-only comments
// A thin wrapper that applies default text color and RTL alignment only if caller didn't set them
export function ThemedText({ style, className, ...rest }: TextProps & { className?: string }) {
  const { theme } = useTheme();
  const isRTL = useIsRTL();
  
  const base = React.useMemo(
    () =>
      StyleSheet.create({
        text: { 
          color: theme.colors.text.primary,
          textAlign: isRTL ? 'right' : 'left',
          writingDirection: isRTL ? 'rtl' : 'ltr',
        } as TextStyle,
      }),
    [theme, isRTL]
  );

  const styleArray: StyleProp<TextStyle>[] = Array.isArray(style) ? (style as any) : [style as any];
  const hasColor = styleArray.some((s) => s && (s as TextStyle).color != null);
  const hasTextAlign = styleArray.some((s) => s && (s as TextStyle).textAlign != null);

  return <Text className={className} style={[!hasColor && base.text, !hasTextAlign && base.text, style]} {...rest} />;
}


