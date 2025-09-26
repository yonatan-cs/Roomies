import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

// Initialize Firebase Admin SDK with service account
admin.initializeApp({
  credential: admin.credential.cert(require('../service-account-key.json')),
});

// Helper: Send Firebase V1 FCM notification
export async function sendFirebaseV1Notification(
  userId: string, 
  title: string, 
  body: string, 
  data?: any
): Promise<void> {
  try {
    console.log(`🚀 Sending Firebase V1 notification to user: ${userId}`);
    
    // Get user's FCM token
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    if (!userDoc.exists) {
      console.log(`❌ User ${userId} not found`);
      return;
    }

    const userData = userDoc.data();
    const fcmToken = userData?.fcm_token;

    if (!fcmToken) {
      console.log(`❌ No FCM token for user ${userId}`);
      return;
    }

    console.log(`📱 FCM Token found: ${fcmToken.substring(0, 20)}...`);

    // Send notification using Firebase Admin SDK V1 API
    const message = {
      token: fcmToken,
      notification: {
        title,
        body,
      },
      data: data || {},
      android: {
        notification: {
          sound: 'default',
          channelId: 'default',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
    };

    const response = await admin.messaging().send(message);
    console.log(`✅ Firebase V1 FCM notification sent to user ${userId}:`, response);
  } catch (error) {
    console.error(`❌ Error sending Firebase V1 FCM notification to user ${userId}:`, error);
    throw error;
  }
}

// Helper: Notify all apartment members using Firebase V1
export async function notifyApartmentMembersV1(
  apartmentId: string, 
  excludeUserId: string, 
  title: string, 
  body: string, 
  data?: any
): Promise<void> {
  try {
    console.log(`🏠 Notifying apartment ${apartmentId} members (excluding ${excludeUserId})`);
    
    // Get all users in the apartment
    const usersSnapshot = await admin.firestore()
      .collection('users')
      .where('apartment_id', '==', apartmentId)
      .get();

    const notificationPromises = usersSnapshot.docs
      .filter(doc => doc.id !== excludeUserId) // Exclude the user who triggered the action
      .map(doc => sendFirebaseV1Notification(doc.id, title, body, data));

    await Promise.all(notificationPromises);
    console.log(`✅ Notified ${notificationPromises.length} apartment members`);
  } catch (error) {
    console.error(`❌ Error notifying apartment members:`, error);
    throw error;
  }
}

// Test function using Firebase V1 API
export const sendTestNotificationV1 = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const userId = context.auth.uid;
  const { title = '🧪 Firebase V1 Test', body = 'This is a Firebase V1 notification!' } = data;

  try {
    await sendFirebaseV1Notification(userId, title, body, {
      screen: 'Dashboard',
      test: true,
      api_version: 'v1',
      timestamp: new Date().toISOString()
    });

    return { success: true, message: 'Firebase V1 test notification sent' };
  } catch (error) {
    console.error('Error sending Firebase V1 test notification:', error);
    throw new functions.https.HttpsError('internal', 'Failed to send Firebase V1 test notification');
  }
});
