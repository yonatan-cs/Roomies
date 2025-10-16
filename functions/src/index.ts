/**
 * Firebase Cloud Functions for Roomies App
 * Handles push notifications via Firebase Cloud Messaging (FCM)
 */

import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin
admin.initializeApp();

// ===== NOTIFICATION TRANSLATIONS =====

interface NotificationText {
  title: string;
  body: string;
}

type NotificationType = 
  | 'shopping_item_added'
  | 'shopping_item_purchased'
  | 'expense_added'
  | 'member_joined'
  | 'cleaning_completed'
  | 'cleaning_task_added'
  | 'cleaning_reminder'
  | 'purchase_followup'
  | 'checklist_item_completed';

// Notification translations for Hebrew and English
const notificationTranslations: Record<NotificationType, {
  en: (vars: Record<string, string>) => NotificationText;
  he: (vars: Record<string, string>) => NotificationText;
}> = {
  shopping_item_added: {
    en: ({ userName, itemName }) => ({
      title: '🛒 New Shopping Item',
      body: `${userName} added "${itemName}" to the shopping list`
    }),
    he: ({ userName, itemName }) => ({
      title: '🛒 פריט קניות חדש',
      body: `${userName} הוסיף/ה "${itemName}" לרשימת הקניות`
    })
  },
  shopping_item_purchased: {
    en: ({ userName, itemName }) => ({
      title: '✅ Item Purchased',
      body: `${userName} bought "${itemName}"`
    }),
    he: ({ userName, itemName }) => ({
      title: '✅ פריט נרכש',
      body: `${userName} קנה/תה את "${itemName}"`
    })
  },
  expense_added: {
    en: ({ userName, title, amount }) => ({
      title: '💰 New Expense Added',
      body: `${userName} added ${title} - ₪${amount}`
    }),
    he: ({ userName, title, amount }) => ({
      title: '💰 הוצאה חדשה נוספה',
      body: `${userName} הוסיף/ה ${title} - ₪${amount}`
    })
  },
  member_joined: {
    en: ({ userName }) => ({
      title: '👋 New Roommate!',
      body: `${userName} joined the apartment`
    }),
    he: ({ userName }) => ({
      title: '👋 שותף/ה חדש/ה!',
      body: `${userName} הצטרף/ה לדירה`
    })
  },
  cleaning_completed: {
    en: ({ userName }) => ({
      title: '🧹 Cleaning Completed!',
      body: `${userName} finished cleaning the apartment`
    }),
    he: ({ userName }) => ({
      title: '🧹 ניקיון הושלם!',
      body: `${userName} סיים/ה לנקות את הדירה`
    })
  },
  cleaning_task_added: {
    en: ({ taskTitle }) => ({
      title: '📝 New Cleaning Task',
      body: `"${taskTitle}" was added to the cleaning checklist`
    }),
    he: ({ taskTitle }) => ({
      title: '📝 משימת ניקיון חדשה',
      body: `"${taskTitle}" נוסף/ה לרשימת הניקיון`
    })
  },
  cleaning_reminder: {
    en: ({ daysLeft }) => ({
      title: '🧹 Cleaning Reminder',
      body: `You have ${daysLeft} days left to clean the apartment. Please remember to complete your cleaning turn!`
    }),
    he: ({ daysLeft }) => ({
      title: '🧹 תזכורת ניקיון',
      body: `נשארו לך ${daysLeft} ימים לנקות את הדירה. אנא זכור/י להשלים את תור הניקיון שלך!`
    })
  },
  purchase_followup: {
    en: ({ itemName }) => ({
      title: '💰 Don\'t forget to add expense!',
      body: `You bought "${itemName}" yesterday. Remember to add it to expenses!`
    }),
    he: ({ itemName }) => ({
      title: '💰 אל תשכח/י להוסיף הוצאה!',
      body: `קנית "${itemName}" אתמול. זכור/י להוסיף את זה להוצאות!`
    })
  },
  checklist_item_completed: {
    en: ({ userName, itemTitle }) => ({
      title: '✅ Cleaning Task Completed',
      body: `${userName} marked "${itemTitle}" as completed`
    }),
    he: ({ userName, itemTitle }) => ({
      title: '✅ משימת ניקיון הושלמה',
      body: `${userName} סימן/ה "${itemTitle}" כהושלם`
    })
  }
};

