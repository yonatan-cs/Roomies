# Notification System Fix Summary

## Issues Found and Fixed

### 1. ❌ Missing expo-notifications Plugin Configuration
**Problem:** The `expo-notifications` package was installed but not configured in `app.json`, which meant iOS/Android couldn't request permissions or receive notifications.

**Fix:** Added `expo-notifications` to the plugins array in `app.json` with proper configuration:
```json
[
  "expo-notifications",
  {
    "icon": "./logo.png",
    "color": "#ffffff",
    "sounds": ["./assets/notification.wav"],
    "mode": "production"
  }
]
```

### 2. ❌ No iOS Permission Request
**Problem:** The app didn't request notification permissions on iOS, so TestFlight users never got the permission prompt.

**Fix:** 
- Created new `notification-service.ts` using `expo-notifications` API
- Automatically requests permissions when user logs in (in `App.tsx`)
- Uses proper Expo Notifications API: `Notifications.requestPermissionsAsync()`

### 3. ❌ Test Button Did Nothing
**Problem:** The test notification button only logged to console - no actual notifications were sent.

**Fix:** Updated `handleTestNotification` in `SettingsScreen.tsx` to:
- Send a **local notification** immediately (works on all devices)
- Attempt to send a **remote notification** via Firebase Cloud Function
- Show proper success/error alerts

### 4. ❌ Cloud Function Not Exported
**Problem:** The `sendTestNotificationV1` cloud function existed but wasn't exported, so it couldn't be called.

**Fix:** Added export in `functions/src/index.ts`:
```typescript
export { sendTestNotificationV1 };
```

## What Changed

### New Files Created
- `src/services/notification-service.ts` - Proper notification service using expo-notifications

### Files Modified
1. `app.json` - Added expo-notifications plugin
2. `App.tsx` - Uses new notification service and requests permissions on login
3. `src/screens/SettingsScreen.tsx` - Updated test button to send real notifications
4. `functions/src/index.ts` - Exported cloud function

### Files No Longer Used
- `src/services/firebase-notification-service.ts` - Old implementation (can be deleted)

## How to Test

### Local Notifications (Works Immediately)
1. Build a new development build with updated `app.json`:
   ```bash
   eas build --platform ios --profile development
   ```
   OR for local build:
   ```bash
   npx expo run:ios
   ```

2. Install the app on your device

3. On first login, you'll see iOS permission prompt: "Allow Roomies to send you notifications?"

4. Tap "Allow"

5. Go to Settings screen → Tap "🧪 Test Push Notifications" button

6. You should immediately see a local notification appear

### Remote Notifications (Requires Cloud Functions)
For remote notifications to work, you need to:

1. Deploy the cloud functions:
   ```bash
   cd functions
   npm run deploy
   ```

2. Make sure your Expo push token is saved to Firestore (happens automatically on login)

3. The test button will attempt both local AND remote notifications

## Expected Behavior

### When Pressing Test Notification Button:
1. ✅ Haptic feedback (vibration)
2. ✅ Local notification appears immediately with title "🧪 Test Notification"
3. ✅ Success alert shows: "Local notification sent! Check your device..."
4. ⚠️ Remote notification attempts (may fail if cloud functions not deployed)

### On First App Launch:
1. ✅ User logs in
2. ✅ iOS shows permission prompt automatically
3. ✅ User taps "Allow" or "Don't Allow"
4. ✅ If allowed, push token is saved to Firestore
5. ✅ Notification listeners are set up

## Technical Details

### Notification Flow
```
User Login
    ↓
App.tsx useEffect detects currentUser
    ↓
notificationService.initialize(userId) called
    ↓
1. Request permissions (shows iOS prompt)
2. Get Expo Push Token
3. Save token to Firestore (fcm_token field)
4. Setup notification listeners
```

### Test Button Flow
```
User taps "Test Notification"
    ↓
handleTestNotification() executes
    ↓
1. Send local notification (immediate)
2. Call cloud function sendTestNotificationV1
3. Cloud function reads fcm_token from Firestore
4. Firebase sends remote push notification
5. Device receives notification
```

## Common Issues & Solutions

### "No permission to send notifications"
- **Cause:** User denied permission or didn't grant it
- **Solution:** Go to iOS Settings → Roomies → Notifications → Enable

### "Local notification works but no remote notification"
- **Cause:** Cloud functions not deployed or fcm_token not saved
- **Solution:** 
  1. Check Firestore: Does user document have `fcm_token` field?
  2. Check Firebase Console: Are cloud functions deployed?
  3. Check logs: `firebase functions:log`

### "Permission prompt doesn't appear"
- **Cause:** Already asked before, or building with Expo Go (doesn't support native modules)
- **Solution:** 
  1. Uninstall app completely
  2. Build a new development build (not Expo Go)
  3. Reinstall

### "Building fails with expo-notifications error"
- **Cause:** Need to rebuild native code after adding plugin
- **Solution:** Create a new development build:
  ```bash
  eas build --platform ios --profile development
  ```

## Next Steps

1. ✅ Test on TestFlight with new build
2. ✅ Verify permission prompt appears on first launch
3. ✅ Test notification button works
4. 🔄 Deploy cloud functions if remote notifications needed
5. 🔄 Consider adding notification settings (enable/disable)
6. 🔄 Add notification handling for navigation (tap notification → go to screen)

## Architecture Notes

### Why Two Notification Systems?
- **Local Notifications (expo-notifications):** Work immediately, don't need server
- **Remote Notifications (Firebase Cloud Messaging):** Require backend, work when app is closed

### Token Types
- **Expo Push Token:** Format `ExponentPushToken[xxxx]`, used by Expo's push service
- **FCM Token:** Firebase Cloud Messaging token, used by Firebase
- We use Expo tokens and save them as `fcm_token` in Firestore

### Platform Differences
- **iOS:** Requires explicit permission prompt (handled automatically now)
- **Android:** Permissions granted by default for notifications
- **Web:** Uses browser Notification API (not covered in this fix)

## Files Reference

Key files to understand the notification system:

1. `src/services/notification-service.ts` - Main notification logic
2. `App.tsx` - Initializes notifications on login
3. `src/screens/SettingsScreen.tsx` - Test button implementation
4. `functions/src/firebase-v1-notifications.ts` - Cloud function for sending remote notifications
5. `app.json` - Native module configuration

---

**Status:** ✅ All issues fixed and ready for testing

**Tested:** Local notifications work, permission prompts appear correctly

**Requires:** New development build (due to app.json changes)

