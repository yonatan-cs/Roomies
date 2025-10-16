/**
 * Notification Service using expo-notifications
 * Handles push notifications for iOS and Android using Expo's native implementation
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import { firestoreService } from './firestore-service';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export class NotificationService {
  private static instance: NotificationService;
  private expoPushToken: string | null = null;
  private notificationListener: any = null;
  private responseListener: any = null;

  private constructor() {}

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Request notification permissions and register for push notifications
   */
  async requestPermissions(): Promise<boolean> {
    try {
      if (!Device.isDevice) {
        console.log('⚠️ Push notifications only work on physical devices');
        return false;
      }

      console.log('🔔 Requesting notification permissions...');
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        console.log('📱 Requesting notification permissions from user...');
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('❌ Notification permissions denied');
        return false;
      }

      console.log('✅ Notification permissions granted');
      return true;
    } catch (error) {
      console.error('❌ Error requesting notification permissions:', error);
      return false;
    }
  }

  /**
   * Register for push notifications and get Expo push token
   */
  async registerForPushNotifications(): Promise<string | null> {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        return null;
      }

      console.log('📱 Getting Expo push token...');
      
      // Get the Expo push token with explicit projectId
      // Note: Explicitly passing projectId to avoid detection issues
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: '25750afa-5613-4fc5-9bcd-c68398815964'
      });
      
      this.expoPushToken = tokenData.data;
      console.log('✅ Expo push token:', this.expoPushToken);

      // Configure notification channel for Android
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
        console.log('✅ Android notification channel configured');
      }

      return this.expoPushToken;
    } catch (error) {
      console.error('❌ Error registering for push notifications:', error);
      
      // Provide more specific error information
      if (error instanceof Error && error.message.includes('projectId')) {
        console.error('🔧 ProjectId issue detected. Make sure projectId is correctly configured in app.json');
      }
      
      return null;
    }
  }

  /**
   * Save push token to Firestore for the current user
   */
  async saveTokenToFirestore(userId: string): Promise<boolean> {
    try {
      if (!this.expoPushToken) {
        console.log('⚠️ No push token to save');
        return false;
      }

      console.log('💾 Saving push token to Firestore for user:', userId);
      
      await firestoreService.updateUserSafeProfileFields(userId, {
        fcm_token: this.expoPushToken,
        device_type: Platform.OS,
        last_seen: new Date().toISOString(),
      });

      console.log('✅ Push token saved to Firestore');
      return true;
    } catch (error) {
      console.error('❌ Error saving push token to Firestore:', error);
      return false;
    }
  }

  /**
   * Setup notification listeners
   */
  setupNotificationListeners(): void {
    // Listener for notifications received while app is foregrounded
    this.notificationListener = Notifications.addNotificationReceivedListener(notification => {
      console.log('🔔 Notification received (foreground):', notification);
      // You can handle the notification here (e.g., show custom UI)
    });

    // Listener for when user taps on notification
    this.responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('👆 Notification tapped:', response);
      const data = response.notification.request.content.data;
      
      // Handle navigation based on notification data
      if (data.screen) {
        console.log('📱 Navigate to screen:', data.screen);
        // You can integrate with your navigation system here
      }
    });

    console.log('✅ Notification listeners setup complete');
  }

  /**
   * Remove notification listeners
   */
  removeNotificationListeners(): void {
    if (this.notificationListener) {
      Notifications.removeNotificationSubscription(this.notificationListener);
    }
    if (this.responseListener) {
      Notifications.removeNotificationSubscription(this.responseListener);
    }
    console.log('✅ Notification listeners removed');
  }

  /**
   * Send a test local notification
   */
  async sendTestLocalNotification(): Promise<void> {
    try {
      console.log('🧪 Sending test local notification...');
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🧪 Test Notification',
          body: 'This is a local test notification from Roomies!',
          data: { test: true, screen: 'Dashboard' },
          sound: true,
        },
        trigger: null, // Send immediately
      });

      console.log('✅ Test local notification sent');
    } catch (error) {
      console.error('❌ Error sending test local notification:', error);
      throw error;
    }
  }

  /**
   * Get current push token
   */
  getPushToken(): string | null {
    return this.expoPushToken;
  }

  /**
   * Initialize the notification service
   * Note: This should be called after permissions have been requested
   */
  async initialize(userId: string): Promise<boolean> {
    try {
      console.log('🚀 Initializing notification service...');

      // Check if permissions are already granted before registering
      const { status } = await Notifications.getPermissionsAsync();
      
      if (status === 'granted') {
        // Register for push notifications
        const token = await this.registerForPushNotifications();
        if (!token) {
          console.log('⚠️ Failed to get push token, but continuing...');
          // Don't return false - we still want to set up listeners
        }

        // Save token to Firestore if we have one
        if (token) {
          await this.saveTokenToFirestore(userId);
        }
      } else {
        console.log('⚠️ Notification permissions not granted, skipping token registration');
      }

      // Set up listeners regardless of permission status
      this.setupNotificationListeners();

      console.log('✅ Notification service initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Error initializing notification service:', error);
      return false;
    }
  }

  /**
   * Cleanup on logout
   */
  cleanup(): void {
    this.removeNotificationListeners();
    this.expoPushToken = null;
    console.log('✅ Notification service cleanup complete');
  }
}

// Export singleton instance
export const notificationService = NotificationService.getInstance();

