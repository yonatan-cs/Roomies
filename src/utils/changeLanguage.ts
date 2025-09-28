import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '../i18n';
import { getCurrentRouteSnapshot, navigationRef } from '../navigation/navigationRef';

// English-only comments
const PENDING_ROUTE_KEY = '__pendingRoute__';

export async function changeAppLanguage(nextLang: 'he' | 'en') {
  try {
    // Get current route information
    const snap = getCurrentRouteSnapshot();
    if (snap) {
      // Save current route with timestamp
      await AsyncStorage.setItem(PENDING_ROUTE_KEY, JSON.stringify({ 
        ...snap, 
        ts: Date.now() 
      }));
    }

    // Change the language
    await i18n.changeLanguage(nextLang);
    
    // Immediately restore the route after language change
    if (snap && navigationRef.isReady()) {
      // Small delay to ensure i18n has processed the language change
      setTimeout(() => {
        try {
          navigationRef.navigate(snap.name, snap.params);
        } catch (error) {
          console.log('Navigation restore failed:', error);
        }
      }, 100);
    }
  } catch (e) {
    console.log('Language change error:', e);
  }
}


