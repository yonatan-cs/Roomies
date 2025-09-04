/**
 * Firestore SDK Service for Transactions
 * This service uses Firebase Web SDK for operations that require transactions
 * and other SDK-specific features that don't work with REST API
 */

import {
  runTransaction,
  doc,
  writeBatch,
  serverTimestamp,
  increment,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  orderBy,
  getDocs,
  onSnapshot,
  Unsubscribe
} from 'firebase/firestore';
import { db } from './firebase-sdk';
import { firebaseAuth } from './firebase-auth';

export interface DebtSettlementData {
  apartmentId: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  description?: string;
}

export interface ExpenseUpdateData {
  expenseId: string;
  amount?: number;
  category?: string;
  participants?: string[];
  title?: string;
  note?: string;
}

/**
 * Firestore SDK Service Class
 * Handles transactions and other SDK-specific operations
 */
export class FirestoreSDKService {
  private static instance: FirestoreSDKService;

  static getInstance(): FirestoreSDKService {
    if (!FirestoreSDKService.instance) {
      FirestoreSDKService.instance = new FirestoreSDKService();
    }
    return FirestoreSDKService.instance;
  }

  /**
   * Settle calculated debt atomically using Firebase Web SDK transaction
   * This replaces the REST API version that was causing 403 errors
   */
  async settleCalculatedDebt(data: DebtSettlementData): Promise<void> {
    const { apartmentId, fromUserId, toUserId, amount, description } = data;
    
    console.log('🚀 Starting debt settlement transaction with SDK:', {
      apartmentId,
      fromUserId,
      toUserId,
      amount,
      description
    });

    try {
      // Get current user for actor_uid
      const currentUser = await firebaseAuth.getCurrentUser();
      if (!currentUser?.localId) {
        throw new Error('AUTH_REQUIRED');
      }

      const actorUid = currentUser.localId;

      // Generate deterministic IDs
      const debtId = Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9);
      const actionId = Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9);

      await runTransaction(db, async (transaction) => {
        console.log('🔄 Transaction started, processing debt settlement...');

        // Document references
        const debtRef = doc(db, 'debts', debtId);
        const fromBalanceRef = doc(db, 'balances', apartmentId, 'users', fromUserId);
        const toBalanceRef = doc(db, 'balances', apartmentId, 'users', toUserId);
        const actionRef = doc(db, 'actions', actionId);

        // Check if debt document already exists
        const debtSnap = await transaction.get(debtRef);
        
        if (!debtSnap.exists()) {
          // 1. Create debt document (status: 'open') with server timestamp
          // This matches the "allow create" rule
          transaction.set(debtRef, {
            apartment_id: apartmentId,
            from_user_id: fromUserId,
            to_user_id: toUserId,
            amount: amount,
            status: 'open',
            description: description || '',
            created_at: serverTimestamp(),
          });
          console.log('📝 Creating new debt document');
        } else {
          // If debt already exists, check if it's already closed (idempotent)
          const existingDebt = debtSnap.data();
          if (existingDebt.status === 'closed') {
            console.log('⚠️ Debt already closed, skipping settlement');
            return; // Exit transaction early - idempotent operation
          }
          console.log('📋 Debt document exists, will only update status');
        }

        // 2. Close the debt (this matches the "allow update" rule)
        // Only updates: status, closed_by, closed_at (allowed by rules)
        transaction.update(debtRef, {
          status: 'closed',
          closed_by: actorUid,
          closed_at: serverTimestamp(),
        });

        // 3. Update balances atomically using increment transforms
        // From user gets +amount (they are owed money)
        transaction.set(fromBalanceRef, {
          balance: increment(amount)
        }, { merge: true });

        // To user gets -amount (they owe less money)
        transaction.set(toBalanceRef, {
          balance: increment(-amount)
        }, { merge: true });

        // 4. Create action log with server timestamp
        transaction.set(actionRef, {
          apartment_id: apartmentId,
          type: 'debt_closed',
          debt_id: debtId,
          from_user_id: fromUserId,
          to_user_id: toUserId,
          amount: amount,
          actor_uid: actorUid,
          note: description || '',
          created_at: serverTimestamp(),
        });

        console.log('✅ Transaction operations prepared successfully');
      });

