import React from 'react';
import { View, ViewProps, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '../ThemeProvider';

// English-only comments
// Card wrapper that applies default background and border styling
type ThemedCardProps = ViewProps & {
  variant?: 'default' | 'header';
};

export function ThemedCard({ style, variant = 'default', ...rest }: ThemedCardProps) {
  const { theme } = useTheme();
  const base = React.useMemo(
    () =>
      StyleSheet.create({
        card: {
          backgroundColor: theme.colors.card,
          borderWidth: 1,
          borderColor: theme.colors.border.primary,
          borderRadius: 12,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 0.5 },
          shadowOpacity: 0.05,
          shadowRadius: 1,
          elevation: 1,
        } as ViewStyle,
        headerCard: {
          backgroundColor: theme.colors.card,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border.primary,
          borderRadius: 0,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 2,
          elevation: 1,
        } as ViewStyle,
      }),
    [theme]
  );

  const styleArray: StyleProp<ViewStyle>[] = Array.isArray(style) ? (style as any) : [style as any];
  const hasBg = styleArray.some((s) => s && (s as ViewStyle).backgroundColor != null);
  const hasBorderColor = styleArray.some((s) => s && (s as ViewStyle).borderColor != null);
  const hasBorderWidth = styleArray.some((s) => s && (s as ViewStyle).borderWidth != null);

  const cardStyle = variant === 'header' ? base.headerCard : base.card;

  return (
    <View
      style={[
        !hasBg && cardStyle,
        // Apply default borders for consistent styling across themes
        style,
      ]}
      {...rest}
    />
  );
}


