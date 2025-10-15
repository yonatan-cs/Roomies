import messaging from '@react-native-firebase/messaging';
import { Platform } from 'react-native';

// Optional import for tracking transparency
let requestTrackingPermissions: any = null;
try {
  const trackingModule = require('react-native-tracking-transparency');
  requestTrackingPermissions = trackingModule.requestTrackingPermissions;
} catch (error) {
  console.log('react-native-tracking-transparency not available');
}

// Firebase/FCM Configuration
export const FirebaseConfig = {
  // Request notification permissions
  requestPermissions: async () => {
    try {
      // Request notification permission
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (enabled) {
        console.log('Notification permission granted');
        
        // Request tracking permission for iOS (required for AdMob)
        if (Platform.OS === 'ios') {
          try {
            const trackingStatus = await requestTrackingPermissions();
            console.log('Tracking permission status:', trackingStatus);
          } catch (error) {
            console.log('Tracking permission not available:', error);
          }
        }
        
        return true;
      } else {
        console.log('Notification permission denied');
        return false;
      }
    } catch (error) {
      console.error('Error requesting permissions:', error);
      return false;
    }
  },

  // Get FCM token
  getFCMToken: async () => {
    try {
      const token = await messaging().getToken();
      console.log('FCM Token:', token);
      return token;
    } catch (error) {
      console.error('Error getting FCM token:', error);
      return null;
    }
  },

  // Setup background message handler
  setupBackgroundMessageHandler: () => {
    messaging().setBackgroundMessageHandler(async (remoteMessage) => {
      console.log('Background message received:', remoteMessage);
      // Handle background message here
    });
  },

  // Setup foreground message handler
  setupForegroundMessageHandler: () => {
    const unsubscribe = messaging().onMessage(async (remoteMessage) => {
      console.log('Foreground message received:', remoteMessage);
      // Handle foreground message here
      // You can show a local notification or update UI
    });

    return unsubscribe;
  },

  // Setup notification opened app handler
  setupNotificationOpenedApp: () => {
    const unsubscribe = messaging().onNotificationOpenedApp((remoteMessage) => {
      console.log('Notification opened app:', remoteMessage);
      // Handle notification tap here
    });

    return unsubscribe;
  },

  // Get initial notification (when app is opened from notification)
  getInitialNotification: async () => {
    try {
      const remoteMessage = await messaging().getInitialNotification();
      if (remoteMessage) {
        console.log('App opened from notification:', remoteMessage);
        return remoteMessage;
      }
    } catch (error) {
      console.error('Error getting initial notification:', error);
    }
    return null;
  },
};

// Initialize Firebase
export const initializeFirebase = async () => {
  try {
    // Request permissions
    const hasPermission = await FirebaseConfig.requestPermissions();
    if (!hasPermission) {
      console.log('Firebase permissions not granted');
      return;
    }

    // Get FCM token
    const token = await FirebaseConfig.getFCMToken();
    if (token) {
      // Send token to your server here
      console.log('FCM Token ready for server:', token);
    }

    // Setup message handlers
    FirebaseConfig.setupBackgroundMessageHandler();
    const unsubscribeForeground = FirebaseConfig.setupForegroundMessageHandler();
    const unsubscribeOpened = FirebaseConfig.setupNotificationOpenedApp();
    
    // Get initial notification
    const initialNotification = await FirebaseConfig.getInitialNotification();
    if (initialNotification) {
      // Handle initial notification
      console.log('Initial notification:', initialNotification);
    }

    console.log('Firebase initialized successfully');
    
    return {
      unsubscribeForeground,
      unsubscribeOpened,
    };
  } catch (error) {
    console.error('Failed to initialize Firebase:', error);
  }
};
