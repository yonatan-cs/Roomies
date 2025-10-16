# Firebase Cloud Messaging - Quick Start 🚀

## ✅ What's Done

Your app now has **full Firebase Cloud Messaging (FCM) integration** with real FCM tokens!

### 🎯 Key Features Added:
1. ✅ Real FCM tokens (not Expo tokens anymore)
2. ✅ Notification toggle in Settings screen
3. ✅ Status indicator (Enabled/Disabled/Not Set)
4. ✅ Test notification button
5. ✅ Cloud Functions for sending notifications
6. ✅ Automatic permission requests
7. ✅ Opens device settings if permission denied

---

## 🏃‍♂️ Quick Testing (3 Steps)

### Step 1: Install Functions Dependencies
```bash
cd functions
npm install
```

### Step 2: Rebuild the App
```bash
# iOS
npx expo run:ios

# Android
npx expo run:android
```

⚠️ **Important:** You MUST rebuild because we added native Firebase modules!

### Step 3: Deploy Cloud Functions
```bash
cd functions
npm run build
npm run deploy
```

---

## 🧪 How to Test

1. **Launch App** → Should ask for notification permission
2. **Grant Permission** → FCM token is generated
3. **Go to Settings** → See "🔔 Notifications" section
4. **Check Status** → Should show "✅ Enabled"
5. **Tap "Test Notification"** → Should receive notification
6. **Check Console Logs** → See FCM token and success messages

---

## 📱 What You'll See in Settings

```
🔔 Notifications

┌─────────────────────────────────┐
│ ✅ Status: Enabled              │
│ FCM Token: abc123xyz...         │
└─────────────────────────────────┘

[🔔 Enable Notifications]  ← Only if disabled

[🧪 Test Notification]
```

---

## 🎓 How to Send Notifications

### From Your App Code:

```typescript
import { getFunctions, httpsCallable } from 'firebase/functions';

// Send to one user
const sendNotification = async () => {
  const functions = getFunctions();
  const sendNotificationToUser = httpsCallable(functions, 'sendNotificationToUser');
  
  await sendNotificationToUser({
    targetUserId: 'user123',
    title: 'New Expense!',
    body: 'John added $50 for groceries',
    notificationData: {
      screen: 'Expenses',
      expenseId: 'exp123'
    }
  });
};

// Send to multiple users (apartment members)
const notifyApartment = async (memberIds: string[]) => {
  const functions = getFunctions();
  const sendToMultiple = httpsCallable(functions, 'sendNotificationToMultipleUsers');
  
  await sendToMultiple({
    userIds: memberIds,
    title: 'Cleaning Day!',
    body: 'It\'s time for apartment cleaning',
  });
};
```

---

## 🔍 Debugging

### Check if token exists:
1. Open Settings screen
2. Look at Notifications section
3. Token should be displayed

### Check Firestore:
1. Firebase Console → Firestore
2. Navigate to `users/[userId]`
3. Check `fcm_token` field

### View Cloud Function Logs:
```bash
firebase functions:log
```

---

## 📂 Files Created/Modified

### New Files:
- ✅ `src/services/fcm-notification-service.ts` - FCM service with real tokens
- ✅ `functions/src/index.ts` - Cloud functions for notifications
- ✅ `functions/package.json` - Functions dependencies
- ✅ `functions/tsconfig.json` - TypeScript config
- ✅ `FCM_SETUP_AND_TESTING_GUIDE.md` - Complete guide
- ✅ `FCM_QUICK_START.md` - This file

### Modified Files:
- ✅ `app.json` - Added Firebase plugins
- ✅ `App.tsx` - Uses FCM service
- ✅ `src/screens/SettingsScreen.tsx` - Added notification section
- ✅ `package.json` - Added Firebase packages

### Old Files (Can Delete):
- ⚠️ `src/services/notification-service.ts` - Old Expo service
- ⚠️ `src/services/firebase-notification-service.ts` - Unused mock service

---

## 🎯 Cloud Functions Available

1. **`sendTestNotificationV1`** - Send test notification to yourself
   ```typescript
   httpsCallable(functions, 'sendTestNotificationV1')({
     title: 'Test',
     body: 'Hello!'
   })
   ```

2. **`sendNotificationToUser`** - Send to specific user
   ```typescript
   httpsCallable(functions, 'sendNotificationToUser')({
     targetUserId: 'abc123',
     title: 'Hello',
     body: 'Message',
     notificationData: { screen: 'Dashboard' }
   })
   ```

3. **`sendNotificationToMultipleUsers`** - Send to multiple users
   ```typescript
   httpsCallable(functions, 'sendNotificationToMultipleUsers')({
     userIds: ['user1', 'user2'],
     title: 'Apartment Update',
     body: 'Something happened'
   })
   ```

---

## ⚠️ Important Notes

### Must Use Physical Device
- ❌ Simulators/Emulators don't support FCM
- ✅ Use real iPhone or Android device

### Must Rebuild App
- ❌ Can't use Expo Go
- ✅ Must use `expo run:ios` or `expo run:android`
- ✅ Or build with EAS

### Must Deploy Functions
- Cloud functions must be deployed to Firebase
- Run `npm run deploy` in functions directory

---

## 🐛 Common Issues

### "No FCM token to save"
→ Use physical device, not simulator

### "Permission denied"
→ Go to device Settings → App → Enable notifications

### "Function not found"
→ Deploy cloud functions: `cd functions && npm run deploy`

### Notifications don't appear
→ Check notification permissions in device settings
→ Make sure app is built with Firebase modules (not Expo Go)

---

## 📖 Full Documentation

For complete details, see: **`FCM_SETUP_AND_TESTING_GUIDE.md`**

---

## 🎉 You're Ready!

Your app now has full FCM support! Just:
1. Install functions dependencies
2. Rebuild the app
3. Deploy cloud functions
4. Test on physical device

**Happy testing! 🚀**

