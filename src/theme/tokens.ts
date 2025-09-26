// Light and Dark theme token definitions
export interface ThemeTokens {
  colors: {
    background: string;
    surface: string;
    card: string; // card containers like headers/cards
    primary: string;
    secondary: string;
    text: {
      primary: string;
      secondary: string;
      disabled: string;
    };
    border: {
      primary: string;
      secondary: string;
    };
    status: {
      success: string;
      warning: string;
      error: string;
      info: string;
    };
  };
}

export const lightTokens: ThemeTokens = {
  colors: {
    background: '#ffffff',
    surface: '#f8fafc',
    card: '#ffffff',
    primary: '#3b82f6', // blue-500
    secondary: '#6b7280', // gray-500
    text: {
      primary: '#111827', // gray-900
      secondary: '#6b7280', // gray-500
      disabled: '#9ca3af', // gray-400
    },
    border: {
      primary: '#e5e7eb', // gray-200
      secondary: '#d1d5db', // gray-300
    },
    status: {
      success: '#10b981', // green-500
      warning: '#f59e0b', // amber-500
      error: '#ef4444', // red-500
      info: '#3b82f6', // blue-500
    },
  },
};

export const darkTokens: ThemeTokens = {
  colors: {
    background: '#111827', // gray-900
    surface: '#1f2937', // gray-800
    card: '#1f2937', // match surface for cards
    primary: '#60a5fa', // blue-400
    secondary: '#9ca3af', // gray-400
    text: {
      primary: '#f9fafb', // gray-50
      secondary: '#d1d5db', // gray-300
      disabled: '#6b7280', // gray-500
    },
    border: {
      primary: '#374151', // gray-700
      secondary: '#4b5563', // gray-600
    },
    status: {
      success: '#34d399', // green-400
      warning: '#fbbf24', // amber-400
      error: '#f87171', // red-400
      info: '#60a5fa', // blue-400
    },
  },
};