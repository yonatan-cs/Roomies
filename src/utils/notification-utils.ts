import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

export async function registerForPushNotificationsAsync() {
  // הרשאות
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    console.log('❌ Notification permission not granted');
    return { expoToken: null, deviceToken: null };
  }

  // 1) Expo token (אם אתה משתמש ב-Expo Push Service)
  const expoToken = (await Notifications.getExpoPushTokenAsync()).data;
  console.log('✅ Expo push token:', expoToken);

  // 2) Device token: iOS→APNs, Android→FCM
  const device = await Notifications.getDevicePushTokenAsync();
  // device = { type: 'apns' | 'fcm', data: '...' }
  console.log('✅ Device push token type:', device.type);
  console.log('✅ Device push token:', device.data);

  return { expoToken, deviceToken: device };
}

/**
 * Check if the device supports push notifications
 */
export function isDeviceSupported(): boolean {
  return Constants.isDevice;
}

/**
 * Get current notification permission status
 */
export async function getNotificationPermissionStatus(): Promise<Notifications.NotificationPermissionsStatus> {
  return await Notifications.getPermissionsAsync();
}

/**
 * Request notification permissions
 */
export async function requestNotificationPermissions(): Promise<Notifications.NotificationPermissionsStatus> {
  return await Notifications.requestPermissionsAsync();
}
