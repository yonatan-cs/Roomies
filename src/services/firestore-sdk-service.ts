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
  collectionGroup,
  query,
  where,
  orderBy,
  getDocs,
  onSnapshot,
  Unsubscribe,
  Query,
  CollectionReference,
  type WhereFilterOp
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

    let q: Query | CollectionReference = collection(db, collectionName);
    
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
   * Subscribe to a Firestore collectionGroup with real-time updates
   * Use this for subcollections that exist under different parent paths
   * (e.g., checklistItems under cleaningTasks/{taskId}/checklistItems and apartments/{apartmentId}/tasks/{taskId}/checklistItems)
   * 
   * CRITICAL: Always filter by apartment_id to match security rules!
   * 
   * @param groupName - Collection group name (e.g., 'checklistItems')
   * @param callback - Callback when data updates
   * @param filters - Where filters to apply (MUST include apartment_id filter!)
   * @param orderByField - Optional field to order by
   * @param orderDir - Order direction
   * @param onError - Optional error handler for permission errors
   * @returns Unsubscribe function
   */
  subscribeToCollectionGroup<T = any>(
    groupName: string,
    callback: (docs: T[]) => void,
    filters: { field: string; operator: WhereFilterOp; value: any }[] = [],
    orderByField?: string,
    orderDir: 'asc' | 'desc' = 'asc',
    onError?: (error: any) => void
  ): Unsubscribe {
    console.log(`📡 Setting up real-time collectionGroup subscription for ${groupName}`);
    
    let q: Query = collectionGroup(db, groupName);

    // Apply filters - CRITICAL: Must include apartment_id for security rules
    for (const filter of filters) {
      q = query(q, where(filter.field, filter.operator, filter.value));
    }
    
    // Apply ordering if provided
    if (orderByField) {
      q = query(q, orderBy(orderByField, orderDir));
    }

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as T[];
        
        console.log(`📊 ${groupName} collectionGroup update: ${items.length} documents`);
        callback(items);
      },
      (error) => {
        // Handle errors including PERMISSION_DENIED when current_apartment_id not set
        console.warn(`❌ subscribeToCollectionGroup error (${groupName}):`, error?.code || error?.message);
        onError?.(error);
      }
    );

    return unsubscribe;
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
   * NOTE: Realtime listener removed due to Firebase Security Rules complexity
   * The rules require reading parent documents which creates infinite recursion in onSnapshot
   * Using polling-based updates instead via REST API
   */

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
