/**
 * AdMob Service
 * 
 * This service manages AdMob initialization and configuration for Native Advanced Ads.
 * Production-ready with real AdMob integration.
 */

import { Platform } from 'react-native';

import mobileAds, { MaxAdContentRating, TestIds } from 'react-native-google-mobile-ads';

/**
 * AdMob App IDs
 */
export const ADMOB_APP_IDS = {
  ios: 'ca-app-pub-4539954746841772~9470743711',
  android: 'ca-app-pub-4539954746841772~6975731872'
};

/**
 * Ad Unit IDs for Native Advanced Ads
 */
export const ADMOB_AD_UNITS = {
  nativeAdvanced: {
    ios: 'ca-app-pub-4539954746841772/8114565480',
    android: 'ca-app-pub-4539954746841772/3516844926'
  }
};

/**
 * Get the appropriate Ad Unit ID for the current platform
 */
export const getAdUnitId = (adType: 'nativeAdvanced' = 'nativeAdvanced'): string => {
  const platformKey = Platform.OS as 'ios' | 'android';
  return ADMOB_AD_UNITS[adType][platformKey];
};

/**
 * Initialize AdMob
 * Call this once when the app starts
 */
export const initializeAdMob = async () => {
  try {
    // Initialize AdMob
    await mobileAds().initialize();
    
    // Configure settings
    await mobileAds().setRequestConfiguration({
      // Set max ad content rating
      maxAdContentRating: MaxAdContentRating.G,
      
      // Tag for child-directed treatment
      tagForChildDirectedTreatment: false,
      
      // Tag for under age of consent
      tagForUnderAgeOfConsent: false,
    });
    
    console.log('✅ AdMob initialized successfully');
    return true;
  } catch (error) {
    console.error('❌ Error initializing AdMob:', error);
    return false;
  }
};

/**
 * Get test Ad Unit IDs for development
 */
export const getTestAdUnitId = () => {
  return TestIds.NATIVE;
};

