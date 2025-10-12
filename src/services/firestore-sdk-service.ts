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
  Unsubscribe,
  Query,
  CollectionReference,
  QueryConstraint
} from 'firebase/firestore';
import { db } from './firebase-sdk';
import { firebaseAuth } from './firebase-auth';
import { firestoreService, requireSession, ensureCurrentApartmentIdMatches } from './firestore-service';
import { useStore } from '../state/store';

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

type SubscribeOpts = {
  orderByField?: string;
  extra?: QueryConstraint[]; // אופציונלי: פילטרים נוספים
};

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
   * ✅ עטיפת subscribe שמוסיפה where ומחכה ל-aptId
   * פותר את כל 3 הבעיות: aptId null, missing where, wrong field name
   */
  subscribeCollection(
    collectionName: 'expenses' | 'shopping_items' | 'cleaning_checklist' | string,
    opts: SubscribeOpts,
    callback: (rows: any[]) => void
  ): Unsubscribe {
    // Get current apartment ID from store
    const store = useStore.getState();
    const aptId = store.currentApartment?.id;

    // 1) בלי דירה נוכחית – לא פותחים מאזין (מונע Permission Denied)
    if (!aptId) {
      console.warn(`subscribeCollection(${collectionName}): skipped – no currentApartmentId yet`);
      return () => {}; // noop unsubscribe
    }

    const needsAptFilter = ['expenses', 'shopping_items', 'cleaning_checklist'].includes(collectionName);

    let base = collection(db, collectionName);
    let constraints: QueryConstraint[] = [];

    // 2) מוסיפים where חובה לפי הכללים
    if (needsAptFilter) {
      constraints.push(where('apartment_id', '==', aptId));
    }

    // 3) כבוד למסננים קיימים
    if (opts?.extra?.length) constraints = constraints.concat(opts.extra);
    if (opts?.orderByField) constraints.push(orderBy(opts.orderByField as any));

    const q = query(base, ...constraints);

    // 4) לוג קצר כדי לוודא
    console.log(`[subscribe] ${collectionName} apt=${aptId} constraints=`, constraints);

    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      callback(data);
    }, (err) => {
      console.error(`❌ ${collectionName} subscription error:`, err);
    });

    return unsub;
  }

  /**
   * @deprecated Use subscribeCollection instead - it automatically handles apartment_id filtering
   */
  subscribeToCollection(
    collectionName: string,
    callback: (docs: any[]) => void,
    filters?: { field: string; operator: any; value: any }[],
    orderByField?: string,
    orderDirection: 'asc' | 'desc' = 'desc'
  ): Unsubscribe {
    console.log(`📡 Setting up real-time subscription for ${collectionName}`);
    console.log(`📡 Filters:`, filters);

    let q: Query | CollectionReference = collection(db, collectionName);
    
    // Apply filters if provided
    if (filters) {
      filters.forEach(filter => {
        console.log(`📡 Applying filter: ${filter.field} ${filter.operator} ${filter.value}`);
        q = query(q, where(filter.field, filter.operator, filter.value));
      });
    } else {
      console.log(`⚠️ No filters provided for ${collectionName} - this may cause permission errors!`);
    }
    
    // Apply ordering if provided
    if (orderByField) {
      console.log(`📡 Applying orderBy: ${orderByField} ${orderDirection}`);
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
