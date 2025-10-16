// Theme setting type and utility functions
export type ThemeSetting = 'light' | 'dark' | 'system';

export const THEME_SETTINGS: { [key in ThemeSetting]: { label: string; description?: string } } = {
  light: { 
    label: 'Light',
    description: 'Always use light theme'
  },
  dark: { 
    label: 'Dark',
    description: 'Always use dark theme'
  },
  system: { 
    label: 'System',
    description: 'Follow your device appearance'
  },
};

export const DEFAULT_THEME_SETTING: ThemeSetting = 'system';

/**
 * Maps a theme setting + system scheme to actual theme
 */
export function resolveTheme(
  themeSetting: ThemeSetting,
  systemColorScheme: 'light' | 'dark' | null
): 'light' | 'dark' {
  switch (themeSetting) {
    case 'light':
      return 'light';
    case 'dark':
      return 'dark';
    case 'system':
      return systemColorScheme === 'dark' ? 'dark' : 'light';
    default:
      return 'light';
  }
}