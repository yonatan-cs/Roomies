/**
 * Test script to reset notification permissions for testing
 * Run this in your app console or use AsyncStorage debugging tools
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export const resetNotificationPermissions = async () => {
  try {
    console.log('🔄 Resetting notification permissions flag...');
    await AsyncStorage.removeItem('notification_permissions_requested');
    console.log('✅ Notification permissions flag reset!');
    console.log('📱 Please restart the app to see the permission prompt again.');
  } catch (error) {
    console.error('❌ Error resetting permissions:', error);
  }
};

export const checkNotificationPermissionsStatus = async () => {
  try {
    const hasAsked = await AsyncStorage.getItem('notification_permissions_requested');
    console.log('📊 Notification permissions status:');
    console.log('  - Has asked for permissions:', hasAsked ? 'Yes' : 'No');
    return hasAsked;
  } catch (error) {
    console.error('❌ Error checking permissions status:', error);
  }
};

// To use this, import it in your app and call:
// import { resetNotificationPermissions, checkNotificationPermissionsStatus } from './test-notification-permissions';
// await checkNotificationPermissionsStatus();
// await resetNotificationPermissions();

