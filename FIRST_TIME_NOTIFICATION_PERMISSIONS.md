# First-Time Notification Permissions

## Overview
The app now automatically requests notification permissions when a user opens the app for the first time.

## How It Works

### 1. First Launch Detection
- When the app starts, it checks `AsyncStorage` for the key `notification_permissions_requested`
- If not found, this is the user's first time opening the app

### 2. Permission Request
- The app automatically shows the native notification permission dialog
- This happens on the very first app launch, before any user interaction
- Uses the existing `notificationService.requestPermissions()` method

### 3. Tracking
- After showing the permission dialog (whether granted or denied), the app saves `notification_permissions_requested: 'true'` to AsyncStorage
- This ensures the permission dialog is only shown once

### 4. Subsequent Logins
- When a user logs in and permissions are granted, the notification service initializes normally
- If permissions were denied, the service skips token registration but still sets up listeners

## User Options

### Settings Screen
Users can manually enable notifications from the Settings screen if they:
- Initially denied permissions
- Want to re-enable notifications
- Changed their mind

**Location**: Settings → Feedback Section → "🔔 Enable Notifications" button

### Testing During Development
To reset the first-time permission request for testing:

```javascript
// Run this in your app or use AsyncStorage debugging tools
import AsyncStorage from '@react-native-async-storage/async-storage';
await AsyncStorage.removeItem('notification_permissions_requested');
```

Then restart the app to see the permission dialog again.

## Files Modified

1. **App.tsx**
   - Added `hasRequestedPermissions` state
   - Added `useEffect` to check and request permissions on first launch
   - Updated notification initialization to wait for permission check

2. **src/services/notification-service.ts**
   - Updated `initialize()` method to check permission status before registering
   - Prevents redundant permission requests

3. **src/screens/SettingsScreen.tsx**
   - Added `handleRequestNotificationPermissions()` function
   - Added "Enable Notifications" button in the Feedback section
   - Allows users to manually request permissions anytime

4. **ios/Roomies/Info.plist**
   - Added `remote-notification` to `UIBackgroundModes` array
   - Required for iOS push notifications to work properly

5. **app.json**
   - Added `infoPlist.UIBackgroundModes` configuration in iOS section
   - Ensures proper background mode permissions for notifications

## Behavior

### iOS
- Shows the standard iOS permission dialog with "Allow" and "Don't Allow" options
- If denied, users must go to device Settings to enable later (the Settings screen button will guide them)

### Android
- Shows the Android notification permission dialog (Android 13+)
- On older Android versions, notifications are allowed by default

### Physical Devices Only
- Push notifications only work on physical devices (not simulators/emulators)
- The service handles this gracefully with console warnings

## Logging
All permission-related actions are logged with emojis for easy debugging:
- 🔔 First time permission request
- ✅ Permissions granted
- ⚠️ Permissions denied or skipped
- 🚀 Notification service initialization

## Troubleshooting

### Permission Prompt Not Showing on iOS

**Issue**: The iOS notification permission prompt doesn't appear on first launch.

**Solution**:
1. Ensure `UIBackgroundModes` includes `remote-notification` in `Info.plist`
2. Rebuild the app after modifying `Info.plist` or `app.json`
3. For testing: Reset the permission flag and restart the app:
   ```javascript
   await AsyncStorage.removeItem('notification_permissions_requested');
   ```
4. **Important**: Push notifications only work on physical devices, not simulators

**Build Commands**:
```bash
# For iOS
npx expo run:ios

# Or with EAS
eas build --platform ios --profile development
```

### Testing Permissions

To test the permission prompt again:
1. Delete the app from your device (this clears AsyncStorage)
2. Reinstall and launch
3. Or use the test script: `test-notification-permissions.js`

## Future Enhancements
Consider adding:
- A custom onboarding screen explaining why notifications are useful
- A more user-friendly explanation before showing the system dialog
- Analytics to track permission grant/deny rates
- Reminder prompts for users who denied permissions

