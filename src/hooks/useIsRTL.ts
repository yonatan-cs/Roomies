import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Dynamic RTL hook that responds to language changes
 * Returns true when current language is RTL (Hebrew)
 */
export function useIsRTL(): boolean {
  const { i18n } = useTranslation();
  
  return useMemo(() => {
    return i18n.language === 'he';
  }, [i18n.language]);
}
