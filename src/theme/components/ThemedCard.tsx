import React from 'react';
import { View, ViewProps, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '../ThemeProvider';

// English-only comments
// Card wrapper that applies default background and border only if not provided
export function ThemedCard({ style, ...rest }: ViewProps) {
  const { theme } = useTheme();
  const base = React.useMemo(
    () =>
      StyleSheet.create({
        card: {
          backgroundColor: theme.colors.card,
          // No default border to preserve pixel-identical light mode.
        } as ViewStyle,
      }),
    [theme]
  );

  const styleArray: StyleProp<ViewStyle>[] = Array.isArray(style) ? (style as any) : [style as any];
  const hasBg = styleArray.some((s) => s && (s as ViewStyle).backgroundColor != null);
  const hasBorderColor = styleArray.some((s) => s && (s as ViewStyle).borderColor != null);
  const hasBorderWidth = styleArray.some((s) => s && (s as ViewStyle).borderWidth != null);

  return (
    <View
      style={[
        !hasBg && base.card,
        // Do not add borders by default to avoid light-mode changes
        style,
      ]}
      {...rest}
    />
  );
}


