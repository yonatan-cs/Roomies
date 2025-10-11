# 🔔 Roomies App - FCM Push Notifications Guide

## Overview

This guide explains the complete FCM (Firebase Cloud Messaging) notification system implemented in the Roomies app. The system automatically sends push notifications to users when important events occur in their apartment.

## 📱 What Notifications Are Sent?

### Automatic Notifications (Firestore Triggers)

1. **🛒 Shopping Item Added**
   - When: Someone adds a new item to the shopping list
   - Who gets notified: All apartment members (except the person who added it)
   - Message: "{User} added '{Item Name}' to the shopping list"

2. **✅ Shopping Item Purchased**
   - When: Someone marks an item as purchased
   - Who gets notified: All apartment members (except the person who purchased it)
   - Message: "{User} bought '{Item Name}'"

3. **💰 Expense Added**
   - When: Someone adds a new expense
   - Who gets notified: All apartment members (except the person who added it)
   - Message: "{User} added {Title} - ₪{Amount}"

4. **👋 New Roommate Joined**
   - When: Someone joins the apartment
   - Who gets notified: All existing apartment members (except the new member)
   - Message: "{User} joined the apartment"

5. **🧹 Cleaning Completed**
   - When: Someone completes their cleaning turn
   - Who gets notified: All apartment members (except the person who cleaned)
   - Message: "{User} finished cleaning the apartment"

6. **📝 Cleaning Task Added**
   - When: Someone adds a new task to the cleaning checklist
   - Who gets notified: All apartment members
   - Message: "'{Task Title}' was added to the cleaning checklist"

### Scheduled Notifications (Run Daily)

7. **🧹 Cleaning Turn Reminder**
   - When: Runs daily at 9:00 AM (Israel Time)
   - Who gets notified: The person whose turn it is to clean (only if due today or overdue)
   - Message: "It's your turn to clean the apartment today!" or "Your cleaning turn is X day(s) overdue!"

8. **💰 Purchase Follow-up Reminder**
   - When: Runs daily at 10:00 AM (Israel Time)
   - Who gets notified: Users who purchased items 24+ hours ago with a price but haven't added an expense
   - Message: "You bought '{Item Name}' yesterday. Remember to add it to expenses!"

## 🏗️ Architecture

### Firebase Functions

All notification logic is implemented as Firebase Cloud Functions in `/functions/src/index.ts`:

**Helper Functions:**
- `sendNotificationToApartment()` - Sends notification to all members of an apartment
- `sendNotificationToUser()` - Sends notification to a specific user
- `getUserDisplayName()` - Gets user's display name for personalized messages

**Firestore Triggers:**
- `onShoppingItemAdded` - Triggered when shopping_items document is created
- `onShoppingItemPurchased` - Triggered when shopping_items document is updated (purchased = true)
- `onExpenseAdded` - Triggered when expenses document is created
- `onApartmentMemberAdded` - Triggered when apartments document is updated (new member added)
- `onCleaningCompleted` - Triggered when cleaningTasks document is updated (cleaning completed)
- `onCleaningChecklistItemAdded` - Triggered when cleaning_checklist_items document is created

**Scheduled Functions:**
- `checkCleaningReminders` - Runs daily at 9:00 AM Israel Time
- `checkPurchaseFollowUps` - Runs daily at 10:00 AM Israel Time

### Client-Side (Mobile App)

**FCM Service:** `src/services/fcm-notification-service.ts`
- Handles FCM token registration
- Manages notification permissions
- Listens for incoming notifications
- Saves FCM token to Firestore (`users` collection, `fcm_token` field)

**App Integration:** `App.tsx`
- Requests notification permissions on first launch
- Initializes FCM service when user logs in
- Registers FCM token with Firebase

## 🚀 Deployment

### Prerequisites

1. **Firebase Project on Blaze Plan**
   - Go to: https://console.firebase.google.com/project/roomies-hub/usage/details
   - Upgrade to Blaze (pay-as-you-go) plan
   - ✅ **Free Tier is generous:** 2M function invocations/month, normally stays free
   - 💡 Set a spending limit (e.g., $10/month) for safety

2. **APNs Key Configured**
   - ✅ Already done! Your `AuthKey_J8HLT8N895.p8` file is uploaded
   - ✅ Already configured in Firebase Console with Team ID: `88Z6DLL54T`

3. **Firebase CLI Token**
   - ✅ Already generated

### Deploy Commands

```bash
# Option 1: Deploy from your local machine (easiest)
cd /path/to/roomies-project
git pull
npx firebase-tools deploy --only functions

# Option 2: Deploy from SSH server
cd /home/user/workspace
npx --yes firebase-tools deploy --only functions --token "YOUR_TOKEN_HERE"
```

### After Deployment

Functions will be live at:
- `https://us-central1-roomies-hub.cloudfunctions.net/onShoppingItemAdded`
- `https://us-central1-roomies-hub.cloudfunctions.net/onExpenseAdded`
- etc.

You can view logs in Firebase Console: https://console.firebase.google.com/project/roomies-hub/functions

## 🧪 Testing

