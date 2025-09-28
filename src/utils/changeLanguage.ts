import AsyncStorage from '@react-native-async-storage/async-storage';
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

    await i18n.changeLanguage(nextLang);
  } catch (e) {
    // swallow
  }
}


