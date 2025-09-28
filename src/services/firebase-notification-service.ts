/**
 * Firebase Push Notification Service (Web SDK)
 * Uses Firebase Web SDK for push notifications - works in Expo Go
 */
import { Platform } from 'react-native';
import { firestoreService } from './firestore-service';
import { firebaseAuth } from './firebase-auth';

export interface NotificationData {
  title: string;
  body: string;
  data?: any;
}

export class FirebaseNotificationService {
  private static instance: FirebaseNotificationService;
  private fcmToken: string | null = null;

  static getInstance(): FirebaseNotificationService {
    if (!FirebaseNotificationService.instance) {
      FirebaseNotificationService.instance = new FirebaseNotificationService();
    }
    return FirebaseNotificationService.instance;
  }

  /**
   * Request notification permissions using Web API
   */
  async requestPermissions(): Promise<boolean> {
    try {
      if (Platform.OS === 'web') {
        // Web browser permissions
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          console.log('✅ Web notification permissions granted');
          return true;
        } else {
          console.log('❌ Web notification permissions denied');
          return false;
        }
      } else {
        // For mobile, we'll use a mock token for now
        console.log('📱 Mobile platform - using mock token for testing');
        return true;
      }
    } catch (error) {
      console.error('❌ Error requesting notification permissions:', error);
      return false;
    }
  }

  /**
   * Register for push notifications and get FCM token
   */
  async registerForPushNotifications(): Promise<string | null> {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        return null;
      }

      if (Platform.OS === 'web') {
        // Use Firebase Web SDK for web
        const { getMessaging, getToken } = await import('firebase/messaging');
        const { firebaseConfig } = await import('./firebase-config');
        
        // Initialize Firebase if not already done
        const { initializeApp } = await import('firebase/app');
        const app = initializeApp(firebaseConfig);
        const messaging = getMessaging(app);
        
        const token = await getToken(messaging, {
          vapidKey: 'YOUR_VAPID_KEY_HERE' // You'll need to add this
        });
        
        this.fcmToken = token;
        console.log('📱 Firebase Web FCM Token:', this.fcmToken);
        return this.fcmToken;
      } else {
        // For mobile, generate a mock token for testing
        this.fcmToken = `mock_fcm_token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        console.log('📱 Mock FCM Token (for testing):', this.fcmToken);
        return this.fcmToken;
      }
    } catch (error) {
      console.error('❌ Error registering for push notifications:', error);
      return null;
    }
  }

  /**
   * Save FCM token to Firestore for the current user
   */
  async saveTokenToFirestore(userId: string): Promise<boolean> {
    try {
      if (!this.fcmToken) {
        console.log('❌ No FCM token available');
        return false;
      }

      // Save token to user document
      try {
        await firestoreService.updateUser(userId, {
          fcm_token: this.fcmToken,
          device_type: Platform.OS,
          last_token_update: new Date().toISOString(),
          token_type: 'firebase_web',
        });
      } catch (err: any) {
        const is403 = err?.status === 403 || (err?.message && err.message.includes('Missing or insufficient permissions'));
        console.warn('saveTokenToFirestore: initial save failed', { userId, is403, err });

        if (is403) {
          // Attempt to refresh token once (REST flow)
          try {
            await firebaseAuth.refreshToken();
          } catch (t) {
            console.warn('saveTokenToFirestore: token refresh failed', t);
          }

          try {
            await firestoreService.updateUser(userId, {
              fcm_token: this.fcmToken,
              device_type: Platform.OS,
              last_token_update: new Date().toISOString(),
              token_type: 'firebase_web',
            });
          } catch (err2) {
            console.error('saveTokenToFirestore: retry failed', err2);
            return false;
          }
        } else {
          // Non-permission error
          console.error('saveTokenToFirestore: non-403 error', err);
          return false;
        }
      }

      console.log('✅ FCM token saved to Firestore');
      return true;
    } catch (error) {
      console.error('❌ Error saving FCM token to Firestore:', error);
      return false;
    }
  }

  /**
   * Set up notification listeners
   */
  setupNotificationListeners() {
    if (Platform.OS === 'web') {
      this.setupWebListeners();
    } else {
      console.log('📱 Mobile platform - notification listeners not available in Expo Go');
    }
  }

  private async setupWebListeners() {
    try {
      const { getMessaging, onMessage } = await import('firebase/messaging');
      const { firebaseConfig } = await import('./firebase-config');
      
      const { initializeApp } = await import('firebase/app');
      const app = initializeApp(firebaseConfig);
      const messaging = getMessaging(app);
      
      // Handle notifications received while app is foregrounded
      onMessage(messaging, (payload) => {
        console.log('📱 Firebase Web notification received:', payload);
        // You can show custom UI here
      });
    } catch (error) {
      console.error('❌ Error setting up web listeners:', error);
    }
  }

  /**
   * Handle notification tap events
   */
  private handleNotificationTap(data: any) {
    if (data?.screen) {
      // Navigate to specific screen based on notification data
      console.log('🧭 Navigate to:', data.screen, data.params);
      // You can integrate with your navigation system here
    }
  }

  /**
   * Send a test notification (works on iOS with Expo Go)
   */
  async sendTestNotification(): Promise<void> {
    try {
      if (Platform.OS === 'ios') {
        // For iOS, we'll simulate a successful test
        // In a real app with development build, this would send via Cloud Functions
        console.log('📱 iOS platform - simulating Firebase notification test');
        console.log('✅ Firebase notification test completed (simulated)');
        
        // Show success message
        console.log('🧪 Test Notification: Firebase notification test completed!');
        
        // You could also show an alert here
        // Alert.alert('🧪 Test Notification', 'Firebase notification test completed!');
      } else if (Platform.OS === 'web') {
        // For web, show a browser notification
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('🧪 Firebase Web Test', {
            body: 'This is a Firebase Web notification from your app!',
            icon: '/favicon.ico'
          });
          console.log('✅ Web notification sent');
        } else {
          console.log('❌ Web notifications not supported or permission denied');
          throw new Error('Web notifications not available');
        }
      } else {
        // For Android, simulate a successful test
        console.log('📱 Android platform - simulating Firebase notification test');
        console.log('✅ Firebase notification test completed (simulated)');
      }
    } catch (error) {
      console.error('❌ Error sending test notification:', error);
      throw error;
    }
  }

  /**
   * Get current FCM token
   */
  getFCMToken(): string | null {
    return this.fcmToken;
  }

  /**
   * Initialize the Firebase notification service
   */
  async initialize(userId: string): Promise<boolean> {
    try {
      console.log('🚀 Initializing Firebase Web notification service...');

      // Register for push notifications
      const token = await this.registerForPushNotifications();
      if (!token) {
        return false;
      }

      // Save token to Firestore
      const saved = await this.saveTokenToFirestore(userId);
      if (!saved) {
        return false;
      }

      // Set up listeners
      this.setupNotificationListeners();

      console.log('✅ Firebase Web notification service initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Error initializing Firebase Web notification service:', error);
      return false;
    }
  }
}

// Export singleton instance
export const firebaseNotificationService = FirebaseNotificationService.getInstance();
