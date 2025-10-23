/**
 * Example of how to use the notification permission function
 * This file shows how to request notification permissions and get tokens
 */

import { registerForPushNotificationsAsync } from '../utils/notification-utils';

/**
 * Example: Request notification permissions and get token
 * This is the exact function you requested
 */
export async function exampleNotificationSetup() {
  console.log('🔔 Starting notification setup example...');
  
  try {
    // This is the exact function you requested
    const token = await registerForPushNotificationsAsync();
    
    if (token) {
      console.log('✅ Successfully got notification token:', token);
      
      // Here you can save the token to your backend/database
      // await saveTokenToBackend(token);
      
      return token;
    } else {
      console.log('❌ Failed to get notification token');
      return null;
    }
  } catch (error) {
    console.error('❌ Error in notification setup:', error);
    return null;
  }
}

/**
 * Example: Check if device supports notifications
 */
export function checkDeviceSupport() {
  const isSupported = typeof window !== 'undefined' && 'Notification' in window;
  console.log('📱 Device supports notifications:', isSupported);
  return isSupported;
}

/**
 * Example: Manual permission request
 * Use this if you want to request permissions manually (not on first launch)
 */
export async function manualPermissionRequest() {
  console.log('🔔 Manually requesting notification permissions...');
  
  const token = await registerForPushNotificationsAsync();
  
  if (token) {
    console.log('✅ Manual permission request successful');
    return token;
  } else {
    console.log('❌ Manual permission request failed');
    return null;
  }
}
