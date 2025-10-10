# Firebase Cloud Messaging (FCM) Setup and Testing Guide

## 🎯 Overview

This guide covers the complete setup and testing of Firebase Cloud Messaging (FCM) in the Roomies app. The app now uses **real FCM tokens** from Firebase instead of Expo push tokens.

## ✅ What's Been Implemented

### 1. **React Native Firebase Integration**
- ✅ Installed `@react-native-firebase/app` and `@react-native-firebase/messaging`
- ✅ Added Firebase plugins to `app.json`
- ✅ Created new `fcm-notification-service.ts` with real FCM token support

### 2. **Notification Features**
- ✅ Automatic permission request on first app launch
- ✅ Manual "Enable Notifications" button in Settings
- ✅ Notification status display (Enabled/Disabled/Not Set)
- ✅ FCM token display (for debugging)
- ✅ Test notification button
- ✅ Opens device settings if permission denied

### 3. **Cloud Functions**
- ✅ `sendTestNotificationV1` - Send test notification to current user
- ✅ `sendNotificationToUser` - Send notification to specific user
- ✅ `sendNotificationToMultipleUsers` - Send to multiple users (e.g., apartment members)

### 4. **Updated Files**
- ✅ `app.json` - Added Firebase plugins
- ✅ `App.tsx` - Uses FCM service instead of Expo notifications
- ✅ `src/services/fcm-notification-service.ts` - New FCM service (CREATED)
- ✅ `src/screens/SettingsScreen.tsx` - Added notification section with toggle
- ✅ `functions/src/index.ts` - Cloud functions for FCM (CREATED)

---

## 📋 Prerequisites

Before testing, ensure you have:

1. **Firebase Project Setup**
   - Firebase project created
   - iOS app registered with bundle ID: `com.Roomies.app`
   - Android app registered with package name: `com.Roomies.app`
   - `GoogleService-Info.plist` in project root (iOS)
   - `google-services.json` in project root (Android)

2. **Physical Device**
   - FCM notifications don't work on simulators/emulators
   - You need an actual iOS or Android device

