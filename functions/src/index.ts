/**
 * Firebase Cloud Functions for Roomies App
 * Handles push notifications via Firebase Cloud Messaging (FCM)
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin
admin.initializeApp();

/**
 * Send test notification to the current user
 * Callable function that sends a test FCM notification
 */
export const sendTestNotificationV1 = functions.https.onCall(async (data, context) => {
  // Check if user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated to send test notifications'
    );
  }

  const userId = context.auth.uid;
  console.log(`📨 Sending test notification to user: ${userId}`);

  try {
    // Get user document from Firestore to retrieve FCM token
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'User document not found');
    }

    const userData = userDoc.data();
    const fcmToken = userData?.fcm_token;

    if (!fcmToken) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'No FCM token found for user. Please enable notifications in app settings.'
      );
    }

    console.log(`📱 Found FCM token for user ${userId}: ${fcmToken.substring(0, 20)}...`);

    // Prepare notification message
    const message: admin.messaging.Message = {
      token: fcmToken,
      notification: {
        title: data.title || '🧪 Test Notification',
        body: data.body || 'This is a test notification from Firebase Cloud Functions!',
      },
      data: {
        type: 'test',
        timestamp: new Date().toISOString(),
      },
      // iOS specific settings
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
      // Android specific settings
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'default',
        },
      },
    };

    // Send the notification
    const response = await admin.messaging().send(message);
    console.log(`✅ Successfully sent notification to user ${userId}:`, response);

    return {
      success: true,
      messageId: response,
      message: 'Notification sent successfully',
    };
  } catch (error: any) {
    console.error(`❌ Error sending notification to user ${userId}:`, error);
    
    if (error.code === 'messaging/invalid-registration-token' ||
        error.code === 'messaging/registration-token-not-registered') {
      // Token is invalid, remove it from user document
      await admin.firestore().collection('users').doc(userId).update({
        fcm_token: admin.firestore.FieldValue.delete(),
      });
      throw new functions.https.HttpsError(
        'failed-precondition',
        'FCM token is invalid or expired. Please re-enable notifications in app settings.'
      );
    }

    throw new functions.https.HttpsError('internal', error.message || 'Failed to send notification');
  }
});

/**
 * Send notification to a specific user by user ID
 * Can be called from other cloud functions or triggers
 */
export const sendNotificationToUser = functions.https.onCall(async (data, context) => {
  // Check if user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { targetUserId, title, body, notificationData } = data;

  if (!targetUserId || !title || !body) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'targetUserId, title, and body are required'
    );
  }

  console.log(`📨 Sending notification to user: ${targetUserId}`);

  try {
    // Get target user document
    const userDoc = await admin.firestore().collection('users').doc(targetUserId).get();
    
    if (!userDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Target user not found');
    }

    const userData = userDoc.data();
    const fcmToken = userData?.fcm_token;

    if (!fcmToken) {
      console.log(`⚠️ No FCM token for user ${targetUserId}, skipping notification`);
      return {
        success: false,
        message: 'User has no FCM token',
      };
    }

    // Prepare notification message
    const message: admin.messaging.Message = {
      token: fcmToken,
      notification: {
        title,
        body,
      },
      data: notificationData || {},
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'default',
        },
      },
    };

    // Send the notification
    const response = await admin.messaging().send(message);
    console.log(`✅ Successfully sent notification to user ${targetUserId}:`, response);

    return {
      success: true,
      messageId: response,
    };
  } catch (error: any) {
    console.error(`❌ Error sending notification to user ${targetUserId}:`, error);
    
    if (error.code === 'messaging/invalid-registration-token' ||
        error.code === 'messaging/registration-token-not-registered') {
      // Token is invalid, remove it
      await admin.firestore().collection('users').doc(targetUserId).update({
        fcm_token: admin.firestore.FieldValue.delete(),
      });
    }

    throw new functions.https.HttpsError('internal', error.message || 'Failed to send notification');
  }
});

/**
 * Send notification to multiple users
 * Useful for apartment-wide notifications
 */
export const sendNotificationToMultipleUsers = functions.https.onCall(async (data, context) => {
  // Check if user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { userIds, title, body, notificationData } = data;

  if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
    throw new functions.https.HttpsError('invalid-argument', 'userIds array is required');
  }

  if (!title || !body) {
    throw new functions.https.HttpsError('invalid-argument', 'title and body are required');
  }

  console.log(`📨 Sending notification to ${userIds.length} users`);

  const results = {
    success: 0,
    failed: 0,
    noToken: 0,
  };

  // Send notifications to all users
  for (const userId of userIds) {
    try {
      const userDoc = await admin.firestore().collection('users').doc(userId).get();
      
      if (!userDoc.exists) {
        results.failed++;
        continue;
      }

      const userData = userDoc.data();
      const fcmToken = userData?.fcm_token;

      if (!fcmToken) {
        results.noToken++;
        continue;
      }

      const message: admin.messaging.Message = {
        token: fcmToken,
        notification: {
          title,
          body,
        },
        data: notificationData || {},
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1,
            },
          },
        },
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channelId: 'default',
          },
        },
      };

      await admin.messaging().send(message);
      results.success++;
      console.log(`✅ Sent notification to user ${userId}`);
    } catch (error: any) {
      console.error(`❌ Failed to send notification to user ${userId}:`, error);
      results.failed++;
      
      // Clean up invalid tokens
      if (error.code === 'messaging/invalid-registration-token' ||
          error.code === 'messaging/registration-token-not-registered') {
        await admin.firestore().collection('users').doc(userId).update({
          fcm_token: admin.firestore.FieldValue.delete(),
        });
      }
    }
  }

  console.log(`📊 Notification results:`, results);

  return {
    success: true,
    results,
  };
});