/**
 * Get notification text in user's preferred language
 */
function getNotificationText(
  type: NotificationType,
  locale: string,
  variables: Record<string, string>
): NotificationText {
  const lang = (locale === 'he' || locale === 'iw') ? 'he' : 'en';
  const translator = notificationTranslations[type];
  return translator[lang](variables);
}

// ===== HELPER FUNCTIONS =====

/**
 * Send notification to all members of an apartment with localized text
 * @param apartmentId - The apartment ID
 * @param notificationType - Type of notification for translation
 * @param variables - Variables to interpolate in notification text
 * @param data - Additional data payload
 * @param excludeUserId - Optional user ID to exclude from notifications (e.g., the user who triggered the action)
 */
async function sendNotificationToApartment(
  apartmentId: string,
  notificationType: NotificationType,
  variables: Record<string, string>,
  data: { [key: string]: string } = {},
  excludeUserId?: string
): Promise<void> {
  try {
    console.log(`📨 Sending notification to apartment ${apartmentId}`);

    // Get apartment members
    const apartmentDoc = await admin.firestore().collection('apartments').doc(apartmentId).get();
    
    if (!apartmentDoc.exists) {
      console.log(`⚠️ Apartment ${apartmentId} not found`);
      return;
    }

    const apartmentData = apartmentDoc.data();
    const members = apartmentData?.members || [];
    
    if (members.length === 0) {
      console.log(`⚠️ No members in apartment ${apartmentId}`);
      return;
    }

    // Filter out the excluded user
    const targetMembers = excludeUserId 
      ? members.filter((uid: string) => uid !== excludeUserId)
      : members;

    if (targetMembers.length === 0) {
      console.log(`⚠️ No target members after exclusion`);
      return;
    }

    console.log(`📱 Sending to ${targetMembers.length} members`);

    // Get user documents for all members
    const userDocs = await Promise.all(
      targetMembers.map((uid: string) => admin.firestore().collection('users').doc(uid).get())
    );

    // Group users by language and collect their tokens
    const usersByLanguage: Map<string, { token: string; userId: string }[]> = new Map();
    
    for (const userDoc of userDocs) {
      if (userDoc.exists) {
        const userData = userDoc.data();
        const fcmToken = userData?.fcm_token;
        const locale = userData?.locale || 'en'; // Default to English if no preference
        
        if (fcmToken) {
          if (!usersByLanguage.has(locale)) {
            usersByLanguage.set(locale, []);
          }
          usersByLanguage.get(locale)!.push({ token: fcmToken, userId: userDoc.id });
        }
      }
    }

    if (usersByLanguage.size === 0) {
      console.log(`⚠️ No valid FCM tokens found`);
      return;
    }

    let totalSent = 0;
    let totalFailed = 0;

    // Send notifications to each language group
    for (const [locale, users] of usersByLanguage.entries()) {
      const tokens = users.map(u => u.token);
      const notificationText = getNotificationText(notificationType, locale, variables);

      console.log(`📤 Sending to ${tokens.length} users in ${locale}`);

      // Prepare notification message for this language group
      const message: admin.messaging.MulticastMessage = {
        tokens,
        notification: {
          title: notificationText.title,
          body: notificationText.body,
        },
        data: {
          ...data,
          timestamp: new Date().toISOString(),
        },
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

      // Send to this language group
      const response = await admin.messaging().sendEachForMulticast(message);
      totalSent += response.successCount;
      totalFailed += response.failureCount;
      
      console.log(`✅ Sent ${response.successCount} notifications in ${locale}, ${response.failureCount} failures`);

      // Clean up invalid tokens
      if (response.failureCount > 0) {
        const invalidUserIds: string[] = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success && resp.error) {
            const errorCode = resp.error.code;
            if (errorCode === 'messaging/invalid-registration-token' || 
                errorCode === 'messaging/registration-token-not-registered') {
              invalidUserIds.push(users[idx].userId);
            }
          }
        });

        // Remove invalid tokens from users
        for (const userId of invalidUserIds) {
          await admin.firestore().collection('users').doc(userId).update({
            fcm_token: admin.firestore.FieldValue.delete(),
          });
        }
      }
    }

    console.log(`✅ Total: ${totalSent} notifications sent, ${totalFailed} failed`);
  } catch (error) {
    console.error('❌ Error sending notification to apartment:', error);
  }
}