### Test Individual Notification

Use the existing test function in Settings screen:

```typescript
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();
const sendTest = httpsCallable(functions, 'sendTestNotificationV1');

await sendTest({
  title: 'Test Title',
  body: 'Test Message'
});
```

### Test Triggers

1. **Shopping Item Added:**
   - Add a new item to the shopping list from the app
   - Check that other members receive notification

2. **Expense Added:**
   - Add a new expense from the app
   - Check that other members receive notification

3. **Cleaning Completed:**
   - Complete a cleaning round
   - Check that other members receive notification

4. **Scheduled Reminders:**
   - Wait for scheduled time (9:00 AM / 10:00 AM Israel Time)
   - Or manually trigger from Firebase Console

## 📊 Monitoring

### Firebase Console

1. **View Function Logs:**
   - Go to: https://console.firebase.google.com/project/roomies-hub/functions
   - Click on any function to see execution logs

2. **Check Usage:**
   - Go to: https://console.firebase.google.com/project/roomies-hub/usage
   - Monitor invocations, compute time, and costs

3. **View Errors:**
   - Functions tab shows failed executions
   - Click on any function to see error details

### Common Issues

**Users Not Receiving Notifications:**
1. Check if FCM token is saved in Firestore (`users/{userId}/fcm_token`)
2. Check if user has notification permissions enabled
3. Check Firebase Functions logs for errors
4. Verify APNs key is correctly configured

**Invalid FCM Tokens:**
- Functions automatically clean up invalid tokens
- Users need to re-enable notifications in app settings

**Scheduled Functions Not Running:**
- Check Firebase Functions logs at scheduled time
- Verify timezone is set correctly (Asia/Jerusalem)
- Make sure Firebase project is on Blaze plan

## 💰 Cost Estimation

With the free tier:
- **2,000,000** function invocations/month (free)
- **400,000** GB-seconds compute time (free)
- **200,000** CPU-seconds (free)

For a small apartment (4-5 users):
- ~50-100 notifications per day
- ~1,500-3,000 invocations per month
- **Expected cost: $0** (well within free tier)

Even with heavy usage:
- 10,000 invocations/month = **~$0.40/month**
- 50,000 invocations/month = **~$2.00/month**

## 🔐 Security

**Firestore Security Rules:**
- Only authenticated users can trigger functions
- Users can only access data from their own apartment
- FCM tokens are stored securely in Firestore
- Invalid tokens are automatically cleaned up

**APNs Key:**
- Stored in project root: `AuthKey_J8HLT8N895.p8`
- Added to `.gitignore` with exception for this specific file
- ⚠️ Keep repository private!

## 📝 Customization

### Add New Notification Trigger

1. Create new function in `/functions/src/index.ts`:

```typescript
export const onYourEvent = functions.firestore
  .document('your_collection/{docId}')
  .onCreate(async (snapshot, context) => {
    const data = snapshot.data();
    await sendNotificationToApartment(
      data.apartment_id,
      'Your Title',
      'Your message',
      { type: 'your_event' }
    );
  });
```

2. Build and deploy:
```bash
cd functions && npm run build
firebase deploy --only functions
```

### Customize Notification Content

Edit the notification title/body in each function:

```typescript
await sendNotificationToApartment(
  apartmentId,
  'Your Custom Title',  // Edit this
  'Your custom message',  // Edit this
  { type: 'custom_type' }
);
```

### Change Schedule Time

Edit the cron expression:

```typescript
// Current: Daily at 9:00 AM
export const checkCleaningReminders = functions.pubsub
  .schedule('0 9 * * *')  // Change this (cron format)
  .timeZone('Asia/Jerusalem')
  .onRun(async (context) => {
    // ...
  });
```

Cron format: `minute hour day month dayOfWeek`
- `0 9 * * *` = 9:00 AM daily
- `0 18 * * 5` = 6:00 PM every Friday
- `0 */6 * * *` = Every 6 hours

## 📚 Resources

- [Firebase Cloud Functions Documentation](https://firebase.google.com/docs/functions)
- [Firebase Cloud Messaging Documentation](https://firebase.google.com/docs/cloud-messaging)
- [Firestore Triggers Documentation](https://firebase.google.com/docs/functions/firestore-events)
- [Scheduled Functions Documentation](https://firebase.google.com/docs/functions/schedule-functions)

## 🎉 Summary

Your notification system is now complete and ready to deploy! 

✅ All event-based notifications implemented
✅ Daily scheduled reminders configured
✅ FCM properly integrated with iOS APNs
✅ Automatic token cleanup for invalid devices
✅ Comprehensive error handling and logging

**Next Steps:**
1. Upgrade Firebase project to Blaze plan (with spending limit)
2. Deploy functions: `firebase deploy --only functions --token "YOUR_TOKEN"`
3. Test notifications by using the app
4. Monitor usage in Firebase Console

**Questions or Issues?**
- Check Firebase Functions logs for errors
- Verify FCM tokens are saved in Firestore
- Ensure APNs key is properly configured
- Contact Firebase support if needed

Happy notifying! 🔔

