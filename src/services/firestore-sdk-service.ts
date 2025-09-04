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

      // Update balances using REST API
      const now = new Date();
      
      // Update from user balance (they owe less)
      await firestoreService.updateDocument(
        `balances/${apartmentId}/users`,
        fromUserId,
        { balance: -amount },
        ['balance']
      );

      // Update to user balance (they are owed more)  
      await firestoreService.updateDocument(
        `balances/${apartmentId}/users`,
        toUserId,
        { balance: amount },
        ['balance']
      );

      // Create action log
      await firestoreService.createDocument('actions', {
        apartment_id: apartmentId,
        type: 'debt_closed',
        actor_uid: actorUid,
        from_user_id: fromUserId,
        to_user_id: toUserId,
        amount,
        note: note || null,
        created_at: now
      });

      console.log('🎉 Simple debt settlement completed successfully with REST API!');
      
    } catch (error) {
      console.error('❌ Simple debt settlement failed:', error);
      console.error('❌ Error details:', {
        name: error.name,
        message: error.message,
        code: error.code,
        stack: error.stack
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
