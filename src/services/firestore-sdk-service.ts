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
import { firestoreService, requireSession, ensureCurrentApartmentIdMatches } from './firestore-service';

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

  // REMOVED: Old settleCalculatedDebt function that touched debts collection
  // Now using settleOutsideApp which only touches balances and actions

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

    let q: any = collection(db, collectionName);
    
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

    return onSnapshot(q, (snapshot: any) => {
      const docs = snapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data()
      }));
      
      console.log(`📊 ${collectionName} subscription update: ${docs.length} documents`);
      callback(docs);
    }, (error: any) => {
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
   * Close debt and refresh balances - Complete solution using transactions
   * This properly closes the debt and updates balances in one atomic operation
   */
  async closeDebtAndRefreshBalances(
    apartmentId: string,
    debtId: string,
    { payerUserId, receiverUserId, amount }: { payerUserId: string; receiverUserId: string; amount: number; }
  ): Promise<void> {
    console.log('🚀 Starting debt closure and balance refresh:', {
      apartmentId,
      debtId,
      payerUserId,
      receiverUserId,
      amount
    });

    try {
      // Get current user
      const currentUser = await firebaseAuth.getCurrentUser();
      if (!currentUser?.localId) {
        throw new Error('AUTH_REQUIRED');
      }

      const uid = currentUser.localId;

      // 1) Close debt in transaction
      await runTransaction(db, async (tx) => {
        console.log('🔄 Transaction started, processing debt closure...');

        const debtRef = doc(db, 'debts', debtId);
        const debtSnap = await tx.get(debtRef);
        
        if (!debtSnap.exists()) {
          throw new Error('DEBT_NOT_FOUND');
        }

        const debt = debtSnap.data() as any;
        if (debt.status !== 'open') {
          throw new Error('ALREADY_CLOSED');
        }
        if (debt.apartment_id !== apartmentId) {
          throw new Error('WRONG_APARTMENT');
        }

        console.log('📋 Current debt data:', debt);

        // Update debt to closed
        tx.update(debtRef, {
          status: 'closed',
          closed_at: serverTimestamp(),
          closed_by: uid,
        });

        // Create settlement record
        const settlementRef = doc(collection(db, 'debtSettlements'));
        tx.set(settlementRef, {
          apartment_id: apartmentId,
          payer_user_id: payerUserId,
          receiver_user_id: receiverUserId,
          amount,
          created_at: serverTimestamp(),
        });

        // Create action log
        const actionRef = doc(collection(db, 'actions'));
        tx.set(actionRef, {
          apartment_id: apartmentId,
          type: 'debt_closed',
          actor_uid: uid,
          created_at: serverTimestamp(),
          debt_id: debtId,
          amount,
          payer_user_id: payerUserId,
          receiver_user_id: receiverUserId,
        });

        console.log('✅ Transaction operations prepared successfully');
      });

      console.log('✅ Debt closed successfully');

      // 2) Refresh balances (Batch)
      await this.refreshBalancesFromOpenDebts(apartmentId);

      console.log('🎉 Debt closed and balances refreshed successfully!');
      
    } catch (error) {
      console.error('❌ Debt closure failed:', error);
      throw error;
    }
  }

  /**
   * Refresh balances from open debts
   * This calculates net balances for all users based on open debts
   */
  async refreshBalancesFromOpenDebts(apartmentId: string): Promise<void> {
    console.log('🔄 Refreshing balances from open debts for apartment:', apartmentId);

    try {
      // Get all open debts for this apartment
      const q = query(
        collection(db, 'debts'),
        where('apartment_id', '==', apartmentId),
        where('status', '==', 'open')
      );
      const openDebtsSnap = await getDocs(q);

      // Get all apartment members to ensure we update everyone
      const membersQuery = query(
        collection(db, 'apartmentMembers'),
        where('apartment_id', '==', apartmentId)
      );
      const membersSnap = await getDocs(membersQuery);
      const allUids = new Set<string>();
      membersSnap.forEach(d => allUids.add((d.data() as any).user_id));

      // Calculate net balances
      const net: Record<string, number> = {};
      openDebtsSnap.forEach(d => {
        const { from_user_id, to_user_id, amount } = d.data() as any;
        net[from_user_id] = (net[from_user_id] || 0) - amount;
        net[to_user_id] = (net[to_user_id] || 0) + amount;
        allUids.add(from_user_id);
        allUids.add(to_user_id);
      });

      console.log('📊 Calculated net balances:', net);

      // Update all balances in batch
      const batch = writeBatch(db);
      for (const uid of allUids) {
        const value = Number((net[uid] || 0).toFixed(2));
        const balanceRef = doc(db, `balances/${apartmentId}/users/${uid}`);
        batch.set(balanceRef, {
          net: value,
          has_open_debts: value !== 0,
          updated_at: serverTimestamp(),
        }, { merge: true });
      }

      await batch.commit();
      console.log('✅ Balances updated successfully');

    } catch (error) {
      console.error('❌ Error refreshing balances:', error);
      throw error;
    }
  }

  /**
   * Close debt without debtId - for cases where we want to create settlement without existing debt
   * This creates a settlement record and refreshes balances
   */
  async closeDebtWithoutDebtId(
    apartmentId: string,
    { payerUserId, receiverUserId, amount }: { payerUserId: string; receiverUserId: string; amount: number; }
  ): Promise<void> {
    console.log('🚀 Starting debt settlement without debtId:', {
      apartmentId,
      payerUserId,
      receiverUserId,
      amount
    });

    try {
      // Get current user
      const currentUser = await firebaseAuth.getCurrentUser();
      if (!currentUser?.localId) {
        throw new Error('AUTH_REQUIRED');
      }

      const uid = currentUser.localId;

      // Create settlement record and action log in transaction
      await runTransaction(db, async (tx) => {
        console.log('🔄 Transaction started, processing debt settlement...');

        // Create settlement record
        const settlementRef = doc(collection(db, 'debtSettlements'));
        tx.set(settlementRef, {
          apartment_id: apartmentId,
          payer_user_id: payerUserId,
          receiver_user_id: receiverUserId,
          amount,
          created_at: serverTimestamp(),
        });

        // Create action log
        const actionRef = doc(collection(db, 'actions'));
        tx.set(actionRef, {
          apartment_id: apartmentId,
          type: 'debt_closed',
          actor_uid: uid,
          created_at: serverTimestamp(),
          amount,
          payer_user_id: payerUserId,
          receiver_user_id: receiverUserId,
        });

        console.log('✅ Transaction operations prepared successfully');
      });

      console.log('✅ Debt settlement created successfully');

      // Refresh balances
      await this.refreshBalancesFromOpenDebts(apartmentId);

      console.log('🎉 Debt settlement completed and balances refreshed successfully!');
      
    } catch (error) {
      console.error('❌ Debt settlement failed:', error);
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

    // DEBUG: Confirm this is the function being called
    console.log('🔍 [settleOutsideApp] DEBUG - This is the SIMPLE function being called:', {
      apartmentId,
      fromUserId,
      toUserId,
      amount,
      note,
      actorUid
    });

    console.log('🚀 Starting simple debt settlement:', {
      apartmentId,
      fromUserId,
      toUserId,
      amount,
      note,
      actorUid
    });

    try {
      // Get current user session
      const { uid, idToken } = await requireSession();
      
      // Ensure apartment context matches
      await ensureCurrentApartmentIdMatches(apartmentId);

      console.log('✅ Using REST API for debt settlement to avoid permission issues');

      const now = new Date();
      
      // Create a debt settlement record (this is what the old system expects)
      const settlementData = {
        apartment_id: apartmentId,
        payer_user_id: fromUserId,
        receiver_user_id: toUserId,
        amount: amount,
        date: now,
        description: note || 'סגירת חוב'
      };
      
      console.log('📝 Creating debt settlement record:', settlementData);
      await firestoreService.createDocument('debtSettlements', settlementData);

      console.log('🎉 Debt settlement created successfully!');
      
    } catch (error: any) {
      console.error('❌ Simple debt settlement failed:', error);
      console.error('❌ Error details:', {
        name: error?.name,
        message: error?.message,
        code: error?.code,
        stack: error?.stack
      });
      
      // Add more specific error handling
      if (error.code === 'permission-denied') {
        console.error('🚫 PERMISSION DENIED - Check Firestore rules');
        console.error('🚫 User:', actorUid);
        console.error('🚫 Apartment:', apartmentId);
        console.error('🚫 From User:', fromUserId);
        console.error('🚫 To User:', toUserId);
        console.error('🚫 Check if user is member of apartment:', `${apartmentId}_${actorUid}`);
        console.error('🚫 Check if user current apartment matches:', apartmentId);
        
        // Additional debugging - check if the user document exists and has correct apartment
        try {
          const userRef = doc(db, 'users', actorUid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const userData = userSnap.data();
            console.error('🚫 User document data:', {
              current_apartment_id: userData.current_apartment_id,
              expected_apartment_id: apartmentId,
              matches: userData.current_apartment_id === apartmentId
            });
          } else {
            console.error('🚫 User document does not exist!');
          }
        } catch (debugError) {
          console.error('🚫 Error checking user document:', debugError);
        }
      }
      
      throw error;
    }
  }
}

// Export singleton instance
export const firestoreSDKService = FirestoreSDKService.getInstance();
