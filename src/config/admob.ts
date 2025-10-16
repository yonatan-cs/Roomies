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
  
  // Production IDs - Real AdMob Unit IDs
  productionIds: {
    banner: Platform.select({
      ios: 'ca-app-pub-4539954746841772/3600605401', // Real iOS banner ID
      android: 'ca-app-pub-4539954746841772/9654151513', // Real Android banner ID
    }),
    interstitial: Platform.select({
      ios: 'ca-app-pub-4539954746841772/3600605401', // Using banner ID for now
      android: 'ca-app-pub-4539954746841772/9654151513', // Using banner ID for now
    }),
    rewarded: Platform.select({
      ios: 'ca-app-pub-4539954746841772/3600605401', // Using banner ID for now
      android: 'ca-app-pub-4539954746841772/9654151513', // Using banner ID for now
    }),
    appOpen: Platform.select({
      ios: 'ca-app-pub-4539954746841772/3600605401', // Using banner ID for now
      android: 'ca-app-pub-4539954746841772/9654151513', // Using banner ID for now
    }),
  },
  
  // Get the appropriate unit ID based on environment
  getUnitId: (adType: 'banner' | 'interstitial' | 'rewarded' | 'appOpen') => {
    // In TestFlight, __DEV__ is false, but we still want to use test ads until app is approved
    // Use test ads in development OR when app is not yet approved by AdMob
    const isDev = __DEV__;
    const useTestAds = isDev; // For now, use test ads in development only
    
    // IMPORTANT: Once AdMob approves the app, change this to:
    // const useTestAds = false; // Use real ads in production
    
    const ids = useTestAds ? AdMobConfig.testIds : AdMobConfig.productionIds;
    console.log(`🎯 Using ${useTestAds ? 'TEST' : 'PRODUCTION'} ads for ${adType}`);
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