/**
 * Send notification to a specific user in their preferred language
 * @param userId - The user ID
 * @param notificationType - Type of notification for translation
 * @param variables - Variables to interpolate in notification text
 * @param data - Additional data payload
 */
async function sendNotificationToUser(
  userId: string,
  notificationType: NotificationType,
  variables: Record<string, string>,
  data: { [key: string]: string } = {}
): Promise<void> {
  try {
    console.log(`📨 Sending notification to user ${userId}`);

    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      console.log(`⚠️ User ${userId} not found`);
      return;
    }

    const userData = userDoc.data();
    const fcmToken = userData?.fcm_token;
    const locale = userData?.locale || 'en'; // Default to English if no preference

    if (!fcmToken) {
      console.log(`⚠️ No FCM token for user ${userId}`);
      return;
    }

    // Get localized notification text
    const notificationText = getNotificationText(notificationType, locale, variables);

    const message: admin.messaging.Message = {
      token: fcmToken,
      notification: {
        title: notificationText.title,
        body: notificationText.body,
      },
      data: {
        ...data,
        timestamp: new Date().toISOString(),
      },
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
    console.log(`✅ Successfully sent notification to user ${userId} in ${locale}`);
  } catch (error: any) {
    console.error(`❌ Error sending notification to user ${userId}:`, error);
    
    // Clean up invalid token
    if (error.code === 'messaging/invalid-registration-token' ||
        error.code === 'messaging/registration-token-not-registered') {
      await admin.firestore().collection('users').doc(userId).update({
        fcm_token: admin.firestore.FieldValue.delete(),
      });
    }
  }
}

/**
 * Get user display name
 */
async function getUserDisplayName(userId: string): Promise<string> {
  try {
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    if (userDoc.exists) {
      const userData = userDoc.data();
      return userData?.display_name || userData?.email || 'Someone';
    }
  } catch (error) {
    console.error('Error getting user display name:', error);
  }
  return 'Someone';
}

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
 * Callable function that can be invoked from the app
 */
export const sendNotificationToUserCallable = functions.https.onCall(async (data, context) => {
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

// ===== FIRESTORE TRIGGERS =====

/**
 * Trigger: Shopping item added
 * Sends notification when someone adds a new item to the shopping list
 */
export const onShoppingItemAdded = functions.firestore
  .document('shopping_items/{itemId}')
  .onCreate(async (snapshot, context) => {
    try {
      const itemData = snapshot.data();
      const apartmentId = itemData.apartment_id;
      const addedByUserId = itemData.added_by_user_id;
      const itemName = itemData.title || itemData.name || 'item';

      if (!apartmentId || !addedByUserId) {
        console.log('⚠️ Missing apartment_id or added_by_user_id');
        return;
      }

      const userName = await getUserDisplayName(addedByUserId);

      await sendNotificationToApartment(
        apartmentId,
        'shopping_item_added',
        { userName, itemName },
        {
          type: 'shopping_item_added',
          itemId: context.params.itemId,
          itemName,
          addedBy: addedByUserId,
        },
        addedByUserId // Don't notify the person who added it
      );

      console.log(`✅ Sent shopping item notification for ${itemName}`);
    } catch (error) {
      console.error('❌ Error in onShoppingItemAdded:', error);
    }
  });

/**
 * Trigger: Shopping item purchased
 * Sends notification when someone marks an item as purchased
 */
export const onShoppingItemPurchased = functions.firestore
  .document('shopping_items/{itemId}')
  .onUpdate(async (change, context) => {
    try {
      const before = change.before.data();
      const after = change.after.data();

      // Check if item was just marked as purchased
      if (!before.purchased && after.purchased) {
        const apartmentId = after.apartment_id;
        const purchasedByUserId = after.purchased_by_user_id;
        const itemName = after.title || after.name || 'item';

        if (!apartmentId || !purchasedByUserId) {
          console.log('⚠️ Missing apartment_id or purchased_by_user_id');
          return;
        }

        const userName = await getUserDisplayName(purchasedByUserId);

        await sendNotificationToApartment(
          apartmentId,
          'shopping_item_purchased',
          { userName, itemName },
          {
            type: 'shopping_item_purchased',
            itemId: context.params.itemId,
            itemName,
            purchasedBy: purchasedByUserId,
          },
          purchasedByUserId // Don't notify the person who purchased it
        );

        console.log(`✅ Sent purchase notification for ${itemName}`);
      }
    } catch (error) {
      console.error('❌ Error in onShoppingItemPurchased:', error);
    }
  });

/**
 * Trigger: Expense added
 * Sends notification when someone adds a new expense
 */
export const onExpenseAdded = functions.firestore
  .document('expenses/{expenseId}')
  .onCreate(async (snapshot, context) => {
    try {
      const expenseData = snapshot.data();
      const apartmentId = expenseData.apartment_id;
      const paidByUserId = expenseData.paid_by_user_id;
      const amount = expenseData.amount || 0;
      const title = expenseData.title || 'expense';
      const category = expenseData.category || 'other';

      if (!apartmentId || !paidByUserId) {
        console.log('⚠️ Missing apartment_id or paid_by_user_id');
        return;
      }

      const userName = await getUserDisplayName(paidByUserId);

      await sendNotificationToApartment(
        apartmentId,
        'expense_added',
        { userName, title, amount: amount.toFixed(2) },
        {
          type: 'expense_added',
          expenseId: context.params.expenseId,
          amount: amount.toString(),
          category,
          paidBy: paidByUserId,
        },
        paidByUserId // Don't notify the person who added it
      );

      console.log(`✅ Sent expense notification for ${title}`);
    } catch (error) {
      console.error('❌ Error in onExpenseAdded:', error);
    }
  });

/**
 * Trigger: New member joined apartment
 * Sends notification when someone joins the apartment
 */
export const onApartmentMemberAdded = functions.firestore
  .document('apartments/{apartmentId}')
  .onUpdate(async (change, context) => {
    try {
      const before = change.before.data();
      const after = change.after.data();

      const beforeMembers = before.members || [];
      const afterMembers = after.members || [];

      // Find new members
      const newMembers = afterMembers.filter(
        (uid: string) => !beforeMembers.includes(uid)
      );

      if (newMembers.length === 0) {
        return;
      }

      const apartmentId = context.params.apartmentId;

      // Send notification for each new member
      for (const newMemberId of newMembers) {
        const userName = await getUserDisplayName(newMemberId);

        await sendNotificationToApartment(
          apartmentId,
          'member_joined',
          { userName },
          {
            type: 'member_joined',
            newMemberId,
          },
          newMemberId // Don't notify the new member
        );

        console.log(`✅ Sent member joined notification for ${userName}`);
      }
    } catch (error) {
      console.error('❌ Error in onApartmentMemberAdded:', error);
    }
  });

/**
 * Trigger: Cleaning round completed
 * Sends notification when someone completes their cleaning turn
 */
export const onCleaningCompleted = functions.firestore
  .document('cleaningTasks/{apartmentId}')
  .onUpdate(async (change, context) => {
    try {
      const before = change.before.data();
      const after = change.after.data();

      // Check if cleaning was just completed
      const beforeCompleted = before.last_completed_at;
      const afterCompleted = after.last_completed_at;

      if (beforeCompleted !== afterCompleted && afterCompleted) {
        const apartmentId = context.params.apartmentId;
        const completedByUserId = after.last_completed_by;

        if (!completedByUserId) {
          console.log('⚠️ Missing last_completed_by');
          return;
        }

        const userName = await getUserDisplayName(completedByUserId);

        await sendNotificationToApartment(
          apartmentId,
          'cleaning_completed',
          { userName },
          {
            type: 'cleaning_completed',
            completedBy: completedByUserId,
          },
          completedByUserId // Don't notify the person who completed it
        );

        console.log(`✅ Sent cleaning completed notification`);
      }
    } catch (error) {
      console.error('❌ Error in onCleaningCompleted:', error);
    }
  });

/**
 * Trigger: Cleaning checklist item added
 * Sends notification when someone adds a new cleaning task to the checklist
 */
export const onCleaningChecklistItemAdded = functions.firestore
  .document('cleaning_checklist_items/{itemId}')
  .onCreate(async (snapshot, context) => {
    try {
      const itemData = snapshot.data();
      const apartmentId = itemData.apartment_id;
      const taskTitle = itemData.title || 'cleaning task';

      if (!apartmentId) {
        console.log('⚠️ Missing apartment_id');
        return;
      }

      await sendNotificationToApartment(
        apartmentId,
        'cleaning_task_added',
        { taskTitle },
        {
          type: 'cleaning_task_added',
          itemId: context.params.itemId,
          taskTitle,
        }
      );

      console.log(`✅ Sent cleaning task added notification for ${taskTitle}`);
    } catch (error) {
      console.error('❌ Error in onCleaningChecklistItemAdded:', error);
    }
  });

/**
 * Trigger: Checklist item updated (Legacy schema)
 * Path: cleaningTasks/{taskId}/checklistItems/{itemId}
 * Sends notification when checklist item is completed
 */
export const onChecklistItemUpdated = functions.firestore
  .document('cleaningTasks/{taskId}/checklistItems/{itemId}')
  .onUpdate(async (change, context) => {
    try {
      const before = change.before.data();
      const after = change.after.data();
      const apartmentId = after.apartment_id;
      
      if (!apartmentId) {
        console.log('⚠️ Missing apartment_id in checklist item');
        return;
      }
      
      // Only notify if item was completed
      if (!before.completed && after.completed) {
        const completedBy = after.completed_by;
        const itemTitle = after.title || 'משימה';
        
        if (completedBy) {
          const userName = await getUserDisplayName(completedBy);
          
          await sendNotificationToApartment(
            apartmentId,
            'checklist_item_completed',
            { userName, itemTitle },
            { 
              type: 'checklist_update',
              itemId: context.params.itemId,
              taskId: context.params.taskId
            },
            completedBy // Exclude the user who completed it
          );
          
          console.log(`✅ Sent checklist item completed notification for "${itemTitle}" by ${userName}`);
        }
      }
    } catch (error) {
      console.error('❌ Error in onChecklistItemUpdated:', error);
    }
  });

/**
 * Trigger: Checklist item updated (New schema)
 * Path: apartments/{apartmentId}/tasks/{taskId}/checklistItems/{itemId}
 * Sends notification when checklist item is completed
 */
export const onChecklistItemUpdatedV2 = functions.firestore
  .document('apartments/{apartmentId}/tasks/{taskId}/checklistItems/{itemId}')
  .onUpdate(async (change, context) => {
    try {
      const before = change.before.data();
      const after = change.after.data();
      const apartmentId = context.params.apartmentId;
      
      if (!apartmentId) {
        console.log('⚠️ Missing apartmentId in context');
        return;
      }
      
      // Only notify if item was completed
      if (!before.completed && after.completed) {
        const completedBy = after.completed_by;
        const itemTitle = after.title || 'משימה';
        
        if (completedBy) {
          const userName = await getUserDisplayName(completedBy);
          
          await sendNotificationToApartment(
            apartmentId,
            'checklist_item_completed',
            { userName, itemTitle },
            { 
              type: 'checklist_update',
              itemId: context.params.itemId,
              taskId: context.params.taskId
            },
            completedBy
          );
          
          console.log(`✅ Sent checklist item completed notification (v2) for "${itemTitle}" by ${userName}`);
        }
      }
    } catch (error) {
      console.error('❌ Error in onChecklistItemUpdatedV2:', error);
    }
  });

// ===== SCHEDULED FUNCTIONS =====

/**
 * Scheduled: Check for upcoming cleaning turns
 * Runs daily at 9:00 AM (Israel Time = UTC+2/3)
 * Sends reminder 2 days before the cleaning turn is due
 */
export const checkCleaningReminders = functions.pubsub
  .schedule('0 9 * * *')
  .timeZone('Asia/Jerusalem')
  .onRun(async (context) => {
    try {
      console.log('🔔 Running cleaning reminders check...');

      const now = new Date();
      const cleaningTasksSnapshot = await admin.firestore()
        .collection('cleaningTasks')
        .get();

      let remindersCount = 0;

      for (const doc of cleaningTasksSnapshot.docs) {
        const taskData = doc.data();
        const apartmentId = doc.id;
        const currentUserId = taskData.user_id;
        const assignedAt = taskData.assigned_at;
        const frequencyDays = taskData.frequency_days || 7;
        const lastCompletedAt = taskData.last_completed_at;

        if (!currentUserId) {
          continue;
        }

        // Calculate when cleaning is due
        const referenceDate = lastCompletedAt 
          ? new Date(lastCompletedAt) 
          : assignedAt 
            ? new Date(assignedAt) 
            : null;

        if (!referenceDate) {
          continue;
        }

        const dueDate = new Date(referenceDate);
        dueDate.setDate(dueDate.getDate() + frequencyDays);

        // Calculate days until due date
        const daysUntilDue = Math.floor((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        // Send reminder 2 days before due date
        if (daysUntilDue === 2) {
          const userName = await getUserDisplayName(currentUserId);

          await sendNotificationToUser(
            currentUserId,
            'cleaning_reminder',
            { daysLeft: '2' },
            {
              type: 'cleaning_reminder',
              apartmentId,
              daysUntilDue: '2',
            }
          );

          remindersCount++;
          console.log(`✅ Sent cleaning reminder to ${userName} (apartment ${apartmentId}) - 2 days before due`);
        }
      }

      console.log(`✅ Sent ${remindersCount} cleaning reminders`);
    } catch (error) {
      console.error('❌ Error in checkCleaningReminders:', error);
    }
  });

/**
 * Scheduled: Follow-up on purchased items not added to expenses
 * Runs daily at 10:00 AM (Israel Time)
 * Reminds users who purchased items but didn't add them to expenses after 24 hours
 */
export const checkPurchaseFollowUps = functions.pubsub
  .schedule('0 10 * * *')
  .timeZone('Asia/Jerusalem')
  .onRun(async (context) => {
    try {
      console.log('🔔 Running purchase follow-up check...');

      const now = new Date();
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);

      // Get all purchased items from yesterday that have a price but no expense created
      const shoppingItemsSnapshot = await admin.firestore()
        .collection('shopping_items')
        .where('purchased', '==', true)
        .where('purchased_at', '>=', yesterday.toISOString())
        .where('purchased_at', '<', now.toISOString())
        .get();

      let remindersCount = 0;

      for (const doc of shoppingItemsSnapshot.docs) {
        const itemData = doc.data();
        const purchasedByUserId = itemData.purchased_by_user_id;
        const itemName = itemData.title || itemData.name || 'item';
        const price = itemData.price;
        const purchasedAt = itemData.purchased_at ? new Date(itemData.purchased_at) : null;

        // Skip if no user or no price
        if (!purchasedByUserId || !price) {
          continue;
        }

        // Check if it's been 24+ hours
        if (purchasedAt) {
          const hoursSincePurchase = (now.getTime() - purchasedAt.getTime()) / (1000 * 60 * 60);
          
          if (hoursSincePurchase >= 24) {
            await sendNotificationToUser(
              purchasedByUserId,
              'purchase_followup',
              { itemName },
              {
                type: 'purchase_followup',
                itemId: doc.id,
                itemName,
                price: price.toString(),
              }
            );

            remindersCount++;
            console.log(`✅ Sent follow-up reminder for ${itemName} to ${purchasedByUserId}`);
          }
        }
      }

      console.log(`✅ Sent ${remindersCount} purchase follow-up reminders`);
    } catch (error) {
      console.error('❌ Error in checkPurchaseFollowUps:', error);
    }
  });