      console.log('🎉 Debt settlement transaction completed successfully!');
      
    } catch (error) {
      console.error('❌ Debt settlement transaction failed:', error);
      throw error;
    }
  }

  /**
   * Update expense with transaction support using Firebase Web SDK
   * This replaces the REST API version that was causing 403 errors
   */
  async updateExpense(data: ExpenseUpdateData): Promise<void> {
    const { expenseId, amount, category, participants, title, note } = data;
    
    console.log('🚀 Starting expense update transaction with SDK:', {
      expenseId,
      amount,
      category,
      participants,
      title,
      note
    });

    try {
      // Get current user for audit log
      const currentUser = await firebaseAuth.getCurrentUser();
      if (!currentUser?.localId) {
        throw new Error('AUTH_REQUIRED');
      }

      const actorUid = currentUser.localId;

      await runTransaction(db, async (transaction) => {
        console.log('🔄 Transaction started, processing expense update...');

        // Get current expense data
        const expenseRef = doc(db, 'expenses', expenseId);
        const expenseSnap = await transaction.get(expenseRef);
        
        if (!expenseSnap.exists()) {
          throw new Error('EXPENSE_NOT_FOUND');
        }

        const currentData = expenseSnap.data();
        console.log('📋 Current expense data:', currentData);

        // Prepare update fields
        const updateFields: any = {};
        
        if (amount !== undefined) {
          updateFields.amount = amount;
        }
        if (category !== undefined) {
          updateFields.category = category;
        }
        if (participants !== undefined) {
          updateFields.participants = participants;
        }
        if (title !== undefined) {
          updateFields.title = title;
        }
        if (note !== undefined) {
          updateFields.note = note;
        }

        // Add updated timestamp
        updateFields.updated_at = serverTimestamp();

        console.log('📝 Update fields:', updateFields);

        // Update the expense
        transaction.update(expenseRef, updateFields);

        // Create audit log entry
        const auditLogId = Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9);
        const auditLogRef = doc(db, 'expense_audit_logs', auditLogId);
        
        transaction.set(auditLogRef, {
          expenseId: expenseId,
          action: 'update',
          changes: JSON.stringify(updateFields),
          previousData: JSON.stringify(currentData),
          modifiedBy: actorUid,
          timestamp: serverTimestamp(),
        });

        console.log('✅ Transaction operations prepared successfully');
      });

      console.log('🎉 Expense update transaction completed successfully!');
      
    } catch (error) {
      console.error('❌ Expense update transaction failed:', error);
      throw error;
    }
  }

  /**
   * Get real-time updates for a collection using onSnapshot
   * This is more efficient than polling with REST API
   */
  subscribeToCollection(
    collectionName: string,
    callback: (docs: any[]) => void,
    filters?: { field: string; operator: any; value: any }[],
    orderByField?: string,
    orderDirection: 'asc' | 'desc' = 'desc'
  ): Unsubscribe {
    console.log(`📡 Setting up real-time subscription for ${collectionName}`);

    let q = collection(db, collectionName);
    
    // Apply filters if provided
    if (filters) {
      filters.forEach(filter => {
        q = query(q, where(filter.field, filter.operator, filter.value));
      });
    }
    
    // Apply ordering if provided
    if (orderByField) {
      q = query(q, orderBy(orderByField, orderDirection));
    }

    return onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      console.log(`📊 ${collectionName} subscription update: ${docs.length} documents`);
      callback(docs);
    }, (error) => {
      console.error(`❌ ${collectionName} subscription error:`, error);
    });
  }

  /**
   * Get a single document by ID
   */
  async getDocument(collectionName: string, documentId: string): Promise<any | null> {
    try {
      const docRef = doc(db, collectionName, documentId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data()
        };
      }
      
      return null;
    } catch (error) {
      console.error(`❌ Error getting document ${documentId} from ${collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Create a document with auto-generated ID
   */
  async createDocument(collectionName: string, data: any, documentId?: string): Promise<string> {
    try {
      const docRef = documentId ? doc(db, collectionName, documentId) : doc(collection(db, collectionName));
      
      await setDoc(docRef, {
        ...data,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      });
      
      console.log(`✅ Document created in ${collectionName}:`, docRef.id);
      return docRef.id;
    } catch (error) {
      console.error(`❌ Error creating document in ${collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Simple debt settlement - only updates balances and creates action log
   * This is the minimal approach that doesn't touch the debts collection at all
   */
  async settleOutsideApp({
    apartmentId,
    fromUserId,
    toUserId,
    amount,
    note,
    actorUid
  }: {
    apartmentId: string;
    fromUserId: string;
    toUserId: string;
    amount: number;
    note?: string;
    actorUid: string;
  }): Promise<void> {
    if (amount <= 0) {
      throw new Error('Amount must be > 0');
    }

    console.log('🚀 Starting simple debt settlement:', {
      apartmentId,
      fromUserId,
      toUserId,
      amount,
      note,
      actorUid
    });

    try {
      const fromRef = doc(db, 'balances', apartmentId, 'users', fromUserId);
      const toRef = doc(db, 'balances', apartmentId, 'users', toUserId);
      const actionRef = doc(collection(db, 'actions'));

      await runTransaction(db, async (tx) => {
        console.log('🔄 Transaction started, processing simple settlement...');

        // Ensure balance documents exist
        const fromSnap = await tx.get(fromRef);
        if (!fromSnap.exists()) {
          tx.set(fromRef, { balance: 0 });
          console.log('📝 Created from balance document');
        }

        const toSnap = await tx.get(toRef);
        if (!toSnap.exists()) {
          tx.set(toRef, { balance: 0 });
          console.log('📝 Created to balance document');
        }

        // Update balances with increment transforms
        // From user gets -amount (they owe less)
        tx.update(fromRef, { balance: increment(-amount) });
        // To user gets +amount (they are owed more)
        tx.update(toRef, { balance: increment(+amount) });

        console.log('💰 Updated balances:', {
          fromUser: `-${amount}`,
          toUser: `+${amount}`
        });

        // Create action log
        tx.set(actionRef, {
          apartment_id: apartmentId,
          type: 'debt_closed',
          actor_uid: actorUid,
          from_user_id: fromUserId,
          to_user_id: toUserId,
          amount,
          note: note ?? null,
          created_at: serverTimestamp(),
        });

        console.log('📝 Created action log');
        console.log('✅ Transaction operations prepared successfully');
      });

      console.log('🎉 Simple debt settlement completed successfully!');
      
    } catch (error) {
      console.error('❌ Simple debt settlement failed:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const firestoreSDKService = FirestoreSDKService.getInstance();
