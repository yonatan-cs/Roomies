import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { Appearance, useColorScheme } from 'react-native';
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
  const systemColorScheme = useColorScheme();
  
  // Get theme setting from store
  const themeSetting = useStore(state => state.themeSetting);
  const setThemeSetting = useStore(state => state.setThemeSetting);
  
  // Resolve active theme - handle undefined from useColorScheme
  const activeScheme = resolveTheme(themeSetting, systemColorScheme || 'light');
  const theme = activeScheme === 'dark' ? darkTokens : lightTokens;

  // Listen to appearance changes when system theme is selected
  useEffect(() => {
    if (themeSetting !== 'system') return;
    
    const subscription = Appearance.addChangeListener(() => {
      // Force re-render by updating a dummy state or just let useColorScheme handle it
      // The useColorScheme hook will trigger a re-render automatically
    });

    return () => subscription?.remove();
  }, [themeSetting]);

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