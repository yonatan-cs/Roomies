/**
 * Firebase Cloud Messaging (FCM) Notification Service
 * Uses @react-native-firebase/messaging for real FCM tokens
 * Works on iOS and Android with proper Firebase setup
 */

import messaging from '@react-native-firebase/messaging';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { firestoreService } from './firestore-service';
import { useStore } from '../state/store';

// Configure notification behavior for foreground notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export class FCMNotificationService {
  private static instance: FCMNotificationService;
  private fcmToken: string | null = null;
  private notificationListener: any = null;
  private responseListener: any = null;
  private unsubscribeTokenRefresh: (() => void) | null = null;

  private constructor() {}

  static getInstance(): FCMNotificationService {
    if (!FCMNotificationService.instance) {
      FCMNotificationService.instance = new FCMNotificationService();
    }
    return FCMNotificationService.instance;
  }

  /**
   * Request notification permissions
   * iOS requires explicit permission, Android 13+ requires permission
   */
  async requestPermissions(): Promise<boolean> {
    try {
      if (!Device.isDevice) {
        console.log('⚠️ Push notifications only work on physical devices');
        return false;
      }

      console.log('🔔 Requesting FCM notification permissions...');
      
      // Request permissions using Firebase Messaging
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (enabled) {
        console.log('✅ FCM notification permissions granted:', authStatus);
        return true;
      } else {
        console.log('❌ FCM notification permissions denied:', authStatus);
        return false;
      }
    } catch (error) {
      console.error('❌ Error requesting FCM notification permissions:', error);
      return false;
    }
  }

  /**
   * Get FCM token from Firebase
   */
  async getFCMToken(): Promise<string | null> {
    try {
      if (!Device.isDevice) {
        console.log('⚠️ Cannot get FCM token on simulator/emulator');
        return null;
      }

      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        console.log('⚠️ No permission to get FCM token');
        return null;
      }

      console.log('📱 Getting FCM token from Firebase...');
      
      // Get the token
      const token = await messaging().getToken();
      this.fcmToken = token;
      
      console.log('✅ FCM token obtained:', token.substring(0, 20) + '...');
      return token;
    } catch (error) {
      console.error('❌ Error getting FCM token:', error);
      return null;
    }
  }

  /**
   * Save FCM token to Firestore for the current user
   */
  async saveTokenToFirestore(userId: string): Promise<boolean> {
    try {
      if (!this.fcmToken) {
        console.log('⚠️ No FCM token to save');
        return false;
      }

      console.log('💾 Saving FCM token to Firestore for user:', userId);
      
      // Get current app language to save as user's locale preference
      const appLanguage = useStore.getState().appLanguage;
      
      await firestoreService.updateUserSafeProfileFields(userId, {
        fcm_token: this.fcmToken,
        device_type: Platform.OS,
        last_seen: new Date().toISOString(),
        locale: appLanguage, // Save user's language preference for notifications
      });

      console.log('✅ FCM token and language preference saved to Firestore');
      return true;
    } catch (error) {
      console.error('❌ Error saving FCM token to Firestore:', error);
      return false;
    }
  }

  /**
   * Handle data refresh based on notification type
   * Triggers appropriate store methods when notifications received in foreground
   */
  private handleDataRefresh(notificationType: string, data?: any): void {
    console.log(`🔄 Handling data refresh for type: ${notificationType}`);
    
    const store = useStore.getState();
    
    try {
      switch (notificationType) {
        case 'shopping_item_added':
        case 'shopping_item_purchased':
          // Refresh shopping items
          console.log('🛒 Refreshing shopping items...');
          store.loadShoppingItems();
          break;

        case 'expense_added':
          // Refresh expenses and debt settlements
          console.log('💰 Refreshing expenses and debts...');
          store.loadExpenses();
          store.loadDebtSettlements();
          break;

        case 'cleaning_completed':
        case 'cleaning_task_added':
          // Refresh cleaning data
          console.log('🧹 Refreshing cleaning data...');
          store.loadCleaningTask();
          store.loadCleaningChecklist();
          store.loadCleaningStats();
          break;

        case 'member_joined':
          // Refresh apartment members
          console.log('👋 Refreshing apartment members...');
          store.refreshApartmentMembers();
          break;

        case 'cleaning_reminder':
          // Just show the notification, no data refresh needed
          console.log('⏰ Cleaning reminder notification');
          break;

        case 'purchase_followup':
          // Refresh expenses to show updated purchase status
          console.log('💸 Refreshing expenses for purchase follow-up...');
          store.loadExpenses();
          break;

        default:
          console.log(`⚠️ Unknown notification type: ${notificationType}, refreshing all data`);
          // Fallback: refresh all data
          store.loadShoppingItems();
          store.loadExpenses();
          store.loadDebtSettlements();
          store.loadCleaningTask();
          store.loadCleaningChecklist();
          break;
      }
      
      console.log('✅ Data refresh triggered successfully');
    } catch (error) {
      console.error('❌ Error handling data refresh:', error);
    }
  }

  /**
   * Setup FCM listeners
   */
  setupFCMListeners(): void {
    console.log('🔊 Setting up FCM listeners...');

    // Handle background messages (when app is in background/quit)
    messaging().setBackgroundMessageHandler(async remoteMessage => {
      console.log('📬 Background FCM message received:', remoteMessage);
    });

    // Handle foreground messages (when app is open)
    messaging().onMessage(async remoteMessage => {
      console.log('📨 Foreground FCM message received:', remoteMessage);
      
      // Trigger data refresh based on notification type
      const notificationType = remoteMessage.data?.type as string;
      if (notificationType) {
        this.handleDataRefresh(notificationType, remoteMessage.data);
      }
      
      // Show a local notification when app is in foreground
      if (remoteMessage.notification) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: remoteMessage.notification.title || 'New notification',
            body: remoteMessage.notification.body || '',
            data: remoteMessage.data,
          },
          trigger: null, // Show immediately
        });
      }
    });

    // Setup Expo notification listeners for tap handling
    this.notificationListener = Notifications.addNotificationReceivedListener(notification => {
      console.log('🔔 Notification received (foreground):', notification);
      
      // Also trigger data refresh when notification is displayed
      const notificationType = notification.request.content.data?.type as string;
      if (notificationType) {
        this.handleDataRefresh(notificationType, notification.request.content.data);
      }
    });

    this.responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('👆 Notification tapped:', response);
      const data = response.notification.request.content.data;
      
      // Trigger data refresh when user taps notification
      const notificationType = data?.type as string;
      if (notificationType) {
        this.handleDataRefresh(notificationType, data);
      }
      
      // Handle navigation based on notification data
      if (data?.screen) {
        console.log('📱 Navigate to screen:', data.screen);
        // You can integrate with your navigation system here
      }
    });

    // Listen for token refresh
    this.unsubscribeTokenRefresh = messaging().onTokenRefresh(async token => {
      console.log('🔄 FCM token refreshed:', token.substring(0, 20) + '...');
      this.fcmToken = token;
      
      // Update token in Firestore if we have a user
      const currentUser = useStore.getState().currentUser;
      if (currentUser?.id) {
        await this.saveTokenToFirestore(currentUser.id);
      }
    });

    console.log('✅ FCM listeners setup complete');
  }

  /**
   * Remove all listeners
   */
  removeListeners(): void {
    if (this.notificationListener) {
      Notifications.removeNotificationSubscription(this.notificationListener);
    }
    if (this.responseListener) {
      Notifications.removeNotificationSubscription(this.responseListener);
    }
    if (this.unsubscribeTokenRefresh) {
      this.unsubscribeTokenRefresh();
    }
    console.log('✅ FCM listeners removed');
  }

  /**
   * Send a test local notification
   */
  async sendTestLocalNotification(): Promise<void> {
    try {
      console.log('🧪 Sending test local notification...');
      
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🧪 Test Notification (FCM)',
          body: 'This is a local test notification from Firebase Cloud Messaging!',
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
   * Get current FCM token
   */
  getCurrentToken(): string | null {
    return this.fcmToken;
  }

  /**
   * Check current permission status
   */
  async getPermissionStatus(): Promise<'granted' | 'denied' | 'not-determined'> {
    try {
      const authStatus = await messaging().hasPermission();
      
      if (authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
          authStatus === messaging.AuthorizationStatus.PROVISIONAL) {
        return 'granted';
      } else if (authStatus === messaging.AuthorizationStatus.DENIED) {
        return 'denied';
      } else {
        return 'not-determined';
      }
    } catch (error) {
      console.error('❌ Error checking permission status:', error);
      return 'not-determined';
    }
  }

  /**
   * Initialize the FCM notification service
   */
  async initialize(userId: string): Promise<boolean> {
    try {
      console.log('🚀 Initializing FCM notification service...');

      // Get FCM token
      const token = await this.getFCMToken();
      if (!token) {
        console.log('⚠️ Failed to get FCM token, but continuing with setup...');
      }

      // Save token to Firestore if we have one
      if (token) {
        await this.saveTokenToFirestore(userId);
      }

      // Set up listeners regardless of token status
      this.setupFCMListeners();

      console.log('✅ FCM notification service initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Error initializing FCM notification service:', error);
      return false;
    }
  }

  /**
   * Cleanup on logout
   */
  cleanup(): void {
    this.removeListeners();
    this.fcmToken = null;
    console.log('✅ FCM notification service cleanup complete');
  }
}

// Export singleton instance
export const fcmNotificationService = FCMNotificationService.getInstance();

