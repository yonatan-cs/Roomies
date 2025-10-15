import { Platform } from 'react-native';
import { TestIds } from 'react-native-google-mobile-ads';

// AdMob Configuration
export const AdMobConfig = {
  // Test IDs for development
  testIds: {
    banner: TestIds.BANNER,
    interstitial: TestIds.INTERSTITIAL,
    rewarded: TestIds.REWARDED,
    rewardedInterstitial: TestIds.REWARDED_INTERSTITIAL,
    appOpen: TestIds.APP_OPEN,
  },
  
  // Production IDs (replace with your actual AdMob unit IDs)
  productionIds: {
    banner: Platform.select({
      ios: 'ca-app-pub-4539954746841772/1234567890', // Replace with your iOS banner ID
      android: 'ca-app-pub-4539954746841772/0987654321', // Replace with your Android banner ID
    }),
    interstitial: Platform.select({
      ios: 'ca-app-pub-4539954746841772/2345678901', // Replace with your iOS interstitial ID
      android: 'ca-app-pub-4539954746841772/1098765432', // Replace with your Android interstitial ID
    }),
    rewarded: Platform.select({
      ios: 'ca-app-pub-4539954746841772/3456789012', // Replace with your iOS rewarded ID
      android: 'ca-app-pub-4539954746841772/2109876543', // Replace with your Android rewarded ID
    }),
    appOpen: Platform.select({
      ios: 'ca-app-pub-4539954746841772/4567890123', // Replace with your iOS app open ID
      android: 'ca-app-pub-4539954746841772/3210987654', // Replace with your Android app open ID
    }),
  },
  
  // Get the appropriate unit ID based on environment
  getUnitId: (adType: 'banner' | 'interstitial' | 'rewarded' | 'appOpen') => {
    const isDev = __DEV__;
    const ids = isDev ? AdMobConfig.testIds : AdMobConfig.productionIds;
    return ids[adType];
  },
  
  // AdMob App IDs
  appIds: {
    ios: 'ca-app-pub-4539954746841772~9470743711',
    android: 'ca-app-pub-4539954746841772~6975731872',
  },
};

// Initialize AdMob
export const initializeAdMob = async () => {
  try {
    const mobileAds = await import('react-native-google-mobile-ads');
    await mobileAds.default().initialize();
    console.log('AdMob initialized successfully');
  } catch (error) {
    console.error('Failed to initialize AdMob:', error);
  }
};
