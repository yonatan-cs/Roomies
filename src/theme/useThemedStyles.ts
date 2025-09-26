import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { useTheme } from './ThemeProvider';

// English-only comments as requested by user
// Creates styles that automatically re-compute when theme changes
export function useThemedStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  creator: (t: ReturnType<typeof useTheme>['theme']) => T
) {
  const { theme } = useTheme();
  return useMemo(() => StyleSheet.create(creator(theme)), [theme, creator]);
}


