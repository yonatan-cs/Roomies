import { useStore } from '../state/store';
import { useTranslation } from 'react-i18next';

/**
 * Hook to get gendered text based on user's gender preference
 * Only applies to Hebrew language. For English, returns gender-neutral text.
 * 
 * Usage:
 * const gt = useGenderedText();
 * const text = gt('you'); // Returns "אתה" or "את" based on gender preference
 */
export function useGenderedText() {
  const { t, i18n } = useTranslation();
  const userGender = useStore(s => s.userGender);
  const appLanguage = useStore(s => s.appLanguage);

  /**
   * Get gendered text for a translation key
   * @param key - Base translation key (e.g., 'common.you')
   * @param interpolation - Optional interpolation object for translation
   * @returns Gendered text based on user preference
   */
  return function gt(key: string, interpolation?: Record<string, any>): string {
    // For non-Hebrew languages or when no gender is set, use the base key
    if (appLanguage !== 'he' || !userGender) {
      return t(key, interpolation);
    }

    // Check if gendered version exists
    const genderedKey = `${key}_${userGender === 'male' ? 'm' : 'f'}`;
    const genderedText = t(genderedKey, { ...interpolation, defaultValue: '' });

    // If gendered version exists, use it; otherwise fall back to base
    if (genderedText) {
      return genderedText;
    }

    return t(key, interpolation);
  };
}

