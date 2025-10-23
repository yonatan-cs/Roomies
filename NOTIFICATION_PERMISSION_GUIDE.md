# 🔔 Notification Permission Guide

## Overview
This guide shows how to request notification permissions and get push tokens in your Expo/React Native app.

## The Main Function

The core function for requesting notification permissions is located in `src/utils/notification-utils.ts`:

```typescript
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

async function registerForPushNotificationsAsync() {
  let token;

  if (Constants.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      alert('Failed to get push token!');
      return;
    }
    token = (await Notifications.getExpoPushTokenAsync()).data;
    console.log(token);
  }

  return token;
}
```

## How It Works

1. **Device Check**: Only works on physical devices (not simulators)
2. **Permission Check**: Checks if permissions are already granted
3. **Permission Request**: If not granted, requests permissions from user
4. **Token Generation**: If permissions granted, gets Expo push token
5. **Error Handling**: Shows alert if permissions denied

## Usage Examples

### Basic Usage
```typescript
import { registerForPushNotificationsAsync } from './src/utils/notification-utils';

const token = await registerForPushNotificationsAsync();
if (token) {
  console.log('Got token:', token);
  // Save token to your backend
} else {
  console.log('Failed to get token');
}
```

### In App.tsx (First Launch)
The app automatically requests permissions on first launch and tests the function.

### Manual Request
```typescript
// In any component
const handleRequestPermissions = async () => {
  const token = await registerForPushNotificationsAsync();
  if (token) {
    // Success - save token
  } else {
    // Failed - show error message
  }
};
```

## Configuration Required

### app.json
```json
{
  "expo": {
    "android": {
      "googleServicesFile": "./google-services.json",
      "useNextNotificationsApi": true,
      "package": "com.yonrotem.roomies"
    },
    "ios": {
      "googleServicesFile": "./GoogleService-Info.plist",
      "infoPlist": {
        "UIBackgroundModes": ["remote-notification"]
      }
    },
    "plugins": [
      ["expo-notifications", {
        "icon": "./logo.png",
        "color": "#ffffff"
      }]
    ]
  }
}
```

## Testing

1. **Physical Device Only**: Push notifications only work on physical devices
2. **First Launch**: App automatically requests permissions on first launch
3. **Console Logs**: Check console for permission status and token generation
4. **Settings**: Users can manually enable notifications from app settings

## Files Created/Modified

- ✅ `src/utils/notification-utils.ts` - Main notification utility
- ✅ `src/examples/notification-example.ts` - Usage examples
- ✅ `App.tsx` - Added automatic testing of the function
- ✅ `app.json` - Added `useNextNotificationsApi: true`

## Console Output

When working correctly, you should see:
```
🔔 First time app launch - requesting FCM notification permissions
✅ User granted FCM notification permissions
🔔 Testing standalone notification function...
✅ Standalone notification function got token: ExponentPushToken[...]
```

## Troubleshooting

- **No permission dialog**: Make sure you're on a physical device
- **Token is null**: Check that permissions were granted
- **Build errors**: Ensure all dependencies are installed
- **iOS issues**: Check that `UIBackgroundModes` includes `remote-notification`
