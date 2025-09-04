import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK
admin.initializeApp();

const db = admin.firestore();

// Helper: validate input for debt settlement
function validateSettlementInput(body: any) {
  if (!body) throw new functions.https.HttpsError('invalid-argument', 'Missing body');
  const { aptId, debtId } = body;
  if (!aptId || !debtId) throw new functions.https.HttpsError('invalid-argument', 'Missing aptId or debtId');
  return { aptId, debtId };
}

/**
 * Cloud Function for atomic debt closing
 * This function performs all required operations in a single transaction
 */
export const closeDebt = functions.https.onCall(async (data, context) => {
  // Validate authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { debtId, apartmentId, actorUid } = data;

  // Validate required parameters
  if (!debtId || !apartmentId || !actorUid) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing required parameters: debtId, apartmentId, actorUid');
  }

  // Validate that the actor matches the authenticated user
  if (actorUid !== context.auth.uid) {
    throw new functions.https.HttpsError('permission-denied', 'Actor UID must match authenticated user');
  }

  const logId = `close_debt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  try {
    console.log(`[${logId}] Starting atomic debt closure:`, { debtId, apartmentId, actorUid });

    // Perform all operations in a single transaction
    const result = await db.runTransaction(async (transaction) => {
      // 1. Check membership
      const membershipRef = db.collection('apartmentMembers').doc(`${apartmentId}_${actorUid}`);
      const membershipDoc = await transaction.get(membershipRef);
      
      if (!membershipDoc.exists) {
        throw new functions.https.HttpsError('permission-denied', 'User is not a member of this apartment', { logId });
      }

      // 2. Check debt status
      const debtRef = db.collection('debts').doc(debtId);
      const debtDoc = await transaction.get(debtRef);
      
      if (!debtDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Debt not found', { logId });
      }

      const debtData = debtDoc.data()!;
      
      // Validate apartment ID matches
      if (debtData.apartment_id !== apartmentId) {
        throw new functions.https.HttpsError('permission-denied', 'Debt does not belong to this apartment', { logId });
      }

      // Check if debt is already closed
      if (debtData.status === 'closed') {
        throw new functions.https.HttpsError('already-exists', 'Debt is already closed', { 
          logId,
          closedAt: debtData.closed_at,
          closedBy: debtData.closed_by
        });
      }

      const now = admin.firestore.FieldValue.serverTimestamp();
      const monthKey = new Date().toISOString().substring(0, 7); // YYYY-MM format
      const expenseId = `exp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // 3. Update debt status
      transaction.update(debtRef, {
        status: 'closed',
        closed_at: now,
        closed_by: actorUid,
        cleared_amount: debtData.amount
      });

      // 4. Create monthly expense (hidden settlement expense)
      const monthlyExpenseRef = db
        .collection('apartments')
        .doc(apartmentId)
        .collection('monthlyExpenses')
        .doc(monthKey)
        .collection('expenses')
        .doc(expenseId);

      transaction.set(monthlyExpenseRef, {
        apartment_id: apartmentId,
        amount: debtData.amount * 2, // Double the debt amount for settlement
        title: `סגירת חוב - ${debtData.description || 'חוב'}`,
        paid_by_user_id: debtData.to_user_id, // The creditor receives the payment
        participants: [debtData.from_user_id, debtData.to_user_id], // Both parties participate
        category: 'debt_settlement',
        created_at: now,
        created_by: actorUid,
        linked_debt_id: debtId,
        payer_id: debtData.from_user_id, // The debtor pays
        receiver_id: debtData.to_user_id, // The creditor receives
        description: `סגירת חוב בין ${debtData.from_user_id} ל-${debtData.to_user_id}`,
        meta: {
          source: 'debt_settlement',
          debtId,
          actorUserId: actorUid
        },
        visibleInUI: false // Hidden from regular expense list
      });

      // 5. Update balances using FieldValue.increment
      const fromBalanceRef = db.collection('balances').doc(`${apartmentId}_${debtData.from_user_id}`);
      const toBalanceRef = db.collection('balances').doc(`${apartmentId}_${debtData.to_user_id}`);

      transaction.update(fromBalanceRef, {
        balance: admin.firestore.FieldValue.increment(-debtData.amount),
        apartment_id: apartmentId,
        user_id: debtData.from_user_id
      });

      transaction.update(toBalanceRef, {
        balance: admin.firestore.FieldValue.increment(debtData.amount),
        apartment_id: apartmentId,
        user_id: debtData.to_user_id
      });

      // 6. Create action log
      const actionRef = db.collection('actions').doc();
      transaction.set(actionRef, {
        apartment_id: apartmentId,
        type: 'close_debt',
        debt_id: debtId,
        actor: actorUid,
        amount: debtData.amount,
        from_user_id: debtData.from_user_id,
        to_user_id: debtData.to_user_id,
        created_at: now,
        log_id: logId
      });

      console.log(`[${logId}] Transaction operations prepared successfully`);

      return {
        success: true,
        debtId,
        expenseId,
        closedAt: new Date().toISOString(),
        logId
      };
    });

    console.log(`[${logId}] Transaction completed successfully:`, result);
    return result;

  } catch (error) {
    console.error(`[${logId}] Transaction failed:`, error);
    
    // If it's already an HttpsError, re-throw it
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    
    // Otherwise, wrap it in an HttpsError
    throw new functions.https.HttpsError('internal', 'Internal server error during debt closure', { 
      logId,
      originalError: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * Cloud Function for creating and closing a debt atomically
 * This is for the current system that doesn't have existing debts
 */
export const createAndCloseDebt = functions.https.onCall(async (data, context) => {
  // Validate authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { fromUserId, toUserId, amount, description, apartmentId } = data;

  // Validate required parameters
  if (!fromUserId || !toUserId || !amount || !apartmentId) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing required parameters: fromUserId, toUserId, amount, apartmentId');
  }

  if (amount <= 0) {
    throw new functions.https.HttpsError('invalid-argument', 'Amount must be positive');
  }

  const actorUid = context.auth.uid;
  const logId = `create_close_debt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  try {
    console.log(`[${logId}] Starting debt creation and closure:`, { fromUserId, toUserId, amount, apartmentId, actorUid });

    // Perform all operations in a single transaction
    const result = await db.runTransaction(async (transaction) => {
      // 1. Check membership
      const membershipRef = db.collection('apartmentMembers').doc(`${apartmentId}_${actorUid}`);
      const membershipDoc = await transaction.get(membershipRef);
      
      if (!membershipDoc.exists) {
        throw new functions.https.HttpsError('permission-denied', 'User is not a member of this apartment', { logId });
      }

      const now = admin.firestore.FieldValue.serverTimestamp();
      const debtId = `debt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const monthKey = new Date().toISOString().substring(0, 7); // YYYY-MM format
      const expenseId = `exp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // 2. Create debt document
      const debtRef = db.collection('debts').doc(debtId);
      transaction.set(debtRef, {
        apartment_id: apartmentId,
        from_user_id: fromUserId,
        to_user_id: toUserId,
        amount: amount,
        status: 'open',
        created_at: now,
        description: description || 'חוב שנוצר ונסוגר'
      });

      // 3. Update debt status to closed
      transaction.update(debtRef, {
        status: 'closed',
        closed_at: now,
        closed_by: actorUid,
        cleared_amount: amount
      });

      // 4. Create monthly expense (hidden settlement expense)
      const monthlyExpenseRef = db
        .collection('apartments')
        .doc(apartmentId)
        .collection('monthlyExpenses')
        .doc(monthKey)
        .collection('expenses')
        .doc(expenseId);

      transaction.set(monthlyExpenseRef, {
        apartment_id: apartmentId,
        amount: amount * 2, // Double the debt amount for settlement
        title: `סגירת חוב - ${description || 'חוב'}`,
        paid_by_user_id: toUserId, // The creditor receives the payment
        participants: [fromUserId, toUserId], // Both parties participate
        category: 'debt_settlement',
        created_at: now,
        created_by: actorUid,
        linked_debt_id: debtId,
        payer_id: fromUserId, // The debtor pays
        receiver_id: toUserId, // The creditor receives
        description: `סגירת חוב בין ${fromUserId} ל-${toUserId}`,
        meta: {
          source: 'debt_settlement',
          debtId,
          actorUserId: actorUid
        },
        visibleInUI: false // Hidden from regular expense list
      });

      // 5. Update balances using FieldValue.increment
      const fromBalanceRef = db.collection('balances').doc(`${apartmentId}_${fromUserId}`);
      const toBalanceRef = db.collection('balances').doc(`${apartmentId}_${toUserId}`);

      transaction.update(fromBalanceRef, {
        balance: admin.firestore.FieldValue.increment(-amount),
        apartment_id: apartmentId,
        user_id: fromUserId
      });

      transaction.update(toBalanceRef, {
        balance: admin.firestore.FieldValue.increment(amount),
        apartment_id: apartmentId,
        user_id: toUserId
      });

      // 6. Create action log
      const actionRef = db.collection('actions').doc();
      transaction.set(actionRef, {
        apartment_id: apartmentId,
        type: 'close_debt',
        debt_id: debtId,
        actor: actorUid,
        amount: amount,
        from_user_id: fromUserId,
        to_user_id: toUserId,
        created_at: now,
        log_id: logId
      });

      console.log(`[${logId}] Transaction operations prepared successfully`);

      return {
        success: true,
        debtId,
        expenseId,
        closedAt: new Date().toISOString(),
        logId
      };
    });

    console.log(`[${logId}] Transaction completed successfully:`, result);
    return result;

  } catch (error) {
    console.error(`[${logId}] Transaction failed:`, error);
    
    // If it's already an HttpsError, re-throw it
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    
    // Otherwise, wrap it in an HttpsError
    throw new functions.https.HttpsError('internal', 'Internal server error during debt creation and closure', { 
      logId,
      originalError: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * Callable function: settleDebtByCreatingHiddenExpense
 * Input: { aptId, debtId }
 * Requires: caller authenticated (functions context.auth.uid)
 *
 * Behavior:
 * - runs in a transaction:
 *   - reads debt doc
 *   - verifies exists and not closed
 *   - creates expense doc with amount=2*debt.amountCents, participants [debtor, creditor]
 *   - updates debt with closed=true, closedAt, settlementExpenseId
 *   - writes audit log
 */
export const settleDebtByCreatingHiddenExpense = functions.https.onCall(async (data, context) => {
  // auth check
  if (!context.auth || !context.auth.uid) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }
  const actorUserId = context.auth.uid;

  // validate inputs
  let aptId: string, debtId: string;
  try {
    ({ aptId, debtId } = validateSettlementInput(data));
  } catch (err) {
    throw err;
  }

  const debtRef = db.doc(`apartments/${aptId}/debts/${debtId}`);
  const expensesCol = db.collection(`apartments/${aptId}/monthlyExpenses/${new Date().toISOString().substring(0, 7)}/expenses`);
  const auditCol = db.collection(`apartments/${aptId}/audit_logs`);

  try {
    await db.runTransaction(async (t) => {
      const debtSnap = await t.get(debtRef);
      if (!debtSnap.exists) {
        throw new functions.https.HttpsError('not-found', 'DEBT_NOT_FOUND');
      }

      const debt = debtSnap.data();
      if (!debt) {
        throw new functions.https.HttpsError('not-found', 'DEBT_NOT_FOUND');
      }
      
      if (debt.status === 'closed') {
        throw new functions.https.HttpsError('failed-precondition', 'DEBT_ALREADY_CLOSED');
      }

      const debtorId = debt.from_user_id;
      const creditorId = debt.to_user_id;
      const amountCents = debt.amount;

      if (!debtorId || !creditorId || typeof amountCents !== 'number') {
        throw new functions.https.HttpsError('failed-precondition', 'DEBT_MALFORMED');
      }

      // build expense doc (hidden)
      const expenseRef = expensesCol.doc();
      const expense = {
        apartment_id: aptId,
        amount: amountCents * 2, // Double the debt amount for settlement
        title: `סגירת חוב - ${debt.description || 'חוב'}`,
        paid_by_user_id: creditorId, // The creditor receives the payment
        participants: [debtorId, creditorId], // Both parties participate
        category: 'debt_settlement',
        created_at: admin.firestore.FieldValue.serverTimestamp(),
        created_by: actorUserId,
        linked_debt_id: debtId,
        payer_id: debtorId, // The debtor pays
        receiver_id: creditorId, // The creditor receives
        description: `סגירת חוב בין ${debtorId} ל-${creditorId}`,
        meta: {
          source: 'debt_settlement',
          debtId,
          actorUserId
        },
        visibleInUI: false // Hidden from regular expense list
      };

      // update debt + create expense + audit all in one transaction
      t.update(debtRef, {
        status: 'closed',
        closed_at: admin.firestore.FieldValue.serverTimestamp(),
        closed_by: actorUserId,
        settlement_expense_id: expenseRef.id
      });
      t.set(expenseRef, expense);

      const auditRef = auditCol.doc();
      t.set(auditRef, {
        action: 'settleDebt',
        debtId,
        expenseId: expenseRef.id,
        actorUserId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        details: {
          debtorId,
          creditorId,
          amount: amountCents,
          settlementAmount: amountCents * 2
        }
      });
    });

    return { ok: true };
  } catch (err) {
    console.error('settleDebt error', err);
    if (err instanceof functions.https.HttpsError) throw err;
    throw new functions.https.HttpsError('internal', err instanceof Error ? err.message : 'INTERNAL_ERROR');
  }
});
