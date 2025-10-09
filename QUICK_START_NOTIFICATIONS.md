# Quick Start: Testing Notifications

## 🚀 What You Need to Do

### 1. Rebuild the App (REQUIRED)
Since we modified `app.json`, you need to create a new native build:

```bash
# For iOS Development Build
eas build --platform ios --profile development

# OR for local development
npx expo run:ios
```

**Important:** Expo Go will NOT work - the `expo-notifications` plugin requires a development build.

### 2. Install & Test

1. Install the new build on your device
2. Launch the app and login
3. **You should see:** iOS permission prompt asking to allow notifications
4. Tap "**Allow**"
5. Go to **Settings screen** (gear icon)
6. Scroll down to "Feedback" section
7. Tap the purple "**🧪 Test Push Notifications**" button
8. **You should see:** A notification appear on your device!

## ✅ What Was Fixed

| Issue | Status |
|-------|--------|
| ❌ expo-notifications not configured | ✅ Fixed |
| ❌ No iOS permission prompt | ✅ Fixed |
| ❌ Test button did nothing | ✅ Fixed |
| ❌ Cloud function not exported | ✅ Fixed |

## 📱 Expected Behavior

### First Launch
```
Open App → Login → 🔔 Permission Prompt Appears → Tap "Allow"
```

### Test Button
```
Tap Button → 📳 Vibrate → 🔔 Notification Appears → ✅ Success Alert
```

## 🐛 Troubleshooting

### "No permission prompt"
- Make sure you're using a **development build**, not Expo Go
- Try uninstalling the app completely and reinstalling
- Check iOS Settings → Notifications → Roomies

### "Test button shows error"
- Check console logs for details
- Make sure you granted notification permission
- Verify you're on a physical device (not simulator)

### "Can't build the app"
```bash
# Clean and reinstall
rm -rf node_modules
npm install
npx expo prebuild --clean
```

## 📝 Files Changed

- ✏️ `app.json` - Added notifications plugin
- ✏️ `App.tsx` - Auto-request permissions on login
- ✏️ `src/screens/SettingsScreen.tsx` - Fixed test button
- ✏️ `functions/src/index.ts` - Exported cloud function
- ➕ `src/services/notification-service.ts` - New notification service

## 🎯 Next Steps

1. Build and test locally
2. If local notifications work, optionally deploy cloud functions for remote notifications:
   ```bash
   cd functions
   npm run deploy
   ```
3. Test on TestFlight
4. Ship it! 🚀

## 📚 More Details

See `NOTIFICATION_FIX_SUMMARY.md` for complete technical documentation.

---

**Ready to test!** Just rebuild and run the app. 🎉