3. **Development Build**
   - Cannot use Expo Go (doesn't support native Firebase modules)
   - Need to create a development build with EAS or `expo run:ios`/`expo run:android`

---

## 🚀 Setup Instructions

### Step 1: Install Dependencies

The Firebase packages are already installed. If you need to reinstall:

```bash
cd /home/user/workspace
npm install @react-native-firebase/app @react-native-firebase/messaging --legacy-peer-deps
```

### Step 2: Install Cloud Functions Dependencies

```bash
cd functions
npm install
```

### Step 3: Build the App

You need to rebuild the native app since we added Firebase native modules:

#### For iOS:
```bash
# Using Expo
npx expo run:ios

# Or using EAS
eas build --platform ios --profile development
```

#### For Android:
```bash
# Using Expo
npx expo run:android

# Or using EAS
eas build --platform android --profile development
```

### Step 4: Deploy Cloud Functions

```bash
cd functions
npm run build
npm run deploy
```

Or deploy individually:
```bash
firebase deploy --only functions:sendTestNotificationV1
firebase deploy --only functions:sendNotificationToUser
firebase deploy --only functions:sendNotificationToMultipleUsers
```

---

## 🧪 Testing Guide

### Test 1: First Launch Permission Request

**Expected Behavior:**
1. Uninstall the app completely (to reset permissions)
2. Install and launch the app
3. On first launch, you should see the iOS/Android notification permission dialog
4. Grant permission

**Verification:**
- Check console logs for: `🔔 First time app launch - requesting FCM notification permissions`
- Check console logs for: `✅ User granted FCM notification permissions`

### Test 2: FCM Token Generation

**Expected Behavior:**
1. After granting permissions and logging in
2. App should get an FCM token from Firebase
3. Token should be saved to Firestore

**Verification:**
- Check console logs for: `📱 Getting FCM token from Firebase...`
- Check console logs for: `✅ FCM token obtained:`
- Check Firestore: User document should have `fcm_token` field
- Go to Settings → Notifications section → Should show token preview

### Test 3: Settings Screen Notification Status

**Expected Behavior:**
1. Open Settings screen
2. See "🔔 Notifications" section at the top
3. Status should show:
   - ✅ **Enabled** (green) if permissions granted
   - ❌ **Disabled** (red) if permissions denied
   - ⚠️ **Not Set** (yellow) if not determined

**Verification:**
- Status matches actual permission state
- FCM token is displayed (first 20 characters)
- Test button is enabled only when status is "Enabled"

### Test 4: Enable Notifications Button

**If permissions were denied:**

**Expected Behavior:**
1. Tap "🔔 Enable Notifications" button
2. Should show alert: "Notification permissions were denied"
3. Alert has "Open Settings" button
4. Tapping "Open Settings" opens iOS/Android Settings app
5. User can enable notifications from device settings
6. Return to app and refresh

**Verification:**
- Button appears only when status is not "Enabled"
- Opening settings works correctly
- After enabling in device settings, returning to app shows updated status

### Test 5: Local Notification Test

**Expected Behavior:**
1. Make sure notifications are enabled
2. Tap "🧪 Test Notification" button
3. Should see a local notification immediately
4. Notification should say: "🧪 Test Notification (FCM)"

**Verification:**
- Check console logs for: `🧪 Testing FCM notifications...`
- Check console logs for: `✅ Local notification sent`
- Notification appears on device
- Success alert shows: "Local notification sent! Check your device."

### Test 6: Remote Notification via Cloud Function

**Expected Behavior:**
1. Ensure cloud functions are deployed
2. Tap "🧪 Test Notification" button
3. Local notification appears immediately
4. Remote notification also sent via cloud function
5. Check Firebase Console Functions logs

**Verification:**
- Check console logs for: `📡 Calling cloud function to send remote FCM notification...`
- Check console logs for: `✅ Remote FCM notification sent:`
- Check Firebase Console → Functions → Logs:
  - Should see: `📨 Sending test notification to user: [userId]`
  - Should see: `✅ Successfully sent notification to user [userId]`
- Notification appears on device (may be duplicate of local)

### Test 7: Background Notification

**Expected Behavior:**
1. Send a test notification while app is in background
2. Notification should appear in notification center
3. Tap notification
4. App should open

**How to Test:**
1. Send notification using Firebase Console:
   - Go to Firebase Console → Cloud Messaging
   - Click "Send your first message"
   - Enter title and body
   - Select your app
   - Add FCM token (copy from Settings screen)
   - Send notification
2. OR use cloud function from another device/browser

**Verification:**
- Notification appears while app is closed/backgrounded
- Tapping notification opens app
- Check console logs for: `📬 Background FCM message received:`

### Test 8: Foreground Notification

**Expected Behavior:**
1. Keep app open
2. Send a test notification
3. Should see notification displayed as banner/alert

**Verification:**
- Check console logs for: `📨 Foreground FCM message received:`
- Local notification is shown even when app is open
- Notification is visible and tappable

---

## 🔍 Debugging

### Check FCM Token
```typescript
// In console or add to code temporarily
import { fcmNotificationService } from './src/services/fcm-notification-service';

const token = fcmNotificationService.getCurrentToken();
console.log('FCM Token:', token);
```

### Check Permission Status
```typescript
const status = await fcmNotificationService.getPermissionStatus();
console.log('Permission Status:', status);
// Returns: 'granted' | 'denied' | 'not-determined'
```

### Check Firestore Token
1. Open Firebase Console
2. Go to Firestore Database
3. Navigate to `users/[userId]`
4. Check if `fcm_token` field exists and has a value

### View Cloud Function Logs
```bash
# Real-time logs
firebase functions:log

# Filter by function
firebase functions:log --only sendTestNotificationV1
```

### Test Cloud Function Manually

Using Firebase Console:
1. Go to Firebase Console → Functions
2. Click on function name
3. Go to "Testing" tab
4. Enter test data:
```json
{
  "title": "Manual Test",
  "body": "This is a manual test from console"
}
```
5. Run test

---

## 🐛 Common Issues and Solutions

### Issue 1: "No FCM token to save"

**Cause:** Permissions not granted or device is simulator

**Solution:**
- Make sure you're on a physical device
- Check permission status in Settings
- Grant permissions if denied
- Restart app after granting permissions

### Issue 2: "messaging/invalid-registration-token"

**Cause:** FCM token is expired or invalid

**Solution:**
- Token is automatically removed from Firestore
- User needs to re-enable notifications
- Tap "Enable Notifications" button in Settings

### Issue 3: Cloud function fails with "No FCM token found"

**Cause:** User hasn't enabled notifications or token not saved to Firestore

**Solution:**
1. Check Firestore: Does user document have `fcm_token` field?
2. If missing, enable notifications in Settings
3. Verify token is saved: `fcm_token` field should exist

### Issue 4: Notifications don't appear on device

**Possible causes:**
- Permissions denied
- Using simulator instead of physical device
- App not built with Firebase modules
- Do Not Disturb mode enabled on device

**Solutions:**
- Check device notification settings
- Use physical device
- Rebuild app with `expo run:ios`/`android`
- Check device Do Not Disturb settings

### Issue 5: Build fails after adding Firebase

**Cause:** Native modules require rebuilding

**Solution:**
```bash
# Clean build
rm -rf node_modules ios android .expo

# Reinstall
npm install --legacy-peer-deps

# Rebuild
npx expo prebuild --clean
npx expo run:ios  # or run:android
```

---

## 📊 Testing Checklist

Use this checklist to verify everything works:

- [ ] App requests notification permission on first launch
- [ ] FCM token is generated after granting permission
- [ ] Token is saved to Firestore (`fcm_token` field)
- [ ] Settings screen shows notification status correctly
- [ ] "Enable Notifications" button appears when disabled
- [ ] "Enable Notifications" button requests permission
- [ ] "Open Settings" works when permission denied
- [ ] FCM token is displayed in Settings (truncated)
- [ ] Test button is disabled when notifications disabled
- [ ] Test button sends local notification
- [ ] Test button calls cloud function successfully
- [ ] Cloud function sends remote notification
- [ ] Cloud function logs appear in Firebase Console
- [ ] Background notifications work (app closed)
- [ ] Foreground notifications work (app open)
- [ ] Tapping notification opens app

---

## 🎓 How to Use FCM in Your App

### Sending notification to a user:

```typescript
import { getFunctions, httpsCallable } from 'firebase/functions';

const sendNotification = async (userId: string, title: string, body: string) => {
  const functions = getFunctions();
  const sendNotificationToUser = httpsCallable(functions, 'sendNotificationToUser');
  
  try {
    const result = await sendNotificationToUser({
      targetUserId: userId,
      title,
      body,
      notificationData: {
        screen: 'Dashboard', // Optional: for navigation
        extra: 'data'
      }
    });
    console.log('Notification sent:', result.data);
  } catch (error) {
    console.error('Error sending notification:', error);
  }
};
```

### Sending to multiple users (e.g., apartment members):

```typescript
const notifyApartment = async (memberIds: string[], title: string, body: string) => {
  const functions = getFunctions();
  const sendToMultiple = httpsCallable(functions, 'sendNotificationToMultipleUsers');
  
  const result = await sendToMultiple({
    userIds: memberIds,
    title,
    body,
    notificationData: {
      type: 'apartment_update'
    }
  });
  
  console.log('Sent to apartment:', result.data.results);
};
```

---

## 📚 Additional Resources

- [React Native Firebase Docs](https://rnfirebase.io/)
- [FCM Documentation](https://firebase.google.com/docs/cloud-messaging)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)
- [Cloud Functions for Firebase](https://firebase.google.com/docs/functions)

---

## 🎉 Next Steps

Once everything is tested and working:

1. **Remove old notification service** (optional cleanup):
   - Delete `src/services/notification-service.ts` (old Expo service)
   - Delete `src/services/firebase-notification-service.ts` (unused mock service)

2. **Implement real use cases**:
   - Send notification when expense is added
   - Send notification when it's user's turn to clean
   - Send notification when shopping item is marked done
   - Send notification for debt settlements

3. **Enhance notification handling**:
   - Add deep linking (tap notification → navigate to specific screen)
   - Add notification categories
   - Add rich media (images)
   - Add action buttons

4. **Production considerations**:
   - Set up notification batching to avoid spam
   - Implement quiet hours
   - Add user preferences (notification types on/off)
   - Monitor FCM quota and usage

---

## ✅ Success Criteria

Your FCM integration is working correctly if:

1. ✅ App requests permissions on first launch
2. ✅ FCM tokens are generated and saved to Firestore
3. ✅ Settings screen shows accurate notification status
4. ✅ Local test notifications work
5. ✅ Remote test notifications work via cloud function
6. ✅ Background notifications appear
7. ✅ Foreground notifications appear
8. ✅ Users can enable/disable notifications
9. ✅ Cloud function logs show successful sends
10. ✅ Invalid tokens are automatically cleaned up

**Good luck with your FCM implementation! 🚀**

