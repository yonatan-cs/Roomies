import React from 'react';
import { View, ViewProps, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '../ThemeProvider';

// English-only comments
// A thin wrapper that applies backgroundColor only if caller didn't set one
export function ThemedView({ style, ...rest }: ViewProps) {
  const { theme } = useTheme();
  const base = React.useMemo(
    () =>
      StyleSheet.create({
        root: { backgroundColor: theme.colors.background } as ViewStyle,
      }),
    [theme]
  );

  const styleArray: StyleProp<ViewStyle>[] = Array.isArray(style) ? (style as any) : [style as any];
  const hasBg = styleArray.some((s) => s && (s as ViewStyle).backgroundColor != null);

  return <View style={[!hasBg && base.root, style]} {...rest} />;
}


