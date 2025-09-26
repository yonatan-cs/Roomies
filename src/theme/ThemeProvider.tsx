import React, { createContext, useContext, useEffect, ReactNode, useState } from 'react';
import { Appearance } from 'react-native';
import { useStore } from '../state/store';
import { lightTokens, darkTokens, ThemeTokens } from './tokens';
import { ThemeSetting, resolveTheme } from './theme-settings';

interface ThemeContextType {
  setting: ThemeSetting;
  setSetting: (setting: ThemeSetting) => void;
  activeScheme: 'light' | 'dark';
  theme: ThemeTokens;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  // Get theme setting from store
  const themeSetting = useStore(state => state.themeSetting);
  const setThemeSetting = useStore(state => state.setThemeSetting);
  // Keep system scheme in local state to react immediately on change
  const [systemScheme, setSystemScheme] = useState<'light' | 'dark' | null>(Appearance.getColorScheme() || 'light');

  // Resolve active theme using current system scheme value
  const activeScheme = resolveTheme(themeSetting, systemScheme);
  const theme = activeScheme === 'dark' ? darkTokens : lightTokens;

  // Listen to appearance changes and update immediately
  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme || 'light');
    });
    return () => subscription.remove();
  }, []);

  const contextValue: ThemeContextType = {
    setting: themeSetting,
    setSetting: setThemeSetting,
    activeScheme,
    theme,
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}