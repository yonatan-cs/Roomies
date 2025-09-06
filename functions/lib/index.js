"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recomputeBalancesCallable = exports.onDebtWrite = exports.onApartmentMemberDeleted = exports.settleDebtByCreatingHiddenExpense = exports.createAndCloseDebt = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
// Initialize Firebase Admin SDK
admin.initializeApp();
const db = admin.firestore();
// Helper: validate input for debt settlement
function validateSettlementInput(body) {
    if (!body)
        throw new functions.https.HttpsError('invalid-argument', 'Missing body');
    const { aptId, debtId } = body;
    if (!aptId || !debtId)
        throw new functions.https.HttpsError('invalid-argument', 'Missing aptId or debtId');
    return { aptId, debtId };
}
/**
 * Cloud Function for creating and closing a debt atomically
 * This is for the current system that doesn't have existing debts
 */
exports.createAndCloseDebt = functions.https.onCall(async (data, context) => {
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
                amount: amount * 2,
                title: `סגירת חוב - ${description || 'חוב'}`,
                paid_by_user_id: toUserId,
                participants: [fromUserId, toUserId],
                category: 'debt_settlement',
                created_at: now,
                created_by: actorUid,
                linked_debt_id: debtId,
                payer_id: fromUserId,
                receiver_id: toUserId,
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
    }
    catch (error) {
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
exports.settleDebtByCreatingHiddenExpense = functions.https.onCall(async (data, context) => {
    // auth check
    if (!context.auth || !context.auth.uid) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
    }
    const actorUserId = context.auth.uid;
    // validate inputs
    let aptId, debtId;
    try {
        ({ aptId, debtId } = validateSettlementInput(data));
    }
    catch (err) {
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
                amount: amountCents * 2,
                title: `סגירת חוב - ${debt.description || 'חוב'}`,
                paid_by_user_id: creditorId,
                participants: [debtorId, creditorId],
                category: 'debt_settlement',
                created_at: admin.firestore.FieldValue.serverTimestamp(),
                created_by: actorUserId,
                linked_debt_id: debtId,
                payer_id: debtorId,
                receiver_id: creditorId,
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
    }
    catch (err) {
        console.error('settleDebt error', err);
        if (err instanceof functions.https.HttpsError)
            throw err;
        throw new functions.https.HttpsError('internal', err instanceof Error ? err.message : 'INTERNAL_ERROR');
    }
});
/**
 * Cloud Function: onApartmentMemberDeleted
 * Triggered when an apartmentMembers document is deleted
 * Updates the user's current_apartment_id to null
 */
exports.onApartmentMemberDeleted = functions.firestore
    .document('apartmentMembers/{memberId}')
    .onDelete(async (snap, context) => {
    const memberId = context.params.memberId;
    console.log(`🗑️ Apartment member deleted: ${memberId}`);
    try {
        // Extract user ID from memberId (format: apartmentId_userId)
        const parts = memberId.split('_');
        if (parts.length < 2) {
            console.error('❌ Invalid memberId format:', memberId);
            return;
        }
        const userId = parts.slice(1).join('_'); // In case userId contains underscores
        console.log(`👤 Updating user ${userId} current_apartment_id to null`);
        // Update user's current_apartment_id to null
        await db.collection('users').doc(userId).update({
            current_apartment_id: admin.firestore.FieldValue.delete()
        });
        console.log(`✅ User ${userId} current_apartment_id cleared successfully`);
        // Log the action for audit trail
        await db.collection('actions').add({
            type: 'member_removed_cleanup',
            user_id: userId,
            member_id: memberId,
            created_at: admin.firestore.FieldValue.serverTimestamp(),
            note: 'User current_apartment_id cleared after member removal'
        });
    }
    catch (error) {
        console.error('❌ Error in onApartmentMemberDeleted:', error);
        // Don't throw - this is a background function
    }
});
/**
 * Recompute balances from open debts only
 * This is the source of truth for balance calculations
 */
async function recomputeBalances(apartmentId) {
    const db = admin.firestore();
    console.log(`🔄 [recomputeBalances] Starting balance recomputation for apartment ${apartmentId}`);
    try {
        // Get all open debts for this apartment
        const debtsSnap = await db.collection('debts')
            .where('apartment_id', '==', apartmentId)
            .where('status', '==', 'open')
            .get();
        console.log(`🔄 [recomputeBalances] Found ${debtsSnap.size} open debts`);
        const net = {};
        const hasOpen = {};
        // Process each open debt
        debtsSnap.forEach((doc) => {
            const debt = doc.data();
            const { from_user_id, to_user_id, amount } = debt;
            if (!net[from_user_id])
                net[from_user_id] = 0;
            if (!net[to_user_id])
                net[to_user_id] = 0;
            // Debtor owes money (negative balance)
            net[from_user_id] -= amount;
            // Creditor is owed money (positive balance)
            net[to_user_id] += amount;
            // Mark both users as having open debts
            hasOpen[from_user_id] = true;
            hasOpen[to_user_id] = true;
        });
        console.log(`🔄 [recomputeBalances] Calculated balances:`, net);
        console.log(`🔄 [recomputeBalances] Users with open debts:`, hasOpen);
        // Write balances to Firestore
        const batch = db.batch();
        const usersSet = new Set(Object.keys(net).concat(Object.keys(hasOpen)));
        for (const uid of usersSet) {
            const docRef = db.doc(`balances/${apartmentId}/users/${uid}`);
            batch.set(docRef, {
                net: Number((net[uid] || 0).toFixed(2)),
                has_open_debts: !!hasOpen[uid],
                updated_at: admin.firestore.FieldValue.serverTimestamp(),
                apartment_id: apartmentId,
                user_id: uid
            }, { merge: true });
        }
        await batch.commit();
        console.log(`✅ [recomputeBalances] Successfully updated balances for ${usersSet.size} users`);
    }
    catch (error) {
        console.error(`❌ [recomputeBalances] Error recomputing balances:`, error);
        throw error;
    }
}
/**
 * Trigger on debt changes to recompute balances
 */
exports.onDebtWrite = functions.firestore
    .document('debts/{debtId}')
    .onWrite(async (change, context) => {
    var _a;
    const after = change.after.exists ? change.after.data() : null;
    const before = change.before.exists ? change.before.data() : null;
    // Get apartment ID from either the new or old document
    const apartmentId = (_a = (after || before)) === null || _a === void 0 ? void 0 : _a.apartment_id;
    if (!apartmentId) {
        console.warn('⚠️ [onDebtWrite] No apartment_id found in debt document');
        return;
    }
    console.log(`🔄 [onDebtWrite] Debt changed for apartment ${apartmentId}, recomputing balances`);
    try {
        await recomputeBalances(apartmentId);
    }
    catch (error) {
        console.error(`❌ [onDebtWrite] Error recomputing balances:`, error);
    }
});
/**
 * Callable function to manually recompute balances
 * Useful for refreshing balances before member removal
 */
exports.recomputeBalancesCallable = functions.https.onCall(async ({ apartmentId }, context) => {
    // Validate authentication
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'AUTH_REQUIRED');
    }
    if (!apartmentId) {
        throw new functions.https.HttpsError('invalid-argument', 'APARTMENT_ID_REQUIRED');
    }
    console.log(`🔄 [recomputeBalancesCallable] Manual balance recomputation requested for apartment ${apartmentId} by user ${context.auth.uid}`);
    try {
        await recomputeBalances(apartmentId);
        return { success: true, message: 'Balances recomputed successfully' };
    }
    catch (error) {
        console.error(`❌ [recomputeBalancesCallable] Error:`, error);
        throw new functions.https.HttpsError('internal', 'Failed to recompute balances');
    }
});
//# sourceMappingURL=index.js.map