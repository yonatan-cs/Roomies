# FCM Testing Checklist - What You Need to Do

## ✅ Good News: Firebase is Already Set Up!

I can see your Firebase project is configured:
- Project ID: `roomies-hub`
- iOS bundle: `com.vibecode.app`
- Android package: `com.vibecode.app`
- Firebase config files are present ✅

---

## 🚀 What You Need to Do (4 Simple Steps)

### Step 1: Install Firebase CLI (if not already installed)

```bash
npm install -g firebase-tools
```

Then login:
```bash
firebase login
```

### Step 2: Install Cloud Functions Dependencies

```bash
cd /home/user/workspace/functions
npm install
```

### Step 3: Deploy Cloud Functions

```bash
# Still in functions directory
npm run build
cd ..
firebase deploy --only functions
```

This will deploy 3 functions:
- `sendTestNotificationV1` - For testing
- `sendNotificationToUser` - Send to one user
- `sendNotificationToMultipleUsers` - Send to multiple users

### Step 4: Rebuild Your App

**You MUST rebuild because we added native modules:**

For iOS:
```bash
cd /home/user/workspace
npx expo run:ios
```

For Android:
```bash
cd /home/user/workspace
npx expo run:android
```

⚠️ **Important:** You can't use Expo Go anymore! The app needs native Firebase modules.

---

## 📱 Testing on Device (After Rebuild)

### First Time Setup:
1. ✅ Launch app on **physical device** (not simulator)
2. ✅ You'll see notification permission dialog → **Tap Allow**
3. ✅ Login to your account
4. ✅ Go to **Settings** screen

### In Settings Screen:
1. Scroll down to **"🔔 Notifications"** section
2. You should see:
   ```
   🔔 Notifications
   
   Status: ✅ Enabled
   FCM Token: abc123xyz...
   
   [🧪 Test Notification]
   ```
3. Tap **"🧪 Test Notification"** button
4. You should receive a notification! 🎉

---

## ❓ FAQ - Common Questions

### Q: Do I need to change anything in Firebase Console?
**A: No!** Your Firebase project is already configured correctly. The GoogleService files are already in place.

### Q: Do I need to add anything to Xcode or Android Studio?
**A: No!** The `expo run:ios` and `expo run:android` commands handle everything automatically.

### Q: Can I test with Expo Go?
**A: No.** Expo Go doesn't support native Firebase modules. You must use `expo run:ios/android`.

### Q: Do I need a paid Apple Developer account?
**A: Not for testing on your own device.** You can run on your device without a paid account. You only need a paid account for TestFlight/App Store.

### Q: Will this work on simulator?
**A: No.** FCM notifications only work on physical devices.

---

## 🧪 Quick Test (Without Rebuilding First)

If you want to test Cloud Functions before rebuilding the app:

### Option 1: Firebase Console
1. Go to Firebase Console: https://console.firebase.google.com/
2. Select project: **roomies-hub**
3. Go to **Functions** section
4. After deploying, you'll see your functions listed

### Option 2: Firebase CLI
```bash
# View deployed functions
firebase functions:list

# View logs
firebase functions:log
```

---

## 🎯 Complete Testing Flow

### Step 1: Deploy Functions (Do this first!)
```bash
cd /home/user/workspace/functions
npm install
npm run build
cd ..
firebase deploy --only functions
```

**Expected output:**
```
✔ functions[sendTestNotificationV1] Successful create operation.
✔ functions[sendNotificationToUser] Successful create operation.
✔ functions[sendNotificationToMultipleUsers] Successful create operation.
```

### Step 2: Rebuild App
```bash
cd /home/user/workspace
npx expo run:ios  # or run:android
```

**Expected output:**
```
› Building Roomies for iPhone...
› Installed
› Opening app...
```

### Step 3: Test in App
1. Open app on device
2. Grant notification permission
3. Login
4. Go to Settings → See Notifications section
5. Tap Test button
6. Receive notification ✅

### Step 4: Verify in Console
```bash
firebase functions:log
```

**Expected log:**
```
📨 Sending test notification to user: [your-user-id]
✅ Successfully sent notification
```

---

## 🔧 Troubleshooting

### Issue: "firebase: command not found"
**Solution:**
```bash
npm install -g firebase-tools
firebase login
```

### Issue: "Error: Failed to get Firebase project"
**Solution:**
```bash
firebase login
firebase use roomies-hub
```

### Issue: Build fails with "No bundle ID"
**Solution:** The bundle ID is already configured in app.json. Try:
```bash
npx expo prebuild --clean
npx expo run:ios
```

### Issue: "No permission to deploy functions"
**Solution:**
```bash
firebase login --reauth
```
Make sure you're logged in with the account that owns the Firebase project.

### Issue: Notifications not appearing on device
**Check:**
- ✅ Using physical device (not simulator)?
- ✅ Granted notification permission in app?
- ✅ Notifications enabled in device Settings → Roomies?
- ✅ Cloud functions deployed successfully?
- ✅ App rebuilt with `expo run:ios/android`?

---

## 📋 Final Checklist Before Testing

- [ ] Firebase CLI installed (`npm install -g firebase-tools`)
- [ ] Logged into Firebase (`firebase login`)
- [ ] Functions dependencies installed (`cd functions && npm install`)
- [ ] Functions deployed (`firebase deploy --only functions`)
- [ ] App rebuilt (`expo run:ios` or `expo run:android`)
- [ ] Testing on physical device (not simulator)
- [ ] Notification permission granted in app

---

## 🎉 That's It!

No manual setup needed in:
- ❌ Firebase Console (already configured)
- ❌ Xcode (handled by Expo)
- ❌ Android Studio (handled by Expo)
- ❌ App configuration files (already updated)

Just:
1. Deploy functions
2. Rebuild app
3. Test!

**You're ready to go! 🚀**

---

## 💡 One-Line Commands

If you want to do everything in one go:

```bash
# 1. Install and deploy functions
cd /home/user/workspace/functions && npm install && npm run build && cd .. && firebase deploy --only functions

# 2. Rebuild app (in separate terminal)
cd /home/user/workspace && npx expo run:ios

# 3. Test on device!
```

Need help? Check the full guide: `FCM_SETUP_AND_TESTING_GUIDE.md`

