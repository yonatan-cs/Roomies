/**
 * Firestore Database Service using REST API
 * Handles database operations without Firebase SDK
 */

import { FIRESTORE_BASE_URL, COLLECTIONS } from './firebase-config';
import { firebaseAuth } from './firebase-auth';
import { ChecklistItem } from '../types';

// --- Session helpers ---
const authHeaders = (idToken: string) => ({
  Authorization: `Bearer ${idToken}`,
  'Content-Type': 'application/json',
});

/**
 * Helper function to refresh ID token and begin a Firestore transaction
 * This prevents 403 errors that occur when tokens expire during mobile network usage
 */
async function beginTransactionWithRefresh(): Promise<{ transactionId: string; refreshedToken: string }> {
  console.log('🔄 Refreshing ID token before transaction...');
  const refreshedIdToken = await firebaseAuth.getCurrentIdToken(); // Get current token
  
  if (!refreshedIdToken) {
    throw new Error('AUTH_TOKEN_REFRESH_FAILED');
  }
  
  console.log('✅ ID token refreshed successfully for transaction');

  const transactionUrl = `${FIRESTORE_BASE_URL}:beginTransaction`;
  const response = await fetch(transactionUrl, {
    method: 'POST',
    headers: authHeaders(refreshedIdToken),
    body: JSON.stringify({})
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    console.error('❌ Transaction begin failed:', response.status, errorText);
    throw new Error(`TRANSACTION_BEGIN_FAILED_${response.status}`);
  }

  const data = await response.json();
  return {
    transactionId: data.transaction,
    refreshedToken: refreshedIdToken
  };
}

// ✅ ודא שהכלל resource.data.apartment_id == currentUserApartmentId() יתקיים
export async function ensureCurrentApartmentIdMatches(aptId: string): Promise<void> {
  const { uid, idToken } = await requireSession();
  const current = await getUserCurrentApartmentId(uid, idToken);
  if (current === aptId) return;

  // PATCH: users/{uid}?updateMask.fieldPaths=current_apartment_id
  const url = `${FIRESTORE_BASE_URL}/users/${uid}?updateMask.fieldPaths=current_apartment_id`;
  const body = {
    fields: {
      current_apartment_id: { stringValue: aptId }
    }
  };
  const res = await fetch(url, { method: 'PATCH', headers: authHeaders(idToken), body: JSON.stringify(body) });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('Firestore ensureCurrentApartmentIdMatches error:', res.status, text);
      throw new Error(`ENSURE_APARTMENT_CONTEXT_FAILED_${res.status}: ${text}`);
    }
}

// Firestore data types for REST API
interface FirestoreValue {
  stringValue?: string;
  integerValue?: string;
  doubleValue?: number;
  booleanValue?: boolean;
  timestampValue?: string;
  arrayValue?: { values: FirestoreValue[] };
  mapValue?: { fields: Record<string, FirestoreValue> };
}

interface FirestoreDocument {
  name: string;
  fields: Record<string, FirestoreValue>;
  createTime?: string;
  updateTime?: string;
}

// Ensure we always have uid + idToken using SDK Auth (not REST Auth)
export async function requireSession(): Promise<{ uid: string; idToken: string }> {
  try {
    // Use SDK Auth instead of REST Auth to avoid mismatch
    const { auth } = await import('./firebase-sdk');
    
    if (!auth.currentUser) {
      console.log('❌ No current user in SDK Auth');
      throw new Error('AUTH_REQUIRED');
    }
    
    const uid = auth.currentUser.uid;
    const idToken = await auth.currentUser.getIdToken(true); // Force refresh
    
    console.log('✅ SDK Session available:', { 
      uid: uid, 
      tokenPreview: idToken.substring(0, 20) + '...',
      hasUid: !!uid,
      hasToken: !!idToken,
      uidLength: uid?.length || 0,
      tokenLength: idToken?.length || 0
    });
    
    return { uid, idToken };
    
  } catch (error) {
    console.error('❌ Error in requireSession:', error);
    throw new Error('AUTH_REQUIRED');
  }
}

// Safe base64 decoder that works in both browser and Node.js environments
function safeBase64Decode(b64: string): string {
  try {
    // Remove padding if present
    const cleanB64 = b64.replace(/[^A-Za-z0-9+/]/g, '');
    const paddedB64 = cleanB64 + '='.repeat((4 - cleanB64.length % 4) % 4);
    return atob(paddedB64);
  } catch (error) {
    console.error('Base64 decode error:', error);
    return '';
  }
}

// Get user's current apartment ID from their profile
async function getUserCurrentApartmentId(uid: string, idToken: string): Promise<string | null> {
  try {
    const userDocUrl = `${FIRESTORE_BASE_URL}/users/${uid}`;
    const response = await fetch(userDocUrl, {
      method: 'GET',
      headers: authHeaders(idToken),
    });

    if (response.status === 404) {
      console.log('User document not found');
      return null;
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error('Get user current apartment ID failed:', response.status, errorText);
      throw new Error(`GET_USER_APARTMENT_${response.status}`);
    }

    const userDoc = await response.json();
    const currentApartmentId = userDoc.fields?.current_apartment_id?.stringValue;
    
    console.log('User current apartment ID:', currentApartmentId);
    return currentApartmentId || null;
  } catch (error) {
    console.error('Error getting user current apartment ID:', error);
    return null;
  }
}

// Get apartment context with validation
async function getApartmentContext(): Promise<{ uid: string; idToken: string; aptId: string }> {
  const { uid, idToken } = await requireSession();
  const aptId = await getUserCurrentApartmentId(uid, idToken);
  if (!aptId) throw new Error('NO_APARTMENT_ON_PROFILE');
  return { uid, idToken, aptId };
}

// Get apartment context without throwing error
async function getApartmentContextSlim(): Promise<{ uid: string; idToken: string; aptId: string | null }> {
  const { uid, idToken } = await requireSession();
  const aptId = await getUserCurrentApartmentId(uid, idToken);
  return { uid, idToken, aptId };
}

/**
 * Firestore Database Service Class
 */
export class FirestoreService {
  private static instance: FirestoreService;
  private static _initialized = false;

  private constructor() {}

  public static getInstance(): FirestoreService {
    if (!FirestoreService.instance) {
      FirestoreService.instance = new FirestoreService();
    }
    return FirestoreService.instance;
  }

  /**
   * Run a Firestore transaction
   */
  private async runTransaction(updateFunction: (transaction: any) => Promise<void>): Promise<void> {
    const { runTransaction } = await import('firebase/firestore');
    const { db } = await import('./firebase-sdk');
    return runTransaction(db, updateFunction);
  }

  /**
   * Wait for authentication to be ready
   * This is crucial when using REST API instead of Firebase SDK
   */
  async waitForAuth(): Promise<void> {
    if (FirestoreService._initialized) return;
    
    console.log('⏳ Waiting for authentication to be ready...');
    
    // Wait for auth to be ready
    let attempts = 0;
    const maxAttempts = 30; // 3 seconds max
    
    while (attempts < maxAttempts) {
      try {
        const { uid } = await requireSession();
        if (uid) {
          console.log('✅ Authentication ready');
          FirestoreService._initialized = true;
          return;
        }
      } catch (error) {
        // Auth not ready yet, continue waiting
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    
    throw new Error('AUTH_TIMEOUT');
  }
  }

  // ... rest of the class methods remain the same ...}
