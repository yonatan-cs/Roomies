import React from 'react';
import { View, ViewProps, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '../ThemeProvider';

// English-only comments
// Card wrapper that applies consistent styling like expense cards
export function ThemedCard({ style, ...rest }: ViewProps) {
  const { theme, activeScheme } = useTheme();
  const base = React.useMemo(
    () =>
      StyleSheet.create({
        card: {
          backgroundColor: activeScheme === 'dark' ? '#1f2937' : '#F8FAFC', // Consistent background like expense cards
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.colors.border.primary,
          shadowColor: '#000',
          shadowOpacity: 0.06,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
          elevation: 2,
          borderRadius: 12,
        } as ViewStyle,
        headerCard: {
          backgroundColor: activeScheme === 'dark' ? '#1f2937' : '#F8FAFC', // Same background as regular cards
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: theme.colors.border.primary,
          shadowColor: '#000',
          shadowOpacity: 0.1, // Stronger shadow for headers
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: 4, // Higher elevation for headers
          borderRadius: 0, // No border radius for headers
        } as ViewStyle,
      }),
    [theme, activeScheme]
  );

  const styleArray: StyleProp<ViewStyle>[] = Array.isArray(style) ? (style as any) : [style as any];
  const hasBg = styleArray.some((s) => s && (s as ViewStyle).backgroundColor != null);
  const hasBorderColor = styleArray.some((s) => s && (s as ViewStyle).borderColor != null);
  const hasBorderWidth = styleArray.some((s) => s && (s as ViewStyle).borderWidth != null);
  const hasShadow = styleArray.some((s) => s && (s as ViewStyle).shadowColor != null);
  const hasElevation = styleArray.some((s) => s && (s as ViewStyle).elevation != null);
  
  // Check if this is a header card (has pt-20 class or similar header styling)
  const isHeader = rest.className?.includes('pt-20') || rest.className?.includes('shadow-sm');

  return (
    <View
      style={[
        isHeader ? base.headerCard : base.card,
        // Apply default styling only if not overridden
        !hasBg && (isHeader ? base.headerCard : base.card),
        !hasBorderColor && !hasBorderWidth && (isHeader ? base.headerCard : base.card),
        !hasShadow && (isHeader ? base.headerCard : base.card),
        !hasElevation && (isHeader ? base.headerCard : base.card),
        style,
      ]}
      {...rest}
    />
  );
}


