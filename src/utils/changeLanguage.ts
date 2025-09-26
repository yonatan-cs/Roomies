import AsyncStorage from '@react-native-async-storage/async-storage';
import { I18nManager } from 'react-native';
import i18n from '../i18n';
import { getCurrentRouteSnapshot } from '../navigation/navigationRef';

// English-only comments
const PENDING_ROUTE_KEY = '__pendingRoute__';

export async function changeAppLanguage(nextLang: 'he' | 'en') {
  try {
    const snap = getCurrentRouteSnapshot();
    if (snap) {
      await AsyncStorage.setItem(PENDING_ROUTE_KEY, JSON.stringify({ ...snap, ts: Date.now() }));
    }

    const willBeRTL = nextLang === 'he';
    const isCurrentlyRTL = I18nManager.isRTL;

    await i18n.changeLanguage(nextLang);

    if (willBeRTL !== isCurrentlyRTL) {
      I18nManager.allowRTL(true);
      I18nManager.forceRTL(willBeRTL);
      // Trigger a JS-level remount by toggling a key in root if available,
      // or rely on the app's existing reload flow if present.
      // Expo/Updates or Restart is not used here to avoid hard dependency.
    }
  } catch (e) {
    // swallow
  }
}


