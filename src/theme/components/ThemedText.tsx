import React from 'react';
import { Text, TextProps, StyleSheet, TextStyle, StyleProp } from 'react-native';
import { useTheme } from '../ThemeProvider';

// English-only comments
// A thin wrapper that applies default text color only if caller didn't set it
export function ThemedText({ style, ...rest }: TextProps) {
  const { theme } = useTheme();
  const base = React.useMemo(
    () =>
      StyleSheet.create({
        text: { color: theme.colors.text.primary } as TextStyle,
      }),
    [theme]
  );

  const styleArray: StyleProp<TextStyle>[] = Array.isArray(style) ? (style as any) : [style as any];
  const hasColor = styleArray.some((s) => s && (s as TextStyle).color != null);

  return <Text style={[!hasColor && base.text, style]} {...rest} />;
}


