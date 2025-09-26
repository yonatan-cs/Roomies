/**
 * Firebase Push Notification Service (V1 API)
 * Handles FCM token registration, permission requests, and message handling
 */
import messaging from '@react-native-firebase/messaging';
import { Platform } from 'react-native';
import { firestoreService } from './firestore-service';

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
   * Request notification permissions
   */
  async requestPermissions(): Promise<boolean> {
    try {
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (enabled) {
        console.log('✅ Firebase notification permissions granted');
        return true;
      } else {
        console.log('❌ Firebase notification permissions denied');
        return false;
      }
    } catch (error) {
      console.error('❌ Error requesting Firebase notification permissions:', error);
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

      // Get FCM token
      const token = await messaging().getToken();
      this.fcmToken = token;
      
      console.log('📱 Firebase FCM Token:', this.fcmToken);
      return this.fcmToken;
    } catch (error) {
      console.error('❌ Error registering for Firebase push notifications:', error);
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
      await firestoreService.updateUser(userId, {
        fcm_token: this.fcmToken,
        device_type: Platform.OS,
        last_token_update: new Date().toISOString(),
      });

      console.log('✅ Firebase FCM token saved to Firestore');
      return true;
    } catch (error) {
      console.error('❌ Error saving Firebase FCM token to Firestore:', error);
      return false;
    }
  }

  /**
   * Set up Firebase notification listeners
   */
  setupNotificationListeners() {
    // Handle notifications received while app is foregrounded
    const unsubscribeForeground = messaging().onMessage(async remoteMessage => {
      console.log('📱 Firebase notification received (foreground):', remoteMessage);
      
      // You can show custom UI here if needed
      // For now, we'll just log it
    });

    // Handle notification taps when app is backgrounded/closed
    messaging().onNotificationOpenedApp(remoteMessage => {
      console.log('�� Firebase notification tapped (background):', remoteMessage);
      this.handleNotificationTap(remoteMessage);
    });

    // Handle notification taps when app is completely closed
    messaging()
      .getInitialNotification()
      .then(remoteMessage => {
        if (remoteMessage) {
          console.log('🔔 Firebase notification tapped (closed):', remoteMessage);
          this.handleNotificationTap(remoteMessage);
        }
      });

    return unsubscribeForeground;
  }

  /**
   * Handle notification tap events
   */
  private handleNotificationTap(remoteMessage: any) {
    const data = remoteMessage.data;
    if (data?.screen) {
      // Navigate to specific screen based on notification data
      console.log('🧭 Navigate to:', data.screen, data.params);
      // You can integrate with your navigation system here
    }
  }

  /**
   * Send a test notification via Cloud Functions
   */
  async sendTestNotification(): Promise<void> {
    try {
      // Call the Cloud Function to send test notification
      const { getFunctions, httpsCallable } = await import('firebase/functions');
      const functions = getFunctions();
      const sendTestNotificationV1 = httpsCallable(functions, 'sendTestNotificationV1');
      
      await sendTestNotificationV1({
        title: '�� Firebase V1 Test',
        body: 'This is a Firebase V1 notification from your app!',
      });
      
      console.log('✅ Firebase V1 test notification sent');
    } catch (error) {
      console.error('❌ Error sending Firebase V1 test notification:', error);
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
      console.log('🚀 Initializing Firebase notification service...');

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

      console.log('✅ Firebase notification service initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Error initializing Firebase notification service:', error);
      return false;
    }
  }
}

// Export singleton instance
export const firebaseNotificationService = FirebaseNotificationService.getInstance();
