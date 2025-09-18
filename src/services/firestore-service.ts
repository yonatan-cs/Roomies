/**
 * Firestore Database Service using REST API
 * Handles database operations without Firebase SDK
 */

import { FIRESTORE_BASE_URL, COLLECTIONS } from './firebase-config';
import { firebaseAuth } from './firebase-auth';
import { db } from './firebase-sdk';
import { runTransaction, doc } from 'firebase/firestore';
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
  
  // Log transaction attempt details for debugging
  console.log('🚀 Starting transaction:', {
    url: transactionUrl,
    hasAuthHeader: !!refreshedIdToken,
    tokenPreview: refreshedIdToken.substring(0, 20) + '...'
  });
  
  const beginResponse = await fetch(transactionUrl, {
    method: 'POST',
    headers: authHeaders(refreshedIdToken),
    body: JSON.stringify({}), // Explicit empty body
  });

  if (!beginResponse.ok) {
    const errorText = await beginResponse.text().catch(() => '');
    console.error('❌ Transaction begin failed:', {
      status: beginResponse.status,
      statusText: beginResponse.statusText,
      errorText,
      url: transactionUrl,
      hasAuthHeader: !!refreshedIdToken
    });
    throw new Error(`TRANSACTION_BEGIN_FAILED_${beginResponse.status}: ${errorText}`);
  }

  const transactionData = await beginResponse.json();
  const transactionId = transactionData.transaction;
  
  console.log('✅ Transaction started successfully:', { transactionId: transactionId.substring(0, 20) + '...' });
  
  return { transactionId, refreshedToken: refreshedIdToken };
}

// --- Firestore REST value builders (STRICT) ---
const F = {
  str: (v: string) => ({ stringValue: String(v) }),
  bool: (v: boolean) => ({ booleanValue: !!v }),
  int: (n: number) => ({ integerValue: String(Math.trunc(n)) }), // חייב מחרוזת!
  ts: (d: Date | string) => ({ timestampValue: (d instanceof Date ? d : new Date(d)).toISOString() }),
  arrStr: (a: string[]) => ({ arrayValue: { values: a.map(s => ({ stringValue: String(s) })) } }),
  map: (obj: Record<string, any>) => ({ 
    mapValue: { 
      fields: Object.fromEntries(
        Object.entries(obj).map(([key, value]) => [key, value])
      ) 
    } 
  }),
};

function H(idToken: string) {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${idToken}`,
  };
}

// Ensure we always have uid + idToken (try to restore session if missing from memory)
export async function requireSession(): Promise<{ uid: string; idToken: string }> {
  try {
    // Try to get current user and token
    const currentUser = await firebaseAuth.getCurrentUser();
    const idToken = await firebaseAuth.getCurrentIdToken();
    
    if (currentUser?.localId && idToken) {
      console.log('✅ Session available:', { 
        uid: currentUser.localId, 
        tokenPreview: idToken.substring(0, 20) + '...',
        hasUid: !!currentUser.localId,
        hasToken: !!idToken,
        uidLength: currentUser.localId?.length || 0,
        tokenLength: idToken?.length || 0
      });
      return { uid: currentUser.localId, idToken };
    }
    
    // If no current user, try to restore session
    console.log('🔄 No current session, attempting to restore...');
    const restoredUser = await firebaseAuth.restoreUserSession();
    
    if (restoredUser?.localId) {
      const restoredToken = await firebaseAuth.getCurrentIdToken();
      if (restoredToken) {
        console.log('✅ Session restored:', { uid: restoredUser.localId, tokenPreview: restoredToken.substring(0, 20) + '...' });
        return { uid: restoredUser.localId, idToken: restoredToken };
      }
    }
    
    console.log('❌ No valid session found');
    throw new Error('AUTH_REQUIRED');
    
  } catch (error) {
    console.error('❌ Error in requireSession:', error);
    throw new Error('AUTH_REQUIRED');
  }
}

/**
 * Refresh ID token before first protected write after sign-in
 * This prevents edge cases of stale tokens during initial writes
 */
export async function refreshTokenIfNeeded(): Promise<void> {
  try {
    const user = await firebaseAuth.getCurrentUser();
    if (user) {
      // Get fresh token (this will use cached token if recent)
      await firebaseAuth.getCurrentIdToken();
      console.log('🔄 Token refreshed for first protected write');
    }
  } catch (error) {
    console.warn('⚠️ Token refresh failed:', error);
    // Don't throw - this is optional optimization
  }
}

// Safe base64 decoder that works in both browser and Node.js environments
function safeBase64Decode(b64: string): string {
  try {
    if (typeof atob === 'function') {
      return atob(b64);
    }
  } catch {}
  try {
    // Node.js Buffer
    return Buffer.from(b64, 'base64').toString('utf8');
  } catch (e) {
    return '';
  }
}

// Safe JWT decoder
function decodeJwt(token: string): { header: any; payload: any } | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    return {
      header: JSON.parse(safeBase64Decode(parts[0])),
      payload: JSON.parse(safeBase64Decode(parts[1])),
    };
  } catch (e) { 
    return null; 
  }
}

// Get user's current apartment ID from profile or fallback to latest membership
async function getUserCurrentApartmentId(uid: string, idToken: string): Promise<string | null> {
  try {
    // Step 1: Try from user profile - read from apartment.id instead of current_apartment_id
    const userResponse = await fetch(`${FIRESTORE_BASE_URL}/users/${uid}`, {
      method: 'GET',
      headers: authHeaders(idToken),
    });
    
    if (userResponse.status === 200) {
      const userDoc = await userResponse.json();
      const apartmentId = userDoc.fields?.apartment?.mapValue?.fields?.id?.stringValue;
      console.log('🔍 getUserCurrentApartmentId - user profile response:', {
        status: userResponse.status,
        hasFields: !!userDoc.fields,
        hasApartment: !!userDoc.fields?.apartment,
        hasApartmentId: !!userDoc.fields?.apartment?.mapValue?.fields?.id,
        apartmentIdValue: apartmentId,
        apartmentIdType: typeof apartmentId,
        apartmentIdLength: apartmentId?.length || 0
      });
      
      if (apartmentId) {
        console.log('✅ Found apartment ID in user profile:', apartmentId);
        return apartmentId;
      }
    }
    
    // No fallback needed in new model - apartment.id is the source of truth
    
    return null;
  } catch (error) {
    console.error('❌ Error getting user current apartment ID:', error);
    return null;
  }
}

// Get apartment context - ensures all operations use the same apartment_id
export async function getApartmentContext(): Promise<{ uid: string; idToken: string; aptId: string }> {
  const { uid, idToken } = await requireSession();
  
  let aptId = await getUserCurrentApartmentId(uid, idToken);
  if (!aptId) {
    throw new Error('NO_APARTMENT_FOR_USER');
  }
  
  return { uid, idToken, aptId };
}

// ✅ קבל uid + idToken + aptId מהפרופיל בלבד (בלי "חכמות")
export async function getApartmentContextSlim(): Promise<{ uid: string; idToken: string; aptId: string }> {
  const { uid, idToken } = await requireSession(); // יש לך כבר את הפונקציה הזו
  const aptId = await getUserCurrentApartmentId(uid, idToken); // גם זו קיימת אצלך
  if (!aptId) throw new Error('NO_APARTMENT_ON_PROFILE');
  return { uid, idToken, aptId };
}

// ✅ ודא שהכלל resource.data.apartment_id == currentUserApartmentId() יתקיים

/**
 * Wait for server to confirm user membership in apartment
 * This ensures deterministic behavior by checking server state directly
 */
export async function waitForMembership(uid: string, aptId: string, timeoutMs = 5000, intervalMs = 150): Promise<void> {
  const t0 = Date.now();
  console.log(`⏳ Waiting for membership confirmation: user ${uid} -> apartment ${aptId}`);
  
  while (true) {
    try {
      // Get fresh token to ensure we're not using cached data
      const idToken = await firebaseAuth.getCurrentIdToken();
      
      // Read user document directly from server (bypasses cache)
      if (!idToken) {
        throw new Error('No valid ID token available');
      }
      
      const userResponse = await fetch(`${FIRESTORE_BASE_URL}/users/${uid}`, {
        method: 'GET',
        headers: authHeaders(idToken),
      });
      
      if (userResponse.status === 200) {
        const userDoc = await userResponse.json();
        const serverAptId = userDoc.fields?.apartment?.mapValue?.fields?.id?.stringValue;
        
        console.log(`🔍 Membership check: server sees apartment ${serverAptId}, expecting ${aptId}`);
        
        if (serverAptId === aptId) {
          console.log('✅ Membership confirmed on server');
          return; // Ready!
        }
      } else {
        console.log(`⚠️ Membership check failed with status: ${userResponse.status}`);
      }
      
      // Check timeout
      if (Date.now() - t0 > timeoutMs) {
        throw new Error(`WAIT_MEMBERSHIP_TIMEOUT: Server did not confirm membership within ${timeoutMs}ms`);
      }
      
      // Wait before next check
      await new Promise(r => setTimeout(r, intervalMs));
      
    } catch (error) {
      console.error('❌ Error during membership check:', error);
      
      // Check timeout even on error
      if (Date.now() - t0 > timeoutMs) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`WAIT_MEMBERSHIP_TIMEOUT: ${errorMessage}`);
      }
      
      // Wait before retry
      await new Promise(r => setTimeout(r, intervalMs));
    }
  }
}
export async function ensureCurrentApartmentIdMatches(aptId: string): Promise<void> {
  const { uid, idToken } = await requireSession();

  // Read user document to verify apartment membership
  const res = await fetch(`${FIRESTORE_BASE_URL}/users/${uid}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error('USER_DOC_NOT_FOUND');

  const doc = await res.json();
  const current = doc?.fields?.apartment?.mapValue?.fields?.id?.stringValue ?? null;

  if (current !== aptId) {
    // Don't write anything - just report mismatch so caller knows to stop/refresh
    throw new Error('APARTMENT_CONTEXT_MISMATCH');
  }
}

// Firestore data types for REST API
export interface FirestoreValue {
  stringValue?: string;
  integerValue?: string;
  doubleValue?: number;
  booleanValue?: boolean;
  timestampValue?: string;
  arrayValue?: { values: FirestoreValue[] };
  mapValue?: { fields: { [key: string]: FirestoreValue } };
  nullValue?: null;
}

export interface FirestoreDocument {
  name: string;
  fields: { [key: string]: FirestoreValue };
  createTime: string;
  updateTime: string;
}

export interface FirestoreResponse {
  documents?: FirestoreDocument[];
  document?: FirestoreDocument;
}

/**
 * Firestore Database Service Class
 */
export class FirestoreService {
  private static instance: FirestoreService;

  private constructor() {}

  public static getInstance(): FirestoreService {
    if (!FirestoreService.instance) {
      FirestoreService.instance = new FirestoreService();
    }
    return FirestoreService.instance;
  }

  /**
   * Wait for authentication to be ready
   * This is crucial when using REST API instead of Firebase SDK
   */
  private async waitForAuth(maxWaitMs: number = 5000): Promise<void> {
    const startTime = Date.now();
    console.log('⏳ Waiting for authentication to be ready...');
    
    while (Date.now() - startTime < maxWaitMs) {
      const idToken = await firebaseAuth.getCurrentIdToken();
      if (idToken) {
        console.log('✅ Authentication is ready');
        return;
      }
      
      // Wait 100ms before checking again
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('⏰ Auth wait timeout reached');
    // Don't throw here, let the caller handle missing auth
  }

  /**
   * Get authenticated headers for requests
   */
  private async getAuthHeaders(): Promise<HeadersInit> {
    console.log('🔐 Getting auth headers...');
    
    // Wait for authentication to be ready
    await this.waitForAuth();
    
    // Check current user first
    const currentUser = await firebaseAuth.getCurrentUser();
    console.log('🧑‍💻 Current user:', currentUser ? `${currentUser.localId} (${currentUser.email})` : 'NULL');
    
    let idToken = await firebaseAuth.getCurrentIdToken();
    console.log('🔑 ID Token:', idToken ? `Present (${idToken.substring(0, 20)}...)` : 'MISSING');
    
    if (!idToken) {
      console.error('❌ Authentication failed: No ID token available');
      console.error('🔍 Debug info:');
      console.error('  - Current user object:', currentUser);
      console.error('  - This usually means the user needs to sign in again');
      throw new Error('User not authenticated - Please sign in again');
    }
    
    // Check if token is expired and try to refresh if needed
    try {
      const tokenParts = idToken.split('.');
      if (tokenParts.length === 3) {
        const payload = JSON.parse(safeBase64Decode(tokenParts[1]));
        const now = Math.floor(Date.now() / 1000);
        const buffer = 300; // 5 minutes buffer before expiry
        
        if (payload.exp < now + buffer) {
          console.log('🔄 Token is expiring soon, attempting refresh...');
          try {
            const newToken = await firebaseAuth.refreshToken();
            idToken = newToken;
            console.log('✅ Token refreshed successfully');
          } catch (refreshError) {
            console.error('❌ Token refresh failed:', refreshError);
            throw new Error('Token expired and refresh failed - Please sign in again');
          }
        }
      }
    } catch (tokenCheckError) {
      console.warn('⚠️ Could not check token expiry, proceeding with current token:', tokenCheckError);
    }

    // Validate token format
    try {
      const tokenParts = idToken.split('.');
      if (tokenParts.length !== 3) {
        throw new Error('Invalid token format');
      }
      
      // Decode header and payload for debugging (not verification)
      const header = JSON.parse(safeBase64Decode(tokenParts[0]));
      const payload = JSON.parse(safeBase64Decode(tokenParts[1]));
      
      console.log('🔍 Token info:', {
        algorithm: header.alg,
        type: header.typ,
        userId: payload.user_id || payload.sub,
        email: payload.email,
        expiresAt: new Date(payload.exp * 1000).toISOString(),
        issuedAt: new Date(payload.iat * 1000).toISOString()
      });
      
      // Check if token is expired
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp < now) {
        console.error('❌ Token is expired!');
        throw new Error('Token expired - Please sign in again');
      }
      
      // Verify the token is for the correct project
      const expectedProjectId = 'roomies-hub';
      const tokenProjectId = payload.aud || payload.firebase?.project_id;
      
      if (tokenProjectId !== expectedProjectId) {
        console.error(`❌ Token project mismatch! Expected: ${expectedProjectId}, Got: ${tokenProjectId}`);
        throw new Error(`Token is for wrong project (${tokenProjectId}). Expected: ${expectedProjectId}`);
      }
      
      console.log(`✅ Token project verified: ${tokenProjectId}`);
      
    } catch (tokenError) {
      console.error('❌ Token validation error:', tokenError);
      throw new Error('Invalid authentication token - Please sign in again');
    }

    const headers = {
      'Authorization': `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    };
    
    console.log('✅ Auth headers prepared successfully');
    return headers;
  }

  /**
   * Test authentication and permissions for invite lookup
   */
  async testInviteAccess(inviteCode: string): Promise<boolean> {
    try {
      console.log(`🔍 Testing access to invite code: ${inviteCode}`);
      
      // Get current auth state
      const currentUser = await firebaseAuth.getCurrentUser();
      const idToken = await firebaseAuth.getCurrentIdToken();
      
      console.log('🧑‍💻 Current user:', currentUser?.email);
      console.log('🔑 Token present:', !!idToken);
      
      if (!idToken) {
        console.error('❌ No ID token available');
        return false;
      }
      
      // Decode and validate token first
      try {
        const tokenParts = idToken.split('.');
        if (tokenParts.length === 3) {
          const payload = JSON.parse(safeBase64Decode(tokenParts[1]));
          console.log('🔍 Token details:', {
            aud: payload.aud,
            email: payload.email,
            exp: new Date(payload.exp * 1000).toISOString(),
            firebase: payload.firebase,
            projectId: payload.aud || payload.firebase?.project_id
          });
          
          // Check expiry
          const now = Math.floor(Date.now() / 1000);
          if (payload.exp < now) {
            console.error('❌ Token is expired!');
            return false;
          }
          
          // Check project ID
          const expectedProjectId = 'roomies-hub';
          const tokenProjectId = payload.aud || payload.firebase?.project_id;
          
          if (tokenProjectId !== expectedProjectId) {
            console.error(`❌ Token project mismatch! Expected: ${expectedProjectId}, Got: ${tokenProjectId}`);
            return false;
          }
        }
      } catch (tokenError) {
        console.error('❌ Failed to decode token:', tokenError);
        return false;
      }
      
      // Try direct REST API call to the invite document
      const url = `${FIRESTORE_BASE_URL}/${COLLECTIONS.APARTMENT_INVITES}/${inviteCode.trim().toUpperCase()}`;
      console.log('🌐 Testing URL:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
      });
      
      console.log(`📊 Test response: ${response.status} (${response.statusText})`);
      // console.log('📋 Response headers:', Object.fromEntries(response.headers.entries()));
      
      if (response.status === 200) {
        console.log('✅ Access test successful');
        const data = await response.json();
        console.log('📋 Invite data:', data);
        return true;
      } else if (response.status === 404) {
        console.log('📭 Invite code not found');
        return false;
      } else {
        console.error('❌ Access test failed');
        
        // Get detailed error information
        let errorData = {};
        try {
          errorData = await response.json();
        } catch (e) {
          console.error('❌ Could not parse error response');
        }
        
        console.error('📋 Error response:', errorData);
        
        // Log manual debugging steps
        console.error('🔧 Manual debugging steps:');
        console.error(`1. Run: node debug-auth.js "${idToken.substring(0, 50)}..."`);
        console.error('2. Test with cURL:');
        console.error(`   curl -i -H "Authorization: Bearer YOUR_TOKEN" "${url}"`);
        
        return false;
      }
      
    } catch (error) {
      console.error('❌ Test invite access error:', error);
      return false;
    }
  }

  /**
   * Convert JavaScript object to Firestore format
   */
  private toFirestoreFormat(data: any): { [key: string]: FirestoreValue } {
    const fields: { [key: string]: FirestoreValue } = {};

    for (const [key, value] of Object.entries(data)) {
      if (value === null || value === undefined) {
        fields[key] = { nullValue: null };
      } else if (typeof value === 'string') {
        // Detect ISO timestamp strings for fields like 'closed_at', 'created_at', etc.
        const isoLike = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
        const likelyTimestampField = /(_at$|date|time)/i.test(key);
        if (likelyTimestampField && isoLike.test(value)) {
          // Normalize to ISO
          fields[key] = { timestampValue: new Date(value).toISOString() };
        } else {
          fields[key] = { stringValue: value };
        }
      } else if (typeof value === 'number') {
        if (Number.isInteger(value)) {
          fields[key] = { integerValue: value.toString() };
        } else {
          fields[key] = { doubleValue: value };
        }
      } else if (typeof value === 'boolean') {
        fields[key] = { booleanValue: value };
      } else if (value instanceof Date) {
        fields[key] = { timestampValue: value.toISOString() };
      } else if (Array.isArray(value)) {
        fields[key] = {
          arrayValue: {
            values: value.map(item => this.toFirestoreFormat({ item }).item)
          }
        };
      } else if (typeof value === 'object') {
        fields[key] = {
          mapValue: {
            fields: this.toFirestoreFormat(value)
          }
        };
      }
    }

    return fields;
  }

  /**
   * Convert Firestore format to JavaScript object
   */
  private fromFirestoreFormat(fields: { [key: string]: FirestoreValue }): any {
    const data: any = {};

    for (const [key, value] of Object.entries(fields)) {
      if (value.stringValue !== undefined) {
        data[key] = value.stringValue;
      } else if (value.integerValue !== undefined) {
        data[key] = parseInt(value.integerValue);
      } else if (value.doubleValue !== undefined) {
        data[key] = value.doubleValue;
      } else if (value.booleanValue !== undefined) {
        data[key] = value.booleanValue;
      } else if (value.timestampValue !== undefined) {
        data[key] = new Date(value.timestampValue);
      } else if (value.arrayValue !== undefined) {
        data[key] = value.arrayValue.values?.map(item => 
          this.fromFirestoreFormat({ item })
        ) || [];
      } else if (value.mapValue !== undefined) {
        data[key] = this.fromFirestoreFormat(value.mapValue.fields);
      } else if (value.nullValue !== undefined) {
        data[key] = null;
      }
    }

    return data;
  }

  /**
   * Extract document ID from document name
   */
  private extractDocumentId(documentName: string): string {
    const parts = documentName.split('/');
    return parts[parts.length - 1];
  }

  /**
   * Create a document in a collection
   */
  async createDocument(collectionName: string, data: any, documentId?: string): Promise<any> {
    try {
      // Block deprecated apartmentMembers collection
      if (collectionName === 'apartmentMembers' || collectionName === COLLECTIONS.APARTMENT_MEMBERS) {
        throw new Error('apartmentMembers is deprecated. Use users/{uid}.apartment instead.');
      }
      
      console.log(`📝 Creating document in collection: ${collectionName}`);
      console.log(`📋 Document data:`, data);
      console.log(`🆔 Document ID:`, documentId || 'auto-generated');
      
      const headers = await this.getAuthHeaders();
      let url = `${FIRESTORE_BASE_URL}/${collectionName}`;
      
      if (documentId) {
        url += `?documentId=${documentId}`;
      }

      console.log('🌐 Request URL:', url);

      const requestBody = {
        fields: this.toFirestoreFormat(data)
      };
      console.log('📤 Request body fields:', Object.keys(requestBody.fields));

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      const responseData = await response.json();
      console.log(`📊 Response status: ${response.status} (${response.statusText})`);

      if (!response.ok) {
        console.error('❌ Create document failed!');
        console.error(`📂 Collection: ${collectionName}`);
        console.error(`🆔 Document ID: ${documentId || 'auto-generated'}`);
        console.error(`📋 Data: ${JSON.stringify(data, null, 2)}`);
        console.error(`📤 Request body: ${JSON.stringify(requestBody, null, 2)}`);
        console.error(`📨 Response: ${JSON.stringify(responseData, null, 2)}`);
        
        throw new Error(`Failed to create document in '${collectionName}': ${responseData.error?.message || 'Unknown error'}`);
      }

      const convertedData = this.fromFirestoreFormat(responseData.fields);
      const result = {
        id: this.extractDocumentId(responseData.name),
        ...convertedData
      };
      console.log('Document created successfully:', result);
      return result;
    } catch (error) {
      console.error('Create document error:', error);
      throw error;
    }
  }

  /**
   * Get a document by ID
   */
  async getDocument(collectionName: string, documentId: string): Promise<any | null> {
    try {
      console.log(`📖 Getting document: ${collectionName}/${documentId}`);
      
      const headers = await this.getAuthHeaders();
      const url = `${FIRESTORE_BASE_URL}/${collectionName}/${documentId}`;
      
      console.log('🌐 Request URL:', url);
      console.log('🔐 Headers:', {
        'Authorization': (headers as any).Authorization ? 'Bearer [TOKEN]' : 'MISSING',
        'Content-Type': (headers as any)['Content-Type']
      });

      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      console.log(`📊 Response status: ${response.status} (${response.statusText})`);

      if (response.status === 404) {
        console.log('📭 Document not found (404)');
        return null;
      }
      
      if (response.status === 403) {
        console.error('🔒 Permission denied (403)');
        // console.error('📋 Response headers:', Object.fromEntries(response.headers.entries()));
        
        // Try to get error details from response
        try {
          const errorData = await response.json();
          console.error('📋 Error response:', errorData);
        } catch (e) {
          console.error('📋 Could not parse error response');
        }
        
        // Explicitly map to a clear permission error for callers
        throw new Error('PERMISSION_DENIED');
      }

      const responseData = await response.json();

      if (!response.ok) {
        console.error('❌ Request failed:', responseData);
        throw new Error(`Failed to get document: ${responseData.error?.message || 'Unknown error'}`);
      }

      const convertedData = this.fromFirestoreFormat(responseData.fields);
      const result = {
        id: this.extractDocumentId(responseData.name),
        ...convertedData
      };
      
      console.log('✅ Document retrieved successfully');
      return result;
    } catch (error) {
      console.error('Get document error:', error);
      throw error;
    }
  }

  /**
   * Get all documents in a collection
   */
  async getCollection(collectionName: string): Promise<any[]> {
    try {
      console.log(`📂 Attempting to read collection: ${collectionName}`);
      
      const headers = await this.getAuthHeaders();
      const url = `${FIRESTORE_BASE_URL}/${collectionName}`;
      console.log(`🌐 Request URL: ${url}`);

      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      console.log(`📊 Response status: ${response.status} (${response.statusText})`);

      if (response.status === 404) {
        console.log(`📁 Collection '${collectionName}' doesn't exist yet, returning empty array`);
        return [];
      }
      if (response.status === 403) {
        throw new Error('PERMISSION_DENIED');
      }

      const responseData = await response.json();

      if (!response.ok) {
        console.error(`❌ Firestore error response:`, responseData);
        
        // Handle specific Firestore errors
        if (responseData.error?.status === 'NOT_FOUND') {
          console.log(`📁 Collection '${collectionName}' not found, returning empty array`);
          return [];
        }
        
        // This is likely a permissions issue
        if (responseData.error?.status === 'PERMISSION_DENIED') {
          console.error(`🚫 PERMISSION DENIED for collection '${collectionName}' - Check Firestore security rules!`);
          throw new Error(`Missing or insufficient permissions for collection '${collectionName}'. Check your Firestore security rules.`);
        }
        
        throw new Error(`Failed to get collection '${collectionName}': ${responseData.error?.message || 'Unknown error'}`);
      }

      if (!responseData.documents) {
        console.log(`📁 Collection '${collectionName}' exists but is empty`);
        return [];
      }

      const documents = responseData.documents.map((doc: FirestoreDocument) => ({
        id: this.extractDocumentId(doc.name),
        ...this.fromFirestoreFormat(doc.fields)
      }));
      
      console.log(`✅ Successfully retrieved ${documents.length} documents from '${collectionName}'`);
      return documents;
      
    } catch (error) {
      console.error(`❌ Get collection '${collectionName}' error:`, error);
      
      // If it's an authentication error, re-throw it instead of returning empty array
      if (error instanceof Error && error.message.includes('not authenticated')) {
        throw error;
      }
      
      // For other errors, log but return empty array to prevent app crashes
      console.warn(`⚠️ Returning empty array for collection '${collectionName}' due to error`);
      return [];
    }
  }

  /**
   * Update a document with optional updateMask support
   */
  async updateDocument(collectionName: string, documentId: string, data: any, updateMaskFields?: string[]): Promise<any> {
    try {
      const headers = await this.getAuthHeaders();
      let url = `${FIRESTORE_BASE_URL}/${collectionName}/${documentId}`;
      
      // Add updateMask to URL if specified
      if (updateMaskFields && updateMaskFields.length > 0) {
        const updateMaskParams = updateMaskFields.map(field => `updateMask.fieldPaths=${encodeURIComponent(field)}`).join('&');
        url += `?${updateMaskParams}`;
      }

      const requestBody = {
        fields: this.toFirestoreFormat(data)
      };

      console.log('🔍 PATCH request details:', {
        url,
        updateMaskFields,
        body: JSON.stringify(requestBody, null, 2)
      });

      const response = await fetch(url, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(requestBody),
      });

      const responseData = await response.json();

      if (!response.ok) {
        const errorMessage = responseData.error?.message || 'Unknown error';
        console.error('❌ Update document failed:', {
          status: response.status,
          error: errorMessage,
          url,
          data,
          updateMaskFields
        });
        throw new Error(`Failed to update document: ${errorMessage}`);
      }

      const convertedData = this.fromFirestoreFormat(responseData.fields || {});
      return {
        id: this.extractDocumentId(responseData.name),
        ...convertedData
      };
    } catch (error) {
      console.error('Update document error:', error);
      throw error;
    }
  }

  /**
   * Delete a document
   */
  async deleteDocument(collectionName: string, documentId: string): Promise<void> {
    try {
      const headers = await this.getAuthHeaders();
      const url = `${FIRESTORE_BASE_URL}/${collectionName}/${documentId}`;

      const response = await fetch(url, {
        method: 'DELETE',
        headers,
      });

      if (!response.ok) {
        const responseData = await response.json();
        throw new Error(`Failed to delete document: ${responseData.error?.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Delete document error:', error);
      throw error;
    }
  }

  /**
   * Query documents with simple filtering (using structured query)
   */
  async queryCollection(collectionName: string, field: string, operator: string, value: any): Promise<any[]> {
    try {
      const headers = await this.getAuthHeaders();
      const url = `${FIRESTORE_BASE_URL}:runQuery`;

      // Convert value to Firestore format
      const firestoreValue = this.toFirestoreFormat({ value }).value;

      const query = {
        structuredQuery: {
          from: [{ collectionId: collectionName }],
          where: {
            fieldFilter: {
              field: { fieldPath: field },
              op: operator,
              value: firestoreValue
            }
          }
        }
      };

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(query),
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(`Failed to query collection: ${responseData.error?.message || 'Unknown error'}`);
      }

      if (!responseData || !Array.isArray(responseData)) {
        return [];
      }

      return responseData
        .filter(item => item.document)
        .map((item: any) => ({
          id: this.extractDocumentId(item.document.name),
          ...this.fromFirestoreFormat(item.document.fields)
        }));
    } catch (error) {
      console.error('Query collection error:', error);
      throw error;
    }
  }

  /**
   * Test Firebase connection and authentication
   */
  async testConnection(): Promise<{success: boolean, details: any}> {
    try {
      console.log('🧪 Testing Firebase connection...');
      
      // Test 1: Check if we can get auth headers
      let authHeaders;
      try {
        authHeaders = await this.getAuthHeaders();
        console.log('✅ Authentication test passed');
      } catch (authError: any) {
        console.error('❌ Authentication test failed:', authError);
        return {
          success: false,
          details: {
            step: 'authentication',
            error: authError?.message || 'Authentication failed',
            recommendation: 'User needs to sign in again'
          }
        };
      }
      
      // Test 2: Try to access a simple collection that should be readable
      try {
        console.log('🔍 Testing Firestore access with current authentication...');
        const url = `${FIRESTORE_BASE_URL}/apartmentInvites`;
        
        const response = await fetch(url, {
          method: 'GET',
          headers: authHeaders,
        });
        
        console.log(`📊 Firestore response: ${response.status} (${response.statusText})`);
        
        const data = await response.json();
        
        if (response.ok) {
          console.log('✅ Firestore access test passed');
          const inviteCount = data.documents ? data.documents.length : 0;
          console.log(`📄 Found ${inviteCount} apartment invites`);
          
          return {
            success: true,
            details: {
              step: 'firestore_access',
              inviteCodesCount: inviteCount,
              availableCodes: data.documents?.map((doc: any) => doc.name.split('/').pop()) || []
            }
          };
        } else {
          console.error('❌ Firestore access test failed');
          console.error('Error response:', data);
          
          return {
            success: false,
            details: {
              step: 'firestore_access',
              status: response.status,
              error: data.error?.message || 'Unknown Firestore error',
              recommendation: response.status === 403 ? 
                'Check Firestore security rules' : 
                'Check Firebase project configuration'
            }
          };
        }
        
      } catch (networkError: any) {
        console.error('❌ Network test failed:', networkError);
        return {
          success: false,
          details: {
            step: 'network',
            error: networkError?.message || 'Network error',
            recommendation: 'Check internet connection and Firebase URLs'
          }
        };
      }
      
    } catch (error: any) {
      console.error('❌ Connection test failed:', error);
      return {
        success: false,
        details: {
          step: 'unknown',
          error: error?.message || 'Unknown error',
          recommendation: 'Contact support with this error message'
        }
      };
    }
  }

  // Specific methods for your app's collections

  /**
   * User management
   */
  async createUser(userData: {
    email: string;
    full_name: string;
    display_name?: string;
    phone?: string;
  }): Promise<any> {
    const user = await firebaseAuth.getCurrentUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Ensure no current_apartment_id in user creation (per security rules)
    // Store both full_name and display_name for consistency
    const cleanUserData = {
      email: userData.email,
      full_name: userData.full_name,
      display_name: userData.display_name || userData.full_name, // Use display_name if provided, otherwise use full_name
      ...(userData.phone && { phone: userData.phone })
    };

    console.log('🆕 Creating user with clean data (no apartment ID):', cleanUserData);
    return this.createDocument(COLLECTIONS.USERS, cleanUserData, user.localId);
  }

  async getUser(userId: string): Promise<any | null> {
    const result = await this.getDocument(COLLECTIONS.USERS, userId);
    if (!result) return null;
    
    // Ensure the result has the expected format
    return {
      id: result.id,
      email: result.email,
      full_name: result.full_name,
      display_name: result.display_name,
      displayName: result.displayName,
      name: result.name,
      phone: result.phone,
    };
  }

  async updateUser(userId: string, userData: { full_name?: string; phone?: string }): Promise<any> {
    return this.updateDocument(COLLECTIONS.USERS, userId, userData);
  }

  /**
   * Safe update user profile - only allows fields permitted by security rules
   * Ensures only full_name and phone can be updated (email and apartment are protected)
   */
  async updateUserProfile(userId: string, patch: { full_name?: string; phone?: string }): Promise<any> {
    const { idToken } = await requireSession();
    
    // Build payload with only allowed fields
    const payload: any = {};
    if (typeof patch.full_name === "string") {
      payload.full_name = patch.full_name;
    }
    if (typeof patch.phone === "string") {
      payload.phone = patch.phone;
    }
    
    // Ensure we have at least one field to update
    if (Object.keys(payload).length === 0) {
      throw new Error('No valid fields to update');
    }
    
    console.log('🔒 Safe profile update with only allowed fields:', payload);
    
    // Use updateMask to be explicit about what we're updating
    const updateMaskFields = Object.keys(payload);
    const url = `${FIRESTORE_BASE_URL}/users/${userId}?${updateMaskFields.map(field => `updateMask.fieldPaths=${field}`).join('&')}`;
    
    const response = await fetch(url, {
      method: 'PATCH',
      headers: { 
        Authorization: `Bearer ${idToken}`, 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({
        fields: this.toFirestoreFormat(payload)
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`UPDATE_PROFILE_${response.status}: ${errorText}`);
    }
    
    return await response.json();
  }

  /**
   * Apartment management - Works with Spark Plan (free)
   */
  async createApartment(apartmentData: {
    name: string;
    description?: string;
  }): Promise<any> {
    // First check if user is already in an apartment
    const currentUser = await firebaseAuth.getCurrentUser();
    if (!currentUser) {
      throw new Error('User not authenticated');
    }

    console.log('🏠 Checking if user already has an apartment...');
    const existingApartment = await this.getUserCurrentApartment(currentUser.localId);
    if (existingApartment) {
      console.log('⚠️ User already has an apartment:', existingApartment.name);
      throw new Error('You are already a member of an apartment. Leave your current apartment before creating a new one.');
    }

    const maxAttempts = 10;
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        console.log(`Creating apartment... (attempt ${attempts + 1}/${maxAttempts})`);
        
        // Generate unique invite code
        const inviteCode = await this.generateUniqueInviteCode();
        console.log('Generated invite code:', inviteCode);
        
        // Create apartment document first
        console.log('Creating apartment document...');
        const apartment = await this.createDocument(COLLECTIONS.APARTMENTS, {
          ...apartmentData,
          invite_code: inviteCode,
        });
        
        console.log('Apartment created:', apartment);
        
        // Now try to create the invite record with the real apartment ID
        const inviteData = {
          apartment_id: apartment.id,
          apartment_name: apartmentData.name,
          invite_code: inviteCode,
          created_at: new Date(),
        };
        
        console.log('Creating invite record...');
        console.log(`📋 Invite data:`, inviteData);
        console.log(`🆔 Document ID: ${inviteCode}`);
        console.log(`🌐 Target URL: ${FIRESTORE_BASE_URL}/${COLLECTIONS.APARTMENT_INVITES}/${inviteCode}`);
        
        try {
          const inviteResult = await this.createDocument(COLLECTIONS.APARTMENT_INVITES, inviteData, inviteCode);
          console.log('✅ Invite record created successfully:', inviteResult);
          
          // Immediately test if we can read it back
          console.log('🧪 Testing immediate read-back of invite...');
          try {
            const readBackResult = await this.getDocument(COLLECTIONS.APARTMENT_INVITES, inviteCode);
            if (readBackResult) {
              console.log('✅ Invite read-back successful:', readBackResult);
            } else {
              console.warn('⚠️ Invite read-back returned null (possible consistency delay)');
            }
          } catch (readBackError) {
            console.error('❌ Invite read-back failed:', readBackError);
          }
          
          // Set creator as member of the apartment using transaction
          console.log('👤 Setting creator as member of apartment...');
          await runTransaction(db, async (transaction) => {
            const userRef = doc(db, 'users', currentUser.localId);
            const userDoc = await transaction.get(userRef);
            
            if (!userDoc.exists()) {
              throw new Error('User document not found');
            }
            
            const currentApartmentId = userDoc.data()?.apartment?.id;
            if (currentApartmentId && currentApartmentId !== null) {
              throw new Error('User is already a member of an apartment');
            }
            
            // Update user's apartment: null -> apartmentId
            transaction.update(userRef, {
              'apartment.id': apartment.id,
              'apartment.role': 'member'
            });
            
            console.log('✅ Creator apartment set in transaction');
          });
          console.log('✅ Creator membership created successfully');
          
          // Success! Return the apartment with creator already as member
          return apartment;
        } catch (inviteError: any) {
          const message = String(inviteError?.message || inviteError || 'Unknown invite creation error');
          const isCollision = message.includes('ALREADY_EXISTS') || message.includes('already exists') || message.includes('collision');

          console.warn('Invite record creation failed:', message);

          // Always cleanup the apartment we just created to avoid orphans
          try {
            await this.deleteDocument(COLLECTIONS.APARTMENTS, apartment.id);
            console.log('Apartment cleaned up after invite failure');
          } catch (cleanupError) {
            console.error('Failed to cleanup apartment after invite failure:', cleanupError);
          }

          if (isCollision) {
            // Retry loop will handle trying again with a fresh code
            throw new Error('Invite code collision detected');
          } else {
            // Non-retryable error (e.g., permissions). Bubble up to stop the loop immediately.
            throw new Error(`Invite creation failed: ${message}`);
          }
        }
        
      } catch (error: any) {
        const message = String(error?.message || error || 'Unknown error');
        console.error(`Create apartment error (attempt ${attempts + 1}):`, message);

        // Only retry on explicit collision
        if (message.includes('Invite code collision detected')) {
          attempts++;
          if (attempts >= maxAttempts) {
            throw new Error(`Failed to create apartment after ${maxAttempts} attempts: ${message}`);
          }
          // Wait a bit before retrying with a new code
          await new Promise(resolve => setTimeout(resolve, 100 * attempts));
          continue;
        }

        // For non-retryable errors, stop immediately
        throw new Error(`Failed to create apartment: ${message}`);
      }
    }
    
    throw new Error('Failed to create apartment: Maximum attempts reached');
  }

  async getApartment(apartmentId: string): Promise<any | null> {
    return this.getDocument(COLLECTIONS.APARTMENTS, apartmentId);
  }

  async getApartmentByInviteCode(inviteCode: string): Promise<any | null> {
    try {
      console.log(`🔍 Searching for apartment with invite code: "${inviteCode}"`);
      console.log(`📏 Code length: ${inviteCode.length} characters`);
      console.log(`🔤 Code format: ${inviteCode} (uppercase: ${inviteCode.toUpperCase()})`);
      
      // Normalize the invite code (trim whitespace and convert to uppercase)
      const normalizedCode = inviteCode.trim().toUpperCase();
      console.log(`🔧 Normalized code: "${normalizedCode}"`);
      
      // Test authentication and access first
      console.log('🧪 Testing invite access...');
      const hasAccess = await this.testInviteAccess(normalizedCode);
      
      if (!hasAccess) {
        console.error('❌ Invite access test failed');
        
        // Additional debugging: check if document exists at all
        if (typeof (global as any).debugFirestore !== 'undefined') {
          console.log('🔍 Checking if invite document exists...');
          try {
            const exists = await (global as any).debugFirestore.checkInviteExists(normalizedCode);
            if (exists === false) {
              console.error('📭 ISSUE FOUND: Invite document does not exist in Firestore!');
              console.error(`❓ Make sure invite code "${normalizedCode}" was created correctly`);
            } else if (exists === true) {
              console.error('🔒 Document exists but authentication failed');
              console.error('❓ This is likely an authentication/permission issue');
            }
          } catch (debugError) {
            console.error('🔍 Debug check failed:', debugError);
          }
        }
        
        console.error('❌ No access to invite code - this could be due to:');
        console.error('  1. Invalid or expired ID token');
        console.error('  2. User not authenticated');
        console.error('  3. Firestore rules blocking access');
        console.error('  4. Wrong project ID in token');
        console.error('  5. Invite code does not exist');
        throw new Error('PERMISSION_DENIED: Unable to access invite code. Please check authentication.');
      }
      
      // If test passed, proceed with normal lookup
      console.log(`📊 Looking up invite record in collection: ${COLLECTIONS.APARTMENT_INVITES}`);
      const inviteRecord = await this.getDocument(COLLECTIONS.APARTMENT_INVITES, normalizedCode);
      console.log('📋 Invite record found:', !!inviteRecord);
      if (!inviteRecord) return null;
      
      console.log('📋 Invite record details:', inviteRecord);
      
      // Now get the actual apartment using the apartment_id from the invite record
      console.log(`🏠 Looking up apartment ID: ${inviteRecord.apartment_id}`);
      const apartment = await this.getApartment(inviteRecord.apartment_id);
      console.log('🏠 Apartment found via invite lookup:', !!apartment);
      
      if (apartment) {
        // Ensure the invite code matches (double check)
        if (apartment.invite_code === normalizedCode) {
          console.log(`✅ Apartment found and verified: ${apartment.name} (ID: ${apartment.id})`);
          return apartment;
        } else {
          console.warn(`⚠️ Invite code mismatch! Expected: "${normalizedCode}", Found: "${apartment.invite_code}"`);
          return null;
        }
      }
      
      console.log(`❌ Apartment with ID ${inviteRecord.apartment_id} not found`);
      return null;
      
    } catch (error: any) {
      console.error(`❌ Get apartment by invite code error for "${inviteCode}":`, error);
      
      // Enhanced error handling with more specific messages
      const message = String(error?.message || '');
      
      if (message.includes('PERMISSION_DENIED')) {
        // Already logged detailed error info above
        throw error;
      }
      
      if (message.includes('not authenticated')) {
        throw new Error('User not authenticated - Please sign in again');
      }
      
      // No fallback scans per security policy
      return null;
    }
  }

  /**
   * Apartment members management
   */
  async joinApartment(apartmentId: string, userId: string): Promise<any> {
    try {
      console.log(`🤝 Adding user ${userId} to apartment ${apartmentId}`);
      
      // Ensure the current user is the one being added (security rule requirement)
      const currentUser = await firebaseAuth.getCurrentUser();
      if (!currentUser || currentUser.localId !== userId) {
        throw new Error('User can only add themselves to apartments');
      }

      // Use transaction to ensure atomicity: null -> someId only
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', userId);
        const userDoc = await transaction.get(userRef);
        
        if (!userDoc.exists()) {
          throw new Error('User document not found');
        }
        
        const currentApartmentId = userDoc.data()?.apartment?.id;
        if (currentApartmentId && currentApartmentId !== null) {
          throw new Error('User is already a member of an apartment');
        }
        
        // Update user's apartment: null -> apartmentId (only apartment field)
        // Note: Security rules will check exists(/apartments/{id}) automatically
        transaction.set(userRef, { 
          apartment: { id: apartmentId } 
        }, { merge: true });
        
        console.log('✅ User apartment updated in transaction');
      });
      
      // Return minimal apartment object with ID
      return { id: apartmentId };
    } catch (error) {
      console.error('❌ Join apartment error:', error);
      throw error;
    }
  }

  /**
   * Join apartment using invite code - Works with Spark Plan (free)
   * Fixed implementation with proper REST API calls
   */
  async joinApartmentByInviteCode(inviteCode: string): Promise<any> {
    try {
      console.log('🔗 Joining apartment with code:', inviteCode);
      
      // Refresh token before first protected write
      await refreshTokenIfNeeded();
      
      // Get current user and token
      const currentUser = await firebaseAuth.getCurrentUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }
      
      const idToken = await firebaseAuth.getCurrentIdToken();
      if (!idToken) {
        throw new Error('No valid ID token available');
      }
      
      console.log('👤 Current user ID:', currentUser.localId);
      
      // 1. Get invite document
      const invite = await this.getInviteDocument(inviteCode, idToken);
      console.log('📋 Found invite:', invite);
      
      // 2. Use transaction to join apartment: null -> someId only
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', currentUser.localId);
        const userDoc = await transaction.get(userRef);
        
        if (!userDoc.exists()) {
          throw new Error('User document not found');
        }
        
        const currentApartmentId = userDoc.data()?.apartment?.id;
        if (currentApartmentId && currentApartmentId !== null) {
          throw new Error('User is already a member of an apartment');
        }
        
        // Update user's apartment: null -> apartmentId (only apartment field)
        // Note: Security rules will check exists(/apartments/{id}) automatically
        transaction.set(userRef, { 
          apartment: { id: invite.apartmentId } 
        }, { merge: true });
        
        console.log('✅ User apartment updated in transaction');
      });
      
      // 3. Wait for server to confirm membership before proceeding
      console.log('⏳ Waiting for server to confirm membership...');
      await waitForMembership(currentUser.localId, invite.apartmentId);
      
      // 4. Return minimal object with ID
      console.log('✅ Successfully joined apartment:', invite.apartmentId);
      return { id: invite.apartmentId };
      
    } catch (error) {
      console.error('❌ Join apartment error:', error);
      throw error;
    }
  }

  /**
   * Get invite document by code
   */
  private async getInviteDocument(code: string, idToken: string): Promise<any> {
    const inviteCode = String(code).trim().toUpperCase();
    const url = `${FIRESTORE_BASE_URL}/apartmentInvites/${encodeURIComponent(inviteCode)}`;
    
    console.log('🔍 Fetching invite document:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
    });
    
    console.log(`📊 Invite response: ${response.status} (${response.statusText})`);
    
    if (response.status === 200) {
      const doc = await response.json();
      const fields = doc.fields || {};
      return {
        apartmentId: fields.apartment_id?.stringValue as string,
        apartmentName: fields.apartment_name?.stringValue as string,
        inviteCode: fields.invite_code?.stringValue as string,
      };
    }
    
    if (response.status === 404) {
      throw new Error('קוד דירה לא נמצא. וודא שהקוד נכון ושהדירה קיימת.');
    }
    
    if (response.status === 403) {
      throw new Error('PERMISSION_DENIED_INVITE_READ');
    }
    
    throw new Error(`UNEXPECTED_${response.status}`);
  }

  // Deprecated: createMembershipDocument removed - now using transactions with users/{uid}.apartment

  // Deprecated: setCurrentApartment removed - now using transactions with users/{uid}.apartment

  /**
   * Get apartment members via users collection (new model: users.apartment.id == apartmentId)
   */
  async getApartmentMembers(apartmentId: string): Promise<any[]> {
    try {
      console.log('👥 Getting apartment members for:', apartmentId);
      
      const idToken = await firebaseAuth.getCurrentIdToken();
      if (!idToken) {
        throw new Error('No valid ID token available');
      }
      
      // Get current user ID from token
      const currentUser = await firebaseAuth.getCurrentUser();
      if (!currentUser) {
        throw new Error('No current user available');
      }
      
      // Query users collection where users.apartment.id == apartmentId
      const url = `${FIRESTORE_BASE_URL}:runQuery`;
      const body = {
        structuredQuery: {
          from: [{ collectionId: COLLECTIONS.USERS }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'apartment.id' },
              op: 'EQUAL',
              value: { stringValue: apartmentId }
            }
          }
        }
      };
      
      console.log('📋 Query URL:', url);
      console.log('📝 Query body:', JSON.stringify(body, null, 2));
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      
      console.log(`📊 Members query response: ${response.status} (${response.statusText})`);
      
      if (response.status !== 200) {
        throw new Error(`USERS_QUERY_${response.status}`);
      }
      
      const rows = await response.json();
      console.log('📋 Raw query results:', rows);
      
      const members = rows
        .map((row: any) => row.document)
        .filter(Boolean)
        .map((doc: any) => {
          const fields = doc.fields || {};
          const uid = doc.name.split('/').pop();
          return {
            id: uid,
            apartment_id: apartmentId,
            user_id: uid,
            role: fields?.apartment?.mapValue?.fields?.role?.stringValue || 'member',
            joined_at: null,
          };
        });
      
      console.log('✅ Found members:', members);
      return members;
      
    } catch (error) {
      console.error('❌ Error getting apartment members:', error);
      throw error;
    }
  }

  /**
   * Get user profiles by UIDs (batch operation)
   */
  async getUsersByIds(uids: string[]): Promise<Record<string, any>> {
    try {
      const uniq = Array.from(new Set((uids || []).filter(Boolean)));
      if (uniq.length === 0) {
        console.log('📭 No UIDs provided for batch get');
        return {};
      }
      
      console.log('👤 Getting user profiles for UIDs:', uniq);
      
      const idToken = await firebaseAuth.getCurrentIdToken();
      if (!idToken) {
        throw new Error('No valid ID token available');
      }
      
      // Must use resource names, not full URLs:
      const documents = uniq.map(
        (uid) => `projects/roomies-hub/databases/(default)/documents/users/${uid}`
      );
      
      const url = `${FIRESTORE_BASE_URL}:batchGet`;
      const body = { documents };
      
      console.log('📋 Batch get URL:', url);
      console.log('📝 Batch get body:', JSON.stringify(body, null, 2));
      
      const response = await fetch(url, {
        method: 'POST',
        headers: authHeaders(idToken),
        body: JSON.stringify(body),
      });
      
      console.log(`📊 Batch get response: ${response.status} (${response.statusText})`);
      
      if (!response.ok) {
        const txt = await response.text().catch(() => '');
        console.error('❌ Batch get failed:', { url, status: response.status, txt });
        throw new Error(`BATCH_GET_USERS_${response.status}${txt ? `: ${txt}` : ''}`);
      }
      
      const items = await response.json();
      console.log('📋 Raw batch get results:', items);
      
      const userMap: Record<string, any> = {};
      
      for (const item of items) {
        const doc = item.found;
        if (!doc) continue;
        
        const name: string = doc.name; // "projects/.../documents/users/<UID>"
        const uid = name.split('/').pop()!;
        const fields = doc.fields || {};
        
        userMap[uid] = {
          id: uid,
          email: fields.email?.stringValue,
          full_name: fields.full_name?.stringValue,
          display_name: fields.display_name?.stringValue,
          displayName: fields.displayName?.stringValue,
          name: fields.name?.stringValue,
        };
        
        console.log(`👤 User profile for ${uid}:`, {
          email: fields.email?.stringValue,
          full_name: fields.full_name?.stringValue,
          display_name: fields.display_name?.stringValue,
        });
      }
      
      console.log('✅ User profiles loaded:', Object.keys(userMap));
      return userMap;
      
    } catch (error) {
      console.error('❌ Error getting user profiles:', error);
      throw error;
    }
  }

  /**
   * Get user's current apartment ID from apartment.id field
   * This replaces the old current_apartment_id field approach
   */
  async ensureCurrentApartmentId(userId: string, fallbackApartmentId: string | null): Promise<string | null> {
    try {
      console.log('🔧 Getting apartment ID for user from apartment.id field:', userId);
      
      const idToken = await firebaseAuth.getCurrentIdToken();
      if (!idToken) {
        console.log('❌ No valid ID token available');
        return null;
      }
      
      // Step 1: Read user profile
      console.log('📋 Step 1: Reading user profile...');
      const userResponse = await fetch(`${FIRESTORE_BASE_URL}/users/${userId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (userResponse.status === 200) {
        const userDoc = await userResponse.json();
        const currentApartmentId = userDoc.fields?.apartment?.mapValue?.fields?.id?.stringValue || null;
        
        console.log('📋 Current apartment ID in profile:', currentApartmentId);
        
        // Return the apartment ID if it exists
        if (currentApartmentId) {
          console.log('✅ Found apartment ID in user profile');
          return currentApartmentId;
        }
        
        // If no apartment ID found, return null (user not in any apartment)
        console.log('📭 User is not in any apartment');
        return null;
      }
      
      // If user document doesn't exist, return null
      if (userResponse.status === 404) {
        console.log('📭 User document not found');
        return null;
      }
      
      console.log('📭 Could not get apartment ID from user profile');
      return null;
      
    } catch (error) {
      console.error('❌ Error getting apartment ID:', error);
      return null;
    }
  }

  /**
   * Get reliable apartment ID for the current user
   * First tries from user profile apartment.id field
   */
  async getReliableApartmentId(userId: string): Promise<string | null> {
    try {
      console.log('🔍 Getting reliable apartment ID for user:', userId);
      
      const idToken = await firebaseAuth.getCurrentIdToken();
      if (!idToken) {
        console.log('❌ No valid ID token available');
        return null;
      }
      
      // Step 1: Try from user profile
      console.log('📋 Step 1: Checking user profile for apartment.id...');
      const userResponse = await fetch(`${FIRESTORE_BASE_URL}/users/${userId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (userResponse.status === 200) {
        const userDoc = await userResponse.json();
        const apartmentId = userDoc.fields?.apartment?.mapValue?.fields?.id?.stringValue;
        if (apartmentId) {
          console.log('✅ Found apartment ID in user profile:', apartmentId);
          return apartmentId;
        }
      }
      
      console.log('📭 No apartment ID in user profile');
      return null;
      
    } catch (error) {
      console.error('❌ Error getting reliable apartment ID:', error);
      return null;
    }
  }

  /**
   * Get apartment members with full user profiles
   * Returns array of members with their profiles
   */
  async getApartmentMembersWithProfiles(apartmentId: string): Promise<any[]> {
    try {
      console.log('👥 Getting apartment members with profiles for:', apartmentId);
      
      // Use direct query instead of batchGet to avoid permission issues
      // Query users collection where users.apartment.id == apartmentId with full profiles
      const idToken = await firebaseAuth.getCurrentIdToken();
      if (!idToken) {
        throw new Error('No valid ID token available');
      }
      
      const url = `${FIRESTORE_BASE_URL}:runQuery`;
      const body = {
        structuredQuery: {
          from: [{ collectionId: COLLECTIONS.USERS }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'apartment.id' },
              op: 'EQUAL',
              value: { stringValue: apartmentId }
            }
          }
          // No select clause - get all fields to match SDK behavior
        }
      };
      
      console.log('📋 Query URL:', url);
      console.log('📝 Query body:', JSON.stringify(body, null, 2));
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      
      console.log(`📊 Members with profiles query response: ${response.status} (${response.statusText})`);
      
      if (response.status !== 200) {
        throw new Error(`USERS_QUERY_${response.status}`);
      }
      
      const rows = await response.json();
      console.log('📋 Raw query results:', rows);
      
      const membersWithProfiles = rows
        .filter((row: any) => row.document)
        .map((row: any) => {
          const doc = row.document;
          const fields = doc.fields || {};
          
          // Extract user ID from document name
          const nameParts = doc.name.split('/');
          const userId = nameParts[nameParts.length - 1];
          
          // Build profile object (convert from Firestore format)
          const profile = {
            id: userId,
            full_name: fields.full_name?.stringValue || '',
            display_name: fields.display_name?.stringValue || '',
            email: fields.email?.stringValue || '',
            phone: fields.phone?.stringValue || '',
          };
          
          // Build membership object
          const membership = {
            user_id: userId,
            apartment_id: apartmentId,
            role: fields.apartment?.mapValue?.fields?.role?.stringValue || 'member',
          };
          
          return {
            ...membership,
            profile
          };
        });
      
      console.log('✅ Members with profiles:', membersWithProfiles);
      return membersWithProfiles;
      
    } catch (error) {
      console.error('❌ Error getting apartment members with profiles:', error);
      throw error;
    }
  }

  /**
   * Get complete apartment data with members
   * This is the main function to use for getting apartment data
   */
  async getCompleteApartmentData(): Promise<any | null> {
    try {
      // Get session first - this ensures we have valid uid and idToken
      const { uid, idToken } = await requireSession();
      console.log('🏠 Getting complete apartment data for user:', uid);
      
      // 1. Get reliable apartment ID
      const apartmentId = await this.getReliableApartmentId(uid);
      if (!apartmentId) {
        console.log('📭 No apartment found for user');
        return null;
      }
      
      console.log('✅ Found apartment ID:', apartmentId);
      
      // 2. Get apartment details
      console.log('🏠 Getting apartment details for:', apartmentId);
      const apartment = await this.getApartment(apartmentId);
      
      // 3. Get members with profiles
      const membersWithProfiles = await this.getApartmentMembersWithProfiles(apartmentId);
      
      // 4. Combine everything
      const completeData = {
        ...apartment,
        members: membersWithProfiles.map(member => {
          // For apartment members, use actual registered names from the database
          const actualName = member.profile.display_name || 
                            member.profile.displayName || 
                            member.profile.full_name || 
                            member.profile.name || 
                            member.profile.email || 
                            'משתמש';
          
          const memberData = {
            id: member.user_id,
            email: member.profile.email || '',
            name: actualName,
            display_name: actualName, // Add for consistency
            role: member.role,
            apartment_id: apartmentId,
          };
          
          console.log(`👥 Member data for ${member.user_id}:`, {
            email: memberData.email,
            name: memberData.name,
            profileEmail: member.profile.email,
          });
          
          return memberData;
        })
      };
      
      console.log('✅ Complete apartment data:', completeData);
      return completeData;
      
    } catch (error) {
      console.error('❌ Error getting complete apartment data:', error);
      return null;
    }
  }

  async leaveApartment(apartmentId: string, userId: string): Promise<void> {
    try {
      console.log(`👋 User ${userId} leaving apartment ${apartmentId}`);
      
      // Use transaction to clear users/{uid}.apartment: someId -> null
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', userId);
        const userDoc = await transaction.get(userRef);
        
        if (!userDoc.exists()) {
          throw new Error('User document not found');
        }
        
        const currentApartmentId = userDoc.data()?.apartment?.id;
        if (!currentApartmentId || currentApartmentId !== apartmentId) {
          throw new Error('User is not a member of this apartment');
        }
        
        // Update user's apartment: someId -> null
        transaction.update(userRef, {
          'apartment.id': null,
          'apartment.role': null
        });
        
        console.log('✅ User apartment cleared in transaction');
      });
      
    } catch (error) {
      console.error('❌ Leave apartment error:', error);
      throw error;
    }
  }

  /**
   * Remove a member from apartment with balance validation
   * Only allows removal if user has zero balance and no open debts
   */
  async removeApartmentMember(apartmentId: string, targetUserId: string, actorUserId: string): Promise<void> {
    const { idToken } = await requireSession();
    
    try {
      console.log(`🗑️ Removing member ${targetUserId} from apartment ${apartmentId} by ${actorUserId}`);
      
      // First, check if the user can be removed (balance validation)
      const balanceData = await this.getUserBalanceForRemoval(targetUserId, apartmentId);
      
      if (!balanceData.canBeRemoved) {
        const errorMessage = balanceData.hasOpenDebts 
          ? 'לא ניתן להסיר שותף עם חובות פתוחים'
          : `לא ניתן להסיר שותף עם מאזן של ${balanceData.netBalance.toFixed(2)}₪`;
        throw new Error(errorMessage);
      }
      
      // Use transaction to clear users/{uid}.apartment: someId -> null
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, 'users', targetUserId);
        const userDoc = await transaction.get(userRef);
        
        if (!userDoc.exists()) {
          throw new Error('User document not found');
        }
        
        const currentApartmentId = userDoc.data()?.apartment?.id;
        if (!currentApartmentId || currentApartmentId !== apartmentId) {
          throw new Error('User is not a member of this apartment');
        }
        
        // Update user's apartment: someId -> null
        transaction.update(userRef, {
          'apartment.id': null,
          'apartment.role': null
        });
        
        console.log('✅ User apartment cleared in transaction');
      });
      
      // Step 3: Clean up all references to the removed member
      await this.cleanupRemovedMember(apartmentId, targetUserId, actorUserId);
      
      // Step 4: Log the removal action for audit trail (optional, doesn't block)
      await this.logMemberRemovalAction(apartmentId, targetUserId, actorUserId);
      
      console.log('✅ Member removed successfully');
      
    } catch (error) {
      console.error('❌ Remove apartment member error:', error);
      throw error;
    }
  }

  /**
   * Clean up all references to a removed member
   * This prevents "ghost" references in highlights, cleaning rotation, etc.
   */
  private async cleanupRemovedMember(apartmentId: string, removedUserId: string, actorUserId: string): Promise<void> {
    try {
      console.log(`🧹 Cleaning up references to removed member ${removedUserId}`);
      
      // 1. Clean up cleaning rotation
      await this.cleanupCleaningRotation(apartmentId, removedUserId);
      
      // 2. Clean up balances document (optional - can keep for audit)
      await this.cleanupBalancesDocument(apartmentId, removedUserId);
      
      // 3. Clean up shopping list references
      await this.cleanupShoppingListReferences(apartmentId, removedUserId);
      
      // 4. Clean up expense references (convert UIDs to display names)
      await this.cleanupExpenseReferences(apartmentId, removedUserId);
      
      console.log('✅ Member cleanup completed');
      
    } catch (error) {
      console.error('⚠️ Error during member cleanup:', error);
      // Don't throw - cleanup is not critical for the main operation
    }
  }

  /**
   * Clean up cleaning rotation to remove the removed member
   */
  private async cleanupCleaningRotation(apartmentId: string, removedUserId: string): Promise<void> {
    try {
      const { idToken } = await requireSession();
      
      // Get current cleaning task
      const taskUrl = `${FIRESTORE_BASE_URL}/cleaningTasks/${apartmentId}`;
      const response = await fetch(taskUrl, {
        method: 'GET',
        headers: authHeaders(idToken),
      });
      
      if (!response.ok) {
        console.log('ℹ️ No cleaning task found, skipping rotation cleanup');
        return;
      }
      
      const taskDoc = await response.json();
      const fields = taskDoc.fields || {};
      
      // Get current rotation and index
      const rotation = fields.rotation?.arrayValue?.values?.map((v: any) => v.stringValue) || [];
      const currentIndex = parseInt(fields.current_index?.integerValue || '0');
      
      // Remove the removed user from rotation
      const newRotation = rotation.filter((uid: string) => uid !== removedUserId);
      
      // Adjust current index if needed
      let newIndex = currentIndex;
      if (newIndex >= newRotation.length) {
        newIndex = 0; // wrap-around
      } else if (newIndex > 0 && rotation[newIndex] === removedUserId) {
        // If the removed user was the current one, keep the same index
        // (the next person in line will be at the same index now)
      }
      
      // Update the cleaning task
      const updateUrl = `${FIRESTORE_BASE_URL}/cleaningTasks/${apartmentId}?updateMask.fieldPaths=rotation&updateMask.fieldPaths=current_index`;
      const updateResponse = await fetch(updateUrl, {
        method: 'PATCH',
        headers: authHeaders(idToken),
        body: JSON.stringify({
          fields: {
            rotation: {
              arrayValue: {
                values: newRotation.map((uid: string) => ({ stringValue: uid }))
              }
            },
            current_index: { integerValue: newIndex.toString() }
          }
        })
      });
      
      if (updateResponse.ok) {
        console.log('✅ Cleaning rotation updated, removed member cleaned up');
      } else {
        console.error('⚠️ Failed to update cleaning rotation');
      }
      
    } catch (error) {
      console.error('⚠️ Error cleaning up cleaning rotation:', error);
    }
  }

  /**
   * Clean up balances document (optional - can keep for audit trail)
   */
  private async cleanupBalancesDocument(apartmentId: string, removedUserId: string): Promise<void> {
    try {
      const { idToken } = await requireSession();
      
      // Delete the balances document for the removed user
      const balanceUrl = `${FIRESTORE_BASE_URL}/balances/${apartmentId}/users/${removedUserId}`;
      const response = await fetch(balanceUrl, {
        method: 'DELETE',
        headers: authHeaders(idToken),
      });
      
      if (response.ok) {
        console.log('✅ Balances document deleted for removed member');
      } else if (response.status === 404) {
        console.log('ℹ️ No balances document found for removed member');
      } else {
        console.error('⚠️ Failed to delete balances document');
      }
      
    } catch (error) {
      console.error('⚠️ Error cleaning up balances document:', error);
    }
  }

  /**
   * Clean up shopping list references
   */
  private async cleanupShoppingListReferences(apartmentId: string, removedUserId: string): Promise<void> {
    try {
      const { idToken } = await requireSession();
      
      // Query shopping list items that reference the removed user
      const queryBody = {
        structuredQuery: {
          from: [{ collectionId: 'shoppingList' }],
          where: {
            compositeFilter: {
              op: 'AND',
              filters: [
                {
                  fieldFilter: {
                    field: { fieldPath: 'apartment_id' },
                    op: 'EQUAL',
                    value: { stringValue: apartmentId }
                  }
                },
                {
                  compositeFilter: {
                    op: 'OR',
                    filters: [
                      {
                        fieldFilter: {
                          field: { fieldPath: 'added_by_user_id' },
                          op: 'EQUAL',
                          value: { stringValue: removedUserId }
                        }
                      },
                      {
                        fieldFilter: {
                          field: { fieldPath: 'purchased_by_user_id' },
                          op: 'EQUAL',
                          value: { stringValue: removedUserId }
                        }
                      }
                    ]
                  }
                }
              ]
            }
          }
        }
      };
      
      const response = await fetch(`${FIRESTORE_BASE_URL}:runQuery`, {
        method: 'POST',
        headers: authHeaders(idToken),
        body: JSON.stringify(queryBody),
      });
      
      if (!response.ok) {
        console.log('ℹ️ No shopping list items found for removed member');
        return;
      }
      
      const data = await response.json();
      const items = data.map((row: any) => row.document).filter(Boolean);
      
      // Update items to remove references to the removed user
      for (const item of items) {
        const itemId = item.name.split('/').pop();
        const fields = item.fields || {};
        
        // Update added_by_user_id to show "Unknown" or remove
        if (fields.added_by_user_id?.stringValue === removedUserId) {
          const updateUrl = `${FIRESTORE_BASE_URL}/shoppingList/${itemId}?updateMask.fieldPaths=added_by_user_id`;
          await fetch(updateUrl, {
            method: 'PATCH',
            headers: authHeaders(idToken),
            body: JSON.stringify({
              fields: {
                added_by_user_id: { stringValue: 'unknown' }
              }
            })
          });
        }
        
        // Update purchased_by_user_id to show "Unknown" or remove
        if (fields.purchased_by_user_id?.stringValue === removedUserId) {
          const updateUrl = `${FIRESTORE_BASE_URL}/shoppingList/${itemId}?updateMask.fieldPaths=purchased_by_user_id`;
          await fetch(updateUrl, {
            method: 'PATCH',
            headers: authHeaders(idToken),
            body: JSON.stringify({
              fields: {
                purchased_by_user_id: { stringValue: 'unknown' }
              }
            })
          });
        }
      }
      
      if (items.length > 0) {
        console.log(`✅ Updated ${items.length} shopping list items for removed member`);
      } else {
        console.log('ℹ️ No shopping list items found for removed member');
      }
      
    } catch (error) {
      console.error('⚠️ Error cleaning up shopping list references:', error);
    }
  }

  /**
   * Clean up expense references by converting UIDs to display names
   * This prevents "לא ידוע" from appearing in expense history
   */
  private async cleanupExpenseReferences(apartmentId: string, removedUserId: string): Promise<void> {
    try {
      const { idToken } = await requireSession();
      
      // Get the removed user's display name before cleanup
      const userResponse = await fetch(`${FIRESTORE_BASE_URL}/users/${removedUserId}`, {
        method: 'GET',
        headers: authHeaders(idToken),
      });
      
      let displayName = 'משתמש שהוסר';
      if (userResponse.ok) {
        const userDoc = await userResponse.json();
        const fields = userDoc.fields || {};
        displayName = fields.display_name?.stringValue || 
                     fields.full_name?.stringValue || 
                     fields.name?.stringValue || 
                     'משתמש שהוסר';
      }
      
      console.log(`🔄 Converting expense references for removed user: ${displayName}`);
      
      // Query expenses that reference the removed user
      const queryBody = {
        structuredQuery: {
          from: [{ collectionId: 'expenses' }],
          where: {
            compositeFilter: {
              op: 'AND',
              filters: [
                {
                  fieldFilter: {
                    field: { fieldPath: 'apartment_id' },
                    op: 'EQUAL',
                    value: { stringValue: apartmentId }
                  }
                },
                {
                  compositeFilter: {
                    op: 'OR',
                    filters: [
                      {
                        fieldFilter: {
                          field: { fieldPath: 'paid_by_user_id' },
                          op: 'EQUAL',
                          value: { stringValue: removedUserId }
                        }
                      },
                      {
                        fieldFilter: {
                          field: { fieldPath: 'created_by' },
                          op: 'EQUAL',
                          value: { stringValue: removedUserId }
                        }
                      }
                    ]
                  }
                }
              ]
            }
          }
        }
      };
      
      const response = await fetch(`${FIRESTORE_BASE_URL}:runQuery`, {
        method: 'POST',
        headers: authHeaders(idToken),
        body: JSON.stringify(queryBody),
      });
      
      if (!response.ok) {
        console.log('ℹ️ No expenses found for removed member');
        return;
      }
      
      const data = await response.json();
      const expenses = data.map((row: any) => row.document).filter(Boolean);
      
      // Update expenses to use display name instead of UID
      for (const expense of expenses) {
        const expenseId = expense.name.split('/').pop();
        const fields = expense.fields || {};
        
        // Update paid_by_user_id to display name
        if (fields.paid_by_user_id?.stringValue === removedUserId) {
          const updateUrl = `${FIRESTORE_BASE_URL}/expenses/${expenseId}?updateMask.fieldPaths=paid_by_user_id&updateMask.fieldPaths=paid_by_display_name`;
          await fetch(updateUrl, {
            method: 'PATCH',
            headers: authHeaders(idToken),
            body: JSON.stringify({
              fields: {
                paid_by_user_id: { stringValue: displayName },
                paid_by_display_name: { stringValue: displayName }
              }
            })
          });
        }
        
        // Update created_by to display name
        if (fields.created_by?.stringValue === removedUserId) {
          const updateUrl = `${FIRESTORE_BASE_URL}/expenses/${expenseId}?updateMask.fieldPaths=created_by&updateMask.fieldPaths=created_by_display_name`;
          await fetch(updateUrl, {
            method: 'PATCH',
            headers: authHeaders(idToken),
            body: JSON.stringify({
              fields: {
                created_by: { stringValue: displayName },
                created_by_display_name: { stringValue: displayName }
              }
            })
          });
        }
      }
      
      if (expenses.length > 0) {
        console.log(`✅ Updated ${expenses.length} expenses for removed member: ${displayName}`);
      } else {
        console.log('ℹ️ No expenses found for removed member');
      }
      
    } catch (error) {
      console.error('⚠️ Error cleaning up expense references:', error);
    }
  }

  /**
   * Log member removal action for audit trail
   */
  private async logMemberRemovalAction(apartmentId: string, removedUserId: string, actorUserId: string): Promise<void> {
    try {
      const { idToken } = await requireSession();
      
      const actionData = {
        fields: {
          apartment_id: { stringValue: apartmentId },
          type: { stringValue: 'member_removed' },
          removed_user_id: { stringValue: removedUserId },
          actor_uid: { stringValue: actorUserId },
          created_at: { timestampValue: new Date().toISOString() },
          note: { stringValue: 'Member removed from apartment' }
        }
      };
      
      const response = await fetch(`${FIRESTORE_BASE_URL}/actions`, {
        method: 'POST',
        headers: authHeaders(idToken),
        body: JSON.stringify(actionData)
      });
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        console.error('⚠️ Could not log member removal action:', response.status, errorText);
      } else {
        console.log('✅ Member removal action logged');
      }
    } catch (error) {
      console.error('⚠️ Could not log member removal action:', error);
      // Don't throw - this is just a log, not critical for the operation
    }
  }

  // This function is replaced by the new getApartmentMembers that uses runQuery
  // Keeping for backward compatibility but it's deprecated
  // Deprecated: getApartmentMembersOld removed - now using users collection query

  // Deprecated: createMembershipDirectly removed - now using transactions with users/{uid}.apartment

  /**
   * Get user's current apartment based on user profile (new model: users/{uid}.apartment.id)
   */
  async getUserCurrentApartment(userId: string): Promise<any | null> {
    try {
      // Check if user is authenticated first
      const idToken = await firebaseAuth.getCurrentIdToken();
      if (!idToken) {
        console.log('No authentication token, skipping apartment lookup');
        return null;
      }

      console.log(`🔍 Looking for current apartment for user: ${userId}`);
      
      // Get user's profile to find their apartment.id
      const userData = await this.getDocument(COLLECTIONS.USERS, userId);
      
      if (!userData || !userData.apartment?.id) {
        console.log('📋 User has no apartment ID in profile');
        return null;
      }
      
      console.log(`🏠 User has apartment ID in profile: ${userData.apartment.id}`);
      
      // Get the apartment details
      return await this.getApartment(userData.apartment.id);
      
    } catch (error) {
      console.error('Get user current apartment error:', error);
      return null;
    }
  }

  /**
   * Generate unique 6-character invite code with database validation
   * Ensures uniqueness by checking against existing codes
   */
  async generateUniqueInviteCode(): Promise<string> {
    const maxAttempts = 50;
    let attempts = 0;

    while (attempts < maxAttempts) {
      // Generate code using timestamp + random for better uniqueness
      const timestamp = Date.now().toString(36).slice(-3);
      const random = Math.random().toString(36).slice(2, 5);
      const inviteCode = (timestamp + random).toUpperCase().slice(0, 6);
      
      // Ensure it's exactly 6 characters
      if (inviteCode.length < 6) {
        const padding = Math.random().toString(36).slice(2, 8 - inviteCode.length);
        const finalCode = (inviteCode + padding).toUpperCase().slice(0, 6);
        
        try {
          // Check if code already exists in apartmentInvites
          const existingDoc = await this.getDocument(COLLECTIONS.APARTMENT_INVITES, finalCode);
          if (!existingDoc) {
            console.log('Generated unique invite code:', finalCode);
            return finalCode;
          }
        } catch (error) {
          // If document doesn't exist (404), code is unique
          console.log('Generated unique invite code:', finalCode);
          return finalCode;
        }
      } else {
        try {
          // Check if code already exists
          const existingDoc = await this.getDocument(COLLECTIONS.APARTMENT_INVITES, inviteCode);
          if (!existingDoc) {
            console.log('Generated unique invite code:', inviteCode);
            return inviteCode;
          }
        } catch (error) {
          // If document doesn't exist (404), code is unique
          console.log('Generated unique invite code:', inviteCode);
          return inviteCode;
        }
      }
      
      attempts++;
      console.log(`Invite code attempt ${attempts}: ${inviteCode} already exists, trying again...`);
    }

    throw new Error('Unable to generate unique invite code after maximum attempts');
  }

  // ===== EXPENSES FUNCTIONS WITH APARTMENT CONTEXT =====

  /**
   * Add expense with apartment context
   */
  async addExpense(payload: {
    amount: number;
    category?: string;
    participants: string[]; // UIDs
    title?: string;
    note?: string;
  }): Promise<any> {
    const { uid, idToken, aptId } = await getApartmentContext();

    const body = {
      fields: {
        apartment_id: { stringValue: aptId },
        paid_by_user_id: { stringValue: uid },
        amount: { doubleValue: Number(payload.amount) },
        participants: { arrayValue: { values: (payload.participants || []).map(u => ({ stringValue: u })) } },
        category: payload.category ? { stringValue: payload.category } : undefined,
        title: payload.title ? { stringValue: payload.title } : undefined,
        note: payload.note ? { stringValue: payload.note } : undefined,
        created_at: { timestampValue: new Date().toISOString() },
      },
    };

    const res = await fetch(`${FIRESTORE_BASE_URL}/expenses`, {
      method: 'POST',
      headers: authHeaders(idToken),
      body: JSON.stringify(body),
    });
    
    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      throw new Error(`CREATE_EXPENSE_${res.status}: ${errorText}`);
    }
    
    return await res.json();
  }

  /**
   * Update expense by ID with transaction support
   */
  async updateExpense(expenseId: string, payload: {
    amount?: number;
    category?: string;
    participants?: string[]; // UIDs
    title?: string;
    note?: string;
  }): Promise<any> {
    const { idToken } = await getApartmentContext();

    // Use helper function to begin transaction with token refresh
    const { transactionId, refreshedToken: refreshedIdToken } = await beginTransactionWithRefresh();
    
    console.log('🚀 Expense update transaction started:', { expenseId });

    // First, get the current expense to calculate impact
    const currentExpenseRes = await fetch(`${FIRESTORE_BASE_URL}/expenses/${expenseId}`, {
      headers: authHeaders(refreshedIdToken),
    });
    
    if (!currentExpenseRes.ok) {
      throw new Error(`GET_EXPENSE_${currentExpenseRes.status}: Failed to get current expense`);
    }
    
    const currentExpense = await currentExpenseRes.json();
    const currentExpenseData = currentExpense.fields;

    try {
      // Prepare expense update with updateMask
      const updateFields: any = {};
      const fieldPaths: string[] = [];
      
      if (payload.amount !== undefined) {
        updateFields.amount = { doubleValue: Number(payload.amount) };
        fieldPaths.push('amount');
      }
      if (payload.participants !== undefined) {
        updateFields.participants = { arrayValue: { values: (payload.participants || []).map(u => ({ stringValue: u })) } };
        fieldPaths.push('participants');
      }
      if (payload.category !== undefined) {
        if (payload.category === null) {
          updateFields.category = { nullValue: null };
        } else {
          updateFields.category = { stringValue: payload.category };
        }
        fieldPaths.push('category');
      }
      if (payload.title !== undefined) {
        updateFields.title = payload.title === null ? { nullValue: null } : { stringValue: payload.title };
        fieldPaths.push('title');
      }
      if (payload.note !== undefined) {
        updateFields.note = payload.note === null ? { nullValue: null } : { stringValue: payload.note };
        fieldPaths.push('note');
      }

      // Always add updated_at timestamp and lastModifiedBy
      updateFields.updated_at = { timestampValue: new Date().toISOString() };
      updateFields.lastModifiedBy = { stringValue: (await getApartmentContext()).uid };
      fieldPaths.push('updated_at', 'lastModifiedBy');

      // Build resource name (projects/.../databases/(default)/documents/expenses/expenseId)
      const resourcePrefix = FIRESTORE_BASE_URL.replace(/^https?:\/\/[^/]+\/v1\//, '');
      const resourceName = `${resourcePrefix}/expenses/${expenseId}`;

      console.log('🔍 Transaction commit details:', {
        resourceName,
        fieldPaths,
        updateFields: Object.keys(updateFields),
        transactionId
      });

      // Update expense document
      const expenseUpdateBody = {
        writes: [{
          update: {
            name: resourceName,
            fields: updateFields,
          },
          updateMask: {
            fieldPaths
          },
          // Require that document exists at commit time (precondition)
          currentDocument: { exists: true }
        }],
        transaction: transactionId,
      };

      const expenseUpdateRes = await fetch(`${FIRESTORE_BASE_URL}/documents:commit`, {
        method: 'POST',
        headers: authHeaders(refreshedIdToken), // Use refreshed token for commit
        body: JSON.stringify(expenseUpdateBody),
      });

      if (!expenseUpdateRes.ok) {
        const errorText = await expenseUpdateRes.text().catch(() => '');
        console.error('❌ Transaction commit failed:', {
          status: expenseUpdateRes.status,
          error: errorText,
          resourceName,
          fieldPaths,
          transactionId
        });
        throw new Error(`UPDATE_EXPENSE_${expenseUpdateRes.status}: ${errorText}`);
      }

      // Create audit log entry
      const auditLogData = {
        fields: {
          expenseId: { stringValue: expenseId },
          action: { stringValue: 'update' },
          changes: { stringValue: JSON.stringify(payload) },
          previousData: { stringValue: JSON.stringify(currentExpenseData) },
          modifiedBy: { stringValue: (await getApartmentContext()).uid },
          timestamp: { timestampValue: new Date().toISOString() },
        }
      };

      const auditLogRes = await fetch(`${FIRESTORE_BASE_URL}/expense_audit_logs`, {
        method: 'POST',
        headers: authHeaders(refreshedIdToken), // Use refreshed token for audit log
        body: JSON.stringify(auditLogData),
      });

      if (!auditLogRes.ok) {
        console.warn(`AUDIT_LOG_${auditLogRes.status}: Failed to create audit log, but expense was updated`);
      }

      return await expenseUpdateRes.json();

    } catch (error) {
      // Rollback transaction on error
      try {
        await fetch(`${FIRESTORE_BASE_URL}/documents:rollback`, {
          method: 'POST',
          headers: authHeaders(refreshedIdToken), // Use refreshed token for rollback
          body: JSON.stringify({ transaction: transactionId }),
        });
      } catch (rollbackError) {
        console.error('Failed to rollback transaction:', rollbackError);
      }
      throw error;
    }
  }

  /**
   * Delete expense by ID
   */
  async deleteExpense(expenseId: string): Promise<void> {
    const { idToken } = await getApartmentContext();

    const res = await fetch(`${FIRESTORE_BASE_URL}/expenses/${expenseId}`, {
      method: 'DELETE',
      headers: authHeaders(idToken),
    });
    
    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      throw new Error(`DELETE_EXPENSE_${res.status}: ${errorText}`);
    }
  }

  /**
   * Get expenses for current apartment
   */
  async getExpenses(): Promise<any[]> {
    const { idToken, aptId } = await getApartmentContext();

    const queryBody = {
      structuredQuery: {
        from: [{ collectionId: 'expenses' }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'apartment_id' },
            op: 'EQUAL',
            value: { stringValue: aptId }
          }
        },
        orderBy: [{ field: { fieldPath: 'created_at' }, direction: 'DESCENDING' }],
        limit: 200
      }
    };

    const res = await fetch(`${FIRESTORE_BASE_URL}:runQuery`, {
      method: 'POST',
      headers: authHeaders(idToken),
      body: JSON.stringify(queryBody),
    });

    if (!res.ok) {
      throw new Error(`GET_EXPENSES_${res.status}`);
    }

    const data = await res.json();
    return data.map((row: any) => row.document).filter(Boolean);
  }

  /**
   * Get debt settlements for current apartment
   */
  async getDebtSettlements(): Promise<any[]> {
    const { idToken, aptId } = await getApartmentContext();

    const queryBody = {
      structuredQuery: {
        from: [{ collectionId: 'debtSettlements' }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'apartment_id' },
            op: 'EQUAL',
            value: { stringValue: aptId }
          }
        },
        orderBy: [{ field: { fieldPath: 'created_at' }, direction: 'DESCENDING' }],
        limit: 200
      }
    };

    const res = await fetch(`${FIRESTORE_BASE_URL}:runQuery`, {
      method: 'POST',
      headers: authHeaders(idToken),
      body: JSON.stringify(queryBody),
    });

    if (!res.ok) {
      throw new Error(`GET_DEBT_SETTLEMENTS_${res.status}`);
    }

    const data = await res.json();
    return data.map((row: any) => row.document).filter(Boolean);
  }

  // ===== DEBTS AND BALANCES FUNCTIONS =====

  // REMOVED: Old settleCalculatedDebt function that used REST API
  // Now using the new SDK-based function in store.ts

  /**
   * Get debts for current apartment
   * 
   * REQUIRES COMPOSITE INDEX:
   * Collection: debts
   * Fields: apartment_id (Ascending), created_at (Descending)
   */
  async getDebts(): Promise<any[]> {
    const { uid, idToken } = await requireSession();
    const apartmentId = await getUserCurrentApartmentId(uid, idToken);
    
    if (!apartmentId) {
      console.warn('⚠️ getDebts: No apartment ID found');
      return [];
    }

    // Validate apartmentId is not empty string
    if (apartmentId.trim() === '') {
      console.error('❌ getDebts: Empty apartment ID');
      return [];
    }

    // Validate apartmentId format and length
    if (apartmentId.length < 3) {
      console.error('❌ getDebts: Apartment ID too short:', apartmentId);
      return [];
    }

    const queryBody = {
      structuredQuery: {
        from: [{ collectionId: COLLECTIONS.DEBTS }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'apartment_id' },
            op: 'EQUAL',
            value: { stringValue: apartmentId }
          }
        },
        orderBy: [{ field: { fieldPath: 'created_at' }, direction: 'DESCENDING' }],
        limit: 100
      }
    };

    // Log the exact query being sent
    console.log('🔍 getDebts query body:', JSON.stringify(queryBody, null, 2));
    console.log('🔍 getDebts apartmentId:', { 
      value: apartmentId, 
      type: typeof apartmentId, 
      length: apartmentId.length,
      isEmpty: apartmentId.trim() === '',
      hasSpaces: apartmentId.includes(' ')
    });

    // Validate query structure matches expected format
    const expectedQuery = {
      structuredQuery: {
        from: [{ collectionId: 'debts' }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'apartment_id' },
            op: 'EQUAL',
            value: { stringValue: apartmentId }
          }
        },
        orderBy: [{ field: { fieldPath: 'created_at' }, direction: 'DESCENDING' }],
        limit: 100
      }
    };
    
    console.log('🔍 getDebts expected vs actual:');
    console.log('Expected collectionId:', expectedQuery.structuredQuery.from[0].collectionId);
    console.log('Actual collectionId:', queryBody.structuredQuery.from[0].collectionId);
    console.log('Expected fieldPath:', expectedQuery.structuredQuery.where.fieldFilter.field.fieldPath);
    console.log('Actual fieldPath:', queryBody.structuredQuery.where.fieldFilter.field.fieldPath);
    console.log('Expected orderBy fieldPath:', expectedQuery.structuredQuery.orderBy[0].field.fieldPath);
    console.log('Actual orderBy fieldPath:', queryBody.structuredQuery.orderBy[0].field.fieldPath);

    const res = await fetch(`${FIRESTORE_BASE_URL}:runQuery`, {
      method: 'POST',
      headers: authHeaders(idToken),
      body: JSON.stringify(queryBody),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      console.error('❌ getDebts failed:', res.status, errorText);
      
      if (res.status === 400) {
        console.error('❌ INDEX_ERROR: Debts query requires composite index:');
        console.error('   Collection: debts');
        console.error('   Fields: apartment_id (Ascending), created_at (Descending)');
        console.error('   Create this index in Firebase Console or wait for auto-creation');
        throw new Error('INDEX_REQUIRED');
      }
      
      throw new Error(`GET_DEBTS_${res.status}`);
    }

    const data = await res.json();
    console.log('✅ getDebts success, documents:', data.length);
    return data.map((row: any) => row.document).filter(Boolean);
  }

  /**
   * Close a debt by updating its status to 'closed'
   * Ensures apartment context matches rules and closed_at is a timestamp
   */




  /**
   * Create a debt and then close it atomically using Cloud Function
   * This uses the new approach with hidden expense settlement
   */
  async createAndCloseDebtAtomic(fromUserId: string, toUserId: string, amount: number, description?: string): Promise<{
    success: boolean;
    debtId: string;
    expenseId: string;
    closedAt: string;
    logId?: string;
  }> {
    try {
      const { uid, idToken } = await requireSession();
      const aptId = await getUserCurrentApartmentId(uid, idToken);
      
      if (!aptId) {
        throw new Error('APARTMENT_NOT_FOUND');
      }

      console.log('🔒 [createAndCloseDebtAtomic] Using new hidden expense approach:', { 
        fromUserId, 
        toUserId, 
        amount, 
        description,
        apartmentId: aptId,
        actorUid: uid 
      });

      // Simply create a hidden expense to balance the debt
      const monthKey = new Date().toISOString().substring(0, 7);
      const expenseId = `exp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      console.log('🔒 [createAndCloseDebtAtomic] Creating hidden expense:', {
        fromUserId,
        toUserId,
        amount,
        amountDoubled: amount * 2,
        apartmentId: aptId,
        monthKey,
        expenseId
      });
      
      // Create the hidden expense directly via REST API
      const expenseData = {
        fields: {
          apartment_id: { stringValue: aptId },
          amount: { doubleValue: amount * 2 }, // Double the debt amount for settlement
          title: { stringValue: `סגירת חוב - ${description || 'חוב'}` },
          paid_by_user_id: { stringValue: fromUserId }, // The debtor pays (as you requested)
          participants: { arrayValue: { values: [{ stringValue: fromUserId }, { stringValue: toUserId }] } },
          category: { stringValue: 'debt_settlement' },
          created_at: { timestampValue: new Date().toISOString() },
          created_by: { stringValue: uid },
          note: { stringValue: `HIDDEN_DEBT_SETTLEMENT_${fromUserId}_${toUserId}_${Date.now()}` } // Hidden marker
        }
      };

      const expenseUrl = `${FIRESTORE_BASE_URL}/expenses`;
      
      console.log('🔒 [createAndCloseDebtAtomic] Making request to:', expenseUrl);
      console.log('🔒 [createAndCloseDebtAtomic] Request data:', JSON.stringify(expenseData, null, 2));
      
      const expenseResponse = await fetch(expenseUrl, {
        method: 'POST',
        headers: authHeaders(idToken),
        body: JSON.stringify(expenseData)
      });

      console.log('🔒 [createAndCloseDebtAtomic] Response status:', expenseResponse.status);
      console.log('🔒 [createAndCloseDebtAtomic] Response headers:', Object.fromEntries(expenseResponse.headers.entries()));

      if (!expenseResponse.ok) {
        const errorText = await expenseResponse.text();
        console.error('❌ [createAndCloseDebtAtomic] Error response:', errorText);
        throw new Error(`Failed to create hidden expense: ${expenseResponse.status} - ${errorText}`);
      }

      // Now create a visible expense to show the debt settlement in the UI
      const visibleExpenseId = `exp_visible_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const visibleExpenseData = {
        fields: {
          apartment_id: { stringValue: aptId },
          amount: { doubleValue: 0 }, // Zero amount - just for display
          title: { stringValue: `סגירת חוב` },
          paid_by_user_id: { stringValue: fromUserId }, // The debtor
          participants: { arrayValue: { values: [{ stringValue: fromUserId }, { stringValue: toUserId }] } },
          category: { stringValue: 'debt_settlement' },
          created_at: { timestampValue: new Date().toISOString() },
          created_by: { stringValue: uid },
          note: { stringValue: `DEBT_SETTLEMENT_MESSAGE_${amount}` } // Special marker for debt settlement message
        }
      };

      const visibleExpenseResponse = await fetch(`${FIRESTORE_BASE_URL}/expenses`, {
        method: 'POST',
        headers: authHeaders(idToken),
        body: JSON.stringify(visibleExpenseData)
      });

      if (!visibleExpenseResponse.ok) {
        const errorText = await visibleExpenseResponse.text();
        console.error('❌ [createAndCloseDebtAtomic] Error creating visible expense:', errorText);
        // Don't throw error here - the hidden expense was created successfully
      }

      // Now we need to actually close the debt in Firestore and reset balances
      // This is the critical part that was missing!
      console.log('🔒 [createAndCloseDebtAtomic] Now closing debt in Firestore and resetting balances...');
      
      // Step 1: Find and close the actual debt document
      const debts = await this.getDebts();
      const existingDebt = debts.find(debt => 
        debt.from_user_id === fromUserId && 
        debt.to_user_id === toUserId && 
        debt.apartment_id === aptId &&
        debt.status !== 'closed'
      );
      
      let debtId = `virtual_debt_${Date.now()}`;
      
      if (existingDebt) {
        debtId = existingDebt.id;
        console.log('🔒 [createAndCloseDebtAtomic] Found existing debt, closing it:', debtId);
        
        // Close the debt by setting amount to 0 and status to closed
        // Use updateMask to only update allowed fields (path B in rules)
        const maskFields = ['status', 'closed_at', 'closed_by', 'amount', 'amount_cents'];
        const mask = maskFields
          .map(f => `updateMask.fieldPaths=${encodeURIComponent(f)}`)
          .join('&');
        
        const debtUpdateData = {
          fields: {
            status: { stringValue: 'closed' },
            closed_at: { timestampValue: new Date().toISOString() },
            closed_by: { stringValue: uid },
            amount: { doubleValue: 0 },
            amount_cents: { integerValue: '0' }
            // Don't send apartment_id/from_user_id/to_user_id - rules check they don't change
          }
        };
        
        const debtUpdateUrl = `${FIRESTORE_BASE_URL}/debts/${debtId}?${mask}`;
        const debtUpdateResponse = await fetch(debtUpdateUrl, {
          method: 'PATCH',
          headers: authHeaders(idToken),
          body: JSON.stringify(debtUpdateData)
        });
        
        if (!debtUpdateResponse.ok) {
          const errorText = await debtUpdateResponse.text();
          console.error('❌ [createAndCloseDebtAtomic] Error closing debt:', errorText);
          // Don't throw error - the expense was created successfully
        } else {
          console.log('✅ [createAndCloseDebtAtomic] Debt closed successfully in Firestore');
        }
      } else {
        console.log('🔒 [createAndCloseDebtAtomic] No existing debt found, creating virtual debt record');
      }
      
      // Step 2: Reset balances for both users
      console.log('🔒 [createAndCloseDebtAtomic] Resetting balances for both users...');
      
      // Reset balance for the debtor (fromUserId)
      const debtorBalanceData = {
        fields: {
          net: { doubleValue: 0 },
          has_open_debts: { booleanValue: false },
          updated_at: { timestampValue: new Date().toISOString() }
        }
      };
      
      const debtorBalanceUrl = `${FIRESTORE_BASE_URL}/balances/${aptId}/users/${fromUserId}`;
      const debtorBalanceResponse = await fetch(debtorBalanceUrl, {
        method: 'PATCH',
        headers: authHeaders(idToken),
        body: JSON.stringify(debtorBalanceData)
      });
      
      if (!debtorBalanceResponse.ok) {
        const errorText = await debtorBalanceResponse.text();
        console.error('❌ [createAndCloseDebtAtomic] Error resetting debtor balance:', errorText);
      } else {
        console.log('✅ [createAndCloseDebtAtomic] Debtor balance reset successfully');
      }
      
      // Reset balance for the creditor (toUserId)
      const creditorBalanceData = {
        fields: {
          net: { doubleValue: 0 },
          has_open_debts: { booleanValue: false },
          updated_at: { timestampValue: new Date().toISOString() }
        }
      };
      
      const creditorBalanceUrl = `${FIRESTORE_BASE_URL}/balances/${aptId}/users/${toUserId}`;
      const creditorBalanceResponse = await fetch(creditorBalanceUrl, {
        method: 'PATCH',
        headers: authHeaders(idToken),
        body: JSON.stringify(creditorBalanceData)
      });
      
      if (!creditorBalanceResponse.ok) {
        const errorText = await creditorBalanceResponse.text();
        console.error('❌ [createAndCloseDebtAtomic] Error resetting creditor balance:', errorText);
      } else {
        console.log('✅ [createAndCloseDebtAtomic] Creditor balance reset successfully');
      }

      const result = {
        success: true,
        debtId: debtId,
        expenseId: expenseId,
        closedAt: new Date().toISOString()
      };

      console.log('✅ [createAndCloseDebtAtomic] Debt settlement completed successfully:', result);
      
      return result as {
        success: boolean;
        debtId: string;
        expenseId: string;
        closedAt: string;
        logId?: string;
      };

    } catch (error: any) {
      console.error('❌ [createAndCloseDebtAtomic] Cloud Function failed:', error);
      
      // Handle Firebase Functions errors
      if (error.code) {
        switch (error.code) {
          case 'functions/permission-denied':
            throw new Error('PERMISSION_DENIED: User is not a member of this apartment');
          case 'functions/not-found':
            throw new Error('DEBT_NOT_FOUND: Debt not found');
          case 'functions/already-exists':
            throw new Error('ALREADY_CLOSED: Debt is already closed');
          case 'functions/invalid-argument':
            throw new Error('INVALID_ARGUMENT: ' + error.message);
          case 'functions/unauthenticated':
            throw new Error('AUTH_REQUIRED: User must be authenticated');
          default:
            throw new Error(`CLOUD_FUNCTION_ERROR: ${error.code} - ${error.message}`);
        }
      }
      
      throw error;
    }
  }

  /**
   * Settle debt by creating hidden expense using Cloud Function
   * This is the new approach that creates a hidden expense to balance the debt
   */
  async settleDebtByCreatingHiddenExpense(debtId: string): Promise<{ ok: boolean }> {
    try {
      const { uid, idToken } = await requireSession();
      const aptId = await getUserCurrentApartmentId(uid, idToken);
      
      if (!aptId) {
        throw new Error('APARTMENT_NOT_FOUND');
      }

      console.log('🔒 [settleDebtByCreatingHiddenExpense] Calling Cloud Function:', { 
        debtId,
        aptId,
        actorUid: uid 
      });

      // Import Firebase Functions
      const { getFunctions, httpsCallable } = await import('firebase/functions');
      const functions = getFunctions();
      
      // Call the Cloud Function
      const settleDebt = httpsCallable(functions, 'settleDebtByCreatingHiddenExpense');
      
      const result = await settleDebt({
        aptId,
        debtId
      });

      console.log('✅ [settleDebtByCreatingHiddenExpense] Cloud Function completed successfully:', result.data);
      
      return result.data as { ok: boolean };

    } catch (error: any) {
      console.error('❌ [settleDebtByCreatingHiddenExpense] Error:', error);
      
      // Handle specific Firebase Functions errors
      if (error.code) {
        switch (error.code) {
          case 'functions/unauthenticated':
            throw new Error('AUTHENTICATION_REQUIRED');
          case 'functions/not-found':
            throw new Error('DEBT_NOT_FOUND');
          case 'functions/failed-precondition':
            if (error.message === 'DEBT_ALREADY_CLOSED') {
              throw new Error('DEBT_ALREADY_CLOSED');
            } else if (error.message === 'DEBT_MALFORMED') {
              throw new Error('DEBT_MALFORMED');
            }
            throw new Error('DEBT_SETTLEMENT_FAILED');
          case 'functions/invalid-argument':
            throw new Error('INVALID_ARGUMENTS');
          case 'functions/internal':
            throw new Error('INTERNAL_SERVER_ERROR');
          default:
            throw new Error(`CLOUD_FUNCTION_ERROR: ${error.code}`);
        }
      }
      
      throw error;
    }
  }


  /**
   * Get actions for current apartment
   * 
   * REQUIRES COMPOSITE INDEX:
   * Collection: actions
   * Fields: apartment_id (Ascending), created_at (Descending)
   */
  async getActions(): Promise<any[]> {
    const { uid, idToken } = await requireSession();
    const apartmentId = await getUserCurrentApartmentId(uid, idToken);
    
    if (!apartmentId) {
      console.warn('⚠️ getActions: No apartment ID found');
      return [];
    }

    // Validate apartmentId is not empty string
    if (apartmentId.trim() === '') {
      console.error('❌ getActions: Empty apartment ID');
      return [];
    }

    // Validate apartmentId format and length
    if (apartmentId.length < 3) {
      console.error('❌ getActions: Apartment ID too short:', apartmentId);
      return [];
    }

    const queryBody = {
      structuredQuery: {
        from: [{ collectionId: COLLECTIONS.ACTIONS }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'apartment_id' },
            op: 'EQUAL',
            value: { stringValue: apartmentId }
          }
        },
        orderBy: [{ field: { fieldPath: 'created_at' }, direction: 'DESCENDING' }],
        limit: 50
      }
    };

    // Log the exact query being sent
    console.log('🔍 getActions query body:', JSON.stringify(queryBody, null, 2));
    console.log('🔍 getActions apartmentId:', { 
      value: apartmentId, 
      type: typeof apartmentId, 
      length: apartmentId.length,
      isEmpty: apartmentId.trim() === '',
      hasSpaces: apartmentId.includes(' ')
    });

    // Validate query structure matches expected format
    const expectedQuery = {
      structuredQuery: {
        from: [{ collectionId: 'actions' }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'apartment_id' },
            op: 'EQUAL',
            value: { stringValue: apartmentId }
          }
        },
        orderBy: [{ field: { fieldPath: 'created_at' }, direction: 'DESCENDING' }],
        limit: 50
      }
    };
    
    console.log('🔍 getActions expected vs actual:');
    console.log('Expected collectionId:', expectedQuery.structuredQuery.from[0].collectionId);
    console.log('Actual collectionId:', queryBody.structuredQuery.from[0].collectionId);
    console.log('Expected fieldPath:', expectedQuery.structuredQuery.where.fieldFilter.field.fieldPath);
    console.log('Actual fieldPath:', queryBody.structuredQuery.where.fieldFilter.field.fieldPath);
    console.log('Expected orderBy fieldPath:', expectedQuery.structuredQuery.orderBy[0].field.fieldPath);
    console.log('Actual orderBy fieldPath:', queryBody.structuredQuery.orderBy[0].field.fieldPath);

    const res = await fetch(`${FIRESTORE_BASE_URL}:runQuery`, {
      method: 'POST',
      headers: authHeaders(idToken),
      body: JSON.stringify(queryBody),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      console.error('❌ getActions failed:', res.status, errorText);
      
      if (res.status === 400) {
        console.error('❌ INDEX_ERROR: Actions query requires composite index:');
        console.error('   Collection: actions');
        console.error('   Fields: apartment_id (Ascending), created_at (Descending)');
        console.error('   Create this index in Firebase Console or wait for auto-creation');
        throw new Error('INDEX_REQUIRED');
      }
      
      throw new Error(`GET_ACTIONS_${res.status}`);
    }

    const data = await res.json();
    console.log('✅ getActions success, documents:', data.length);
    return data.map((row: any) => row.document).filter(Boolean);
  }



  /**
   * Get balance for a specific user in current apartment
   */
  async getUserBalance(userId: string): Promise<number> {
    const { uid, idToken } = await requireSession();
    const apartmentId = await getUserCurrentApartmentId(uid, idToken);
    
    if (!apartmentId) {
      console.warn('⚠️ getUserBalance: No apartment ID found');
      return 0;
    }

    // Validate apartmentId is not empty string
    if (apartmentId.trim() === '') {
      console.error('❌ getUserBalance: Empty apartment ID');
      return 0;
    }

    // Validate apartmentId format and length
    if (apartmentId.length < 3) {
      console.error('❌ getUserBalance: Apartment ID too short:', apartmentId);
      return 0;
    }

    try {
      const balanceDocUrl = `${FIRESTORE_BASE_URL}/balances/${apartmentId}/users/${userId}`;
      console.log('🔍 getUserBalance URL:', balanceDocUrl);
      
      const response = await fetch(balanceDocUrl, {
        method: 'GET',
        headers: authHeaders(idToken),
      });

      if (response.status === 404) {
        // Balance document doesn't exist yet, return 0
        console.log('ℹ️ getUserBalance: Balance document not found, returning 0');
        return 0;
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        console.error('❌ getUserBalance failed:', response.status, errorText);
        throw new Error(`GET_BALANCE_${response.status}`);
      }

      const balanceDoc = await response.json();
      const fields = balanceDoc.fields || {};
      const balance = parseFloat(fields.balance?.doubleValue || fields.balance?.integerValue || '0');
      console.log('✅ getUserBalance success:', { userId, balance });
      return balance;
    } catch (error) {
      console.error('❌ Error getting user balance:', error);
      return 0;
    }
  }

  /**
   * Get user balance data for member removal validation
   * Returns net balance and has_open_debts status
   */
  async getUserBalanceForRemoval(userId: string, apartmentId: string): Promise<{
    netBalance: number;
    hasOpenDebts: boolean;
    canBeRemoved: boolean;
  }> {
    const { idToken } = await requireSession();
    
    try {
      const balanceDocUrl = `${FIRESTORE_BASE_URL}/balances/${apartmentId}/users/${userId}`;
      console.log('🔍 getUserBalanceForRemoval URL:', balanceDocUrl);
      
      const response = await fetch(balanceDocUrl, {
        method: 'GET',
        headers: authHeaders(idToken),
      });

      if (response.status === 404) {
        // Balance document doesn't exist yet, assume no debts
        console.log('ℹ️ getUserBalanceForRemoval: Balance document not found, assuming no debts');
        return {
          netBalance: 0,
          hasOpenDebts: false,
          canBeRemoved: true
        };
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        console.error('❌ getUserBalanceForRemoval failed:', response.status, errorText);
        throw new Error(`GET_BALANCE_FOR_REMOVAL_${response.status}`);
      }

      const balanceDoc = await response.json();
      const fields = balanceDoc.fields || {};
      
      // Get net balance (prefer 'net' field, fallback to 'balance')
      const netBalance = parseFloat(
        fields.net?.doubleValue || 
        fields.net?.integerValue || 
        fields.balance?.doubleValue || 
        fields.balance?.integerValue || 
        '0'
      );
      
      // Get has_open_debts from balances collection (this is the source of truth)
      const hasOpenDebts = fields.has_open_debts?.booleanValue || false;
      
      // User can be removed if net balance is close to zero (±0.01) and no open debts
      const canBeRemoved = Math.abs(netBalance) <= 0.01 && !hasOpenDebts;
      
      console.log('✅ getUserBalanceForRemoval success:', { 
        userId, 
        netBalance, 
        hasOpenDebts, 
        canBeRemoved 
      });
      
      return {
        netBalance,
        hasOpenDebts,
        canBeRemoved
      };
    } catch (error) {
      console.error('❌ Error getting user balance for removal:', error);
      // In case of error, don't allow removal for safety
      return {
        netBalance: 0,
        hasOpenDebts: true,
        canBeRemoved: false
      };
    }
  }

  /**
   * Check if user has open debts by querying the debts collection
   */
  private async checkUserHasOpenDebts(userId: string, apartmentId: string): Promise<boolean> {
    const { idToken } = await requireSession();
    
    try {
      const queryBody = {
        structuredQuery: {
          from: [{ collectionId: COLLECTIONS.DEBTS }],
          where: {
            compositeFilter: {
              op: 'AND',
              filters: [
                {
                  fieldFilter: {
                    field: { fieldPath: 'apartment_id' },
                    op: 'EQUAL',
                    value: { stringValue: apartmentId }
                  }
                },
                {
                  fieldFilter: {
                    field: { fieldPath: 'status' },
                    op: 'EQUAL',
                    value: { stringValue: 'open' }
                  }
                },
                {
                  compositeFilter: {
                    op: 'OR',
                    filters: [
                      {
                        fieldFilter: {
                          field: { fieldPath: 'from_user_id' },
                          op: 'EQUAL',
                          value: { stringValue: userId }
                        }
                      },
                      {
                        fieldFilter: {
                          field: { fieldPath: 'to_user_id' },
                          op: 'EQUAL',
                          value: { stringValue: userId }
                        }
                      }
                    ]
                  }
                }
              ]
            }
          },
          limit: 1
        }
      };
      
      const response = await fetch(`${FIRESTORE_BASE_URL}:runQuery`, {
        method: 'POST',
        headers: authHeaders(idToken),
        body: JSON.stringify(queryBody),
      });

      if (!response.ok) {
        console.error('❌ checkUserHasOpenDebts failed:', response.status);
        return true; // Assume has debts for safety
      }

      const data = await response.json();
      const hasOpenDebts = data.length > 0;
      
      console.log('🔍 checkUserHasOpenDebts result:', { userId, hasOpenDebts });
      return hasOpenDebts;
      
    } catch (error) {
      console.error('❌ Error checking open debts:', error);
      return true; // Assume has debts for safety
    }
  }

  // ===== CLEANING TASKS FUNCTIONS WITH APARTMENT CONTEXT =====



  /**
   * Get or create cleaning task for current apartment
   */
  async getCleaningTask(aptId?: string): Promise<any | null> {
    try {
      const { uid, idToken } = await requireSession();
      const _aptId = aptId || await getUserCurrentApartmentId(uid, idToken);
      if (!_aptId) return null;

      await ensureCurrentApartmentIdMatches(_aptId);

      // קרא את המשימה (runQuery לפי apartment_id)
      const queryUrl = `${FIRESTORE_BASE_URL}:runQuery`;
      const qBody = {
        structuredQuery: {
          from: [{ collectionId: 'cleaningTasks' }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'apartment_id' },
              op: 'EQUAL',
              value: { stringValue: _aptId },
            },
          },
          limit: 1,
        },
      };
      const qRes = await fetch(queryUrl, { method: 'POST', headers: H(idToken), body: JSON.stringify(qBody) });
      if (!qRes.ok) {
        const text = await qRes.text().catch(() => '');
        console.error('Firestore getCleaningTask error:', qRes.status, text);
        throw new Error(`GET_CLEANING_TASK_${qRes.status}: ${text}`);
      }
      const rows = await qRes.json();
      const first = Array.isArray(rows) ? rows.find(r => r.document) : null;
      if (first?.document) {
        const doc = first.document;
        const f = doc.fields ?? {};
        const id = doc.name.split('/').pop();
        const task = {
          id,
          apartment_id: f.apartment_id?.stringValue ?? _aptId,
          user_id: f.user_id?.stringValue ?? null, // Current turn user
          queue: (f.rotation?.arrayValue?.values || f.queue?.arrayValue?.values || []).map((v: any) => v.stringValue),
          current_index: f.current_index?.integerValue ? Number(f.current_index.integerValue) : 0,
          assigned_at: f.assigned_at?.timestampValue ?? null,
          frequency_days: f.frequency_days?.integerValue ? Number(f.frequency_days.integerValue) : 7,
          last_completed_at: f.last_completed_at?.timestampValue ?? null,
          last_completed_by: f.last_completed_by?.stringValue ?? null,
        };
        
        console.log('🔍 Firestore task debug:', {
          taskId: task.id,
          currentUserId: task.user_id,
          queue: task.queue,
          apartmentId: task.apartment_id
        });
        
        return task;
      }

      // אין משימה קיימת → כל חבר יכול ליצור (לפי הכללים החדשים)
      try {
        return await this.createCleaningTask(_aptId);
      } catch (createError) {
        console.error('Failed to create cleaning task:', createError);
        return null;
      }
    } catch (e) {
      console.error('GET_CLEANING_TASK_ERROR', e);
      return null;
    }
  }

  /**
   * Create new cleaning task for apartment
   */
  async createCleaningTask(aptId: string): Promise<any> {
    const { uid, idToken } = await requireSession();
    await ensureCurrentApartmentIdMatches(aptId); // חשוב לכללים

    // docId = apartmentId (כמו שכללי Firestore דורשים)
    const url = `${FIRESTORE_BASE_URL}/cleaningTasks?documentId=${encodeURIComponent(aptId)}`;
    const body = {
      fields: {
        apartment_id: F.str(aptId),
        user_id: F.str(uid),                 // מי מתחיל (אפשר לשנות אח"כ)
        rotation: F.arrStr([uid]),           // תתחיל ממי שקיים כרגע
        assigned_at: F.ts(new Date()),
        frequency_days: F.int(7),
      },
    };

    const res = await fetch(url, { method: 'POST', headers: H(idToken), body: JSON.stringify(body) });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      // אם המסמך כבר קיים נקבל 409 — זה סבבה, פשוט נחזור לקריאה
      if (res.status !== 409) {
        console.error('Firestore createCleaningTask error:', res.status, text);
        throw new Error(`CREATE_CLEANING_TASK_${res.status}: ${text}`);
      }
    }
    return await res.json();
  }

  /**
   * Mark cleaning as completed and move to next person
   */
  async markCleaningCompleted(): Promise<any> {
    console.log('🔄 Starting markCleaningCompleted...');
    const { uid, idToken, aptId } = await getApartmentContext();
    console.log('✅ Got apartment context:', { uid, aptId });

    // Get current cleaning task
    const currentTask = await this.getCleaningTask();
    if (!currentTask) {
      throw new Error('No cleaning task found');
    }
    console.log('✅ Got cleaning task:', { 
      taskId: currentTask.id, 
      currentUserId: currentTask.user_id, 
      myUserId: uid,
      isMyTurn: currentTask.user_id === uid 
    });

    // Verify it's the current user's turn
    if (currentTask.user_id !== uid) {
      throw new Error('Not your turn to clean');
    }

    const queue = currentTask.queue || [];
    let currentIndex = currentTask.current_index || 0;

    // Move to next person
    currentIndex = (currentIndex + 1) % queue.length;

    const nextUserId = queue[currentIndex] || uid;
    const updateBody = {
      fields: {
        user_id: F.str(nextUserId), // מי התור הבא
        assigned_at: F.ts(new Date()), // עוגן למחזור הבא (קריטי)
        last_completed_at: F.ts(new Date()), // Mark completion time
        last_completed_by: F.str(uid), // Who completed the cleaning
      },
    };

    const fieldPaths = ['user_id', 'assigned_at', 'last_completed_at', 'last_completed_by'];
    const url = `${FIRESTORE_BASE_URL}/cleaningTasks/${aptId}?` + 
      fieldPaths.map(path => `updateMask.fieldPaths=${path}`).join('&');
    
    console.log('📝 Updating cleaning task with URL:', url);
    console.log('📋 Update body:', JSON.stringify(updateBody, null, 2));
    
    const res = await fetch(url, {
      method: 'PATCH',
      headers: H(idToken),
      body: JSON.stringify(updateBody),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('Firestore markCleaningCompleted error:', res.status, text);
      console.error('Request details:', { url, method: 'PATCH', body: updateBody });
      throw new Error(`UPDATE_CLEANING_TASK_${res.status}: ${text}`);
    }
    
    console.log('✅ Cleaning task updated successfully');

    // Update cleaning statistics counters
    await this.updateCleaningStats(uid);

    return await res.json();
  }

  /**
   * Update cleaning statistics counters using atomic increment
   */
  async updateCleaningStats(userId: string): Promise<void> {
    console.log('🔄 Updating cleaning stats for user:', userId);
    const { aptId, idToken } = await getApartmentContext();
    
    try {
      const statsUrl = `${FIRESTORE_BASE_URL}/apartments/${aptId}/stats/global`;
      
      // Use atomic increment with updateTransforms
      const updateBody = {
        fields: {
          // Required fields for the update (values are ignored due to transforms)
          totalCleans: F.int(0),
          perUser: F.map({
            [userId]: F.int(0)
          }),
          lastUpdated: F.ts(new Date()),
        },
        updateTransforms: {
          fieldTransforms: [
            {
              fieldPath: "totalCleans",
              increment: F.int(1)
            },
            {
              fieldPath: `perUser.${userId}`,
              increment: F.int(1)
            }
          ]
        }
      };

      const fieldPaths = ['totalCleans', 'perUser', 'lastUpdated'];
      const url = `${statsUrl}?currentDocument.exists=true&` + 
        fieldPaths.map(path => `updateMask.fieldPaths=${path}`).join('&');
      
      console.log('📊 Updating cleaning stats with atomic increment:', url);
      console.log('📋 Stats update body:', JSON.stringify(updateBody, null, 2));
      
      const res = await fetch(url, {
        method: 'PATCH',
        headers: H(idToken),
        body: JSON.stringify(updateBody),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.error('Firestore updateCleaningStats error:', res.status, text);
        
        // If document doesn't exist, try to create it first
        if (res.status === 404) {
          console.log('📊 Stats document doesn\'t exist, creating with initial values...');
          await this.createInitialCleaningStats(userId);
        } else {
          // Don't throw error here - stats update failure shouldn't break cleaning completion
          console.warn('⚠️ Failed to update cleaning stats, but cleaning was completed successfully');
        }
      } else {
        console.log('✅ Cleaning stats updated successfully with atomic increment');
      }
    } catch (error) {
      console.error('Error updating cleaning stats:', error);
      // Don't throw error here - stats update failure shouldn't break cleaning completion
      console.warn('⚠️ Failed to update cleaning stats, but cleaning was completed successfully');
    }
  }

  /**
   * Create initial cleaning stats document
   */
  async createInitialCleaningStats(userId: string): Promise<void> {
    console.log('🔄 Creating initial cleaning stats for user:', userId);
    const { aptId, idToken } = await getApartmentContext();
    
    try {
      const statsUrl = `${FIRESTORE_BASE_URL}/apartments/${aptId}/stats/global`;
      
      const createBody = {
        fields: {
          totalCleans: F.int(1),
          perUser: F.map({
            [userId]: F.int(1)
          }),
          lastUpdated: F.ts(new Date()),
        }
      };

      const fieldPaths = ['totalCleans', 'perUser', 'lastUpdated'];
      const url = `${statsUrl}?` + 
        fieldPaths.map(path => `updateMask.fieldPaths=${path}`).join('&');
      
      console.log('📊 Creating initial stats with URL:', url);
      console.log('📋 Initial stats body:', JSON.stringify(createBody, null, 2));
      
      const res = await fetch(url, {
        method: 'PATCH',
        headers: H(idToken),
        body: JSON.stringify(createBody),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.error('Firestore createInitialCleaningStats error:', res.status, text);
        console.warn('⚠️ Failed to create initial cleaning stats');
      } else {
        console.log('✅ Initial cleaning stats created successfully');
      }
    } catch (error) {
      console.error('Error creating initial cleaning stats:', error);
      console.warn('⚠️ Failed to create initial cleaning stats');
    }
  }

  /**
   * Get cleaning statistics
   */
  async getCleaningStats(): Promise<any> {
    console.log('🔄 Getting cleaning stats...');
    const { aptId, idToken } = await getApartmentContext();
    
    const url = `${FIRESTORE_BASE_URL}/apartments/${aptId}/stats/global`;
    
    const res = await fetch(url, {
      method: 'GET',
      headers: H(idToken),
    });

    if (!res.ok) {
      if (res.status === 404) {
        console.log('📊 No cleaning stats found, returning default values');
        return {
          totalCleans: 0,
          perUser: {},
          lastUpdated: null,
        };
      }
      
      const text = await res.text().catch(() => '');
      console.error('Firestore getCleaningStats error:', res.status, text);
      throw new Error(`GET_CLEANING_STATS_${res.status}: ${text}`);
    }
    
    const data = await res.json();
    console.log('✅ Cleaning stats retrieved successfully');
    
    // Convert Firestore format to our format
    return {
      totalCleans: data.fields?.totalCleans?.integerValue ? parseInt(data.fields.totalCleans.integerValue) : 0,
      perUser: data.fields?.perUser?.mapValue?.fields ? 
        Object.fromEntries(
          Object.entries(data.fields.perUser.mapValue.fields).map(([key, value]: [string, any]) => [
            key, 
            value.integerValue ? parseInt(value.integerValue) : 0
          ])
        ) : {},
      lastUpdated: data.fields?.lastUpdated?.timestampValue ? 
        new Date(data.fields.lastUpdated.timestampValue) : null,
    };
  }

  /**
   * Backfill cleaning stats from existing last_completed_at data
   * This is a one-time migration function
   */
  async backfillCleaningStats(): Promise<void> {
    console.log('🔄 Backfilling cleaning stats from existing data...');
    const { aptId, idToken } = await getApartmentContext();
    
    try {
      // Get current cleaning task
      const cleaningTask = await this.getCleaningTask();
      if (!cleaningTask) {
        console.log('📊 No cleaning task found, skipping backfill');
        return;
      }

      // Check if stats already exist
      const existingStats = await this.getCleaningStats();
      if (existingStats.totalCleans > 0) {
        console.log('📊 Cleaning stats already exist, skipping backfill');
        return;
      }

      // If we have last_completed_at, initialize with 1 cleaning
      if (cleaningTask.last_completed_at && cleaningTask.last_completed_by) {
        console.log('📊 Initializing stats with existing cleaning data');
        await this.createInitialCleaningStats(cleaningTask.last_completed_by);
      } else {
        console.log('📊 No existing cleaning data found, initializing with 0');
        await this.createInitialCleaningStats('');
      }
    } catch (error) {
      console.error('Error backfilling cleaning stats:', error);
    }
  }

  // ===== SHOPPING FUNCTIONS WITH APARTMENT CONTEXT =====

  /**
   * Add shopping item with apartment context
   */
  async addShoppingItem(
    name: string, 
    addedByUserId: string, 
    priority?: 'low' | 'normal' | 'high',
    quantity?: number,
    notes?: string
  ): Promise<any> {
    const { idToken, aptId } = await getApartmentContext();

    const body = {
      fields: {
        apartment_id: { stringValue: aptId },
        name: { stringValue: name },
        added_by_user_id: { stringValue: addedByUserId },
        priority: { stringValue: priority || 'normal' },
        quantity: { integerValue: quantity || 1 },
        notes: { stringValue: notes || '' },
        purchased: { booleanValue: false },
        created_at: { timestampValue: new Date().toISOString() },
        last_updated: { timestampValue: new Date().toISOString() },
      },
    };

    const res = await fetch(`${FIRESTORE_BASE_URL}/shoppingItems`, {
      method: 'POST',
      headers: H(idToken),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('Firestore addShoppingItem error:', res.status, text);
      throw new Error(`ADD_SHOPPING_ITEM_${res.status}: ${text}`);
    }

    return await res.json();
  }

  /**
   * Get shopping items for current apartment
   */
  async getShoppingItems(): Promise<any[]> {
    try {
      const { idToken, aptId } = await getApartmentContextSlim();
      await ensureCurrentApartmentIdMatches(aptId);

      const url = `${FIRESTORE_BASE_URL}:runQuery`; // שים לב: אין "/" בסוף!
      const body = {
        structuredQuery: {
          from: [{ collectionId: 'shoppingItems' }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'apartment_id' },
              op: 'EQUAL',
              value: { stringValue: aptId },
            },
          },
          orderBy: [
            { field: { fieldPath: 'purchased' }, direction: 'ASCENDING' },
            { field: { fieldPath: 'priority' }, direction: 'DESCENDING' },
            { field: { fieldPath: 'created_at' }, direction: 'DESCENDING' }
          ],
          limit: 200,
        },
      };

      const res = await fetch(url, { method: 'POST', headers: H(idToken), body: JSON.stringify(body) });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.error('Firestore getShoppingItems error:', res.status, text);
        return []; // לא מפיל את ה־UI
      }

      const rows = await res.json();
      const items = (rows || [])
        .filter((r: any) => r.document?.fields)
        .map((r: any) => {
          const doc = r.document;
          const f = doc.fields ?? {};
          const id = doc.name.split('/').pop();
          return {
            id,
            apartment_id: f.apartment_id?.stringValue ?? '',
            title: f.title?.stringValue ?? f.name?.stringValue ?? '',
            name: f.name?.stringValue ?? f.title?.stringValue ?? '',
            quantity: f.quantity?.integerValue ? Number(f.quantity.integerValue) : 1,
            priority: f.priority?.stringValue ?? 'normal',
            notes: f.notes?.stringValue ?? '',
            created_at: f.created_at?.timestampValue ?? null,
            purchased: !!f.purchased?.booleanValue,
            purchased_by_user_id: f.purchased_by_user_id?.stringValue ?? null,
            added_by_user_id: f.added_by_user_id?.stringValue ?? null,
            price: f.price?.doubleValue ? Number(f.price.doubleValue) : null,
            purchased_at: f.purchased_at?.timestampValue ?? null,
            last_updated: f.last_updated?.timestampValue ?? null,
          };
        });

      return items;
    } catch (e) {
      console.error('GET_SHOPPING_ITEMS_ERROR', e);
      return []; // תמיד מחזיר מערך ולא מפיל
    }
  }

  /**
   * Update shopping item with new fields
   */
  async updateShoppingItem(itemId: string, updates: {
    priority?: 'low' | 'normal' | 'high';
    quantity?: number;
    notes?: string;
    name?: string;
  }): Promise<any> {
    const { idToken, aptId } = await getApartmentContext();
    
    // Build update mask
    const updateMask = {
      fieldPaths: Object.keys(updates).filter(key => updates[key as keyof typeof updates] !== undefined)
    };

    // Build fields object
    const fields: any = {};
    if (updates.priority !== undefined) fields.priority = { stringValue: updates.priority };
    if (updates.quantity !== undefined) fields.quantity = { integerValue: updates.quantity };
    if (updates.notes !== undefined) fields.notes = { stringValue: updates.notes };
    if (updates.name !== undefined) fields.name = { stringValue: updates.name };
    
    // Always update last_updated
    fields.last_updated = { timestampValue: new Date().toISOString() };

    const body = {
      fields,
      updateMask
    };

    const res = await fetch(`${FIRESTORE_BASE_URL}/shoppingItems/${itemId}`, {
      method: 'PATCH',
      headers: H(idToken),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('Firestore updateShoppingItem error:', res.status, text);
      throw new Error(`UPDATE_SHOPPING_ITEM_${res.status}: ${text}`);
    }

    return await res.json();
  }

  /**
   * Delete shopping item from Firestore
   */
  async deleteShoppingItem(itemId: string): Promise<any> {
    const { idToken } = await getApartmentContext();

    const res = await fetch(`${FIRESTORE_BASE_URL}/shoppingItems/${itemId}`, {
      method: 'DELETE',
      headers: H(idToken),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('Firestore deleteShoppingItem error:', res.status, text);
      throw new Error(`DELETE_SHOPPING_ITEM_${res.status}: ${text}`);
    }

    return await res.json();
  }

  /**
   * Mark shopping item as purchased
   */
  async markShoppingItemPurchased(itemId: string, purchasedByUserId: string, price?: number): Promise<any> {
    const { idToken } = await getApartmentContext();

    const updateFields: any = {
      purchased: { booleanValue: true },
      purchased_by_user_id: { stringValue: purchasedByUserId },
      purchased_at: { timestampValue: new Date().toISOString() },
    };

    if (price !== undefined) {
      updateFields.price = { doubleValue: price };
    }

    const body = {
      fields: updateFields,
    };

    // Build URL with separate fieldPaths parameters
    const fieldPaths = ['purchased', 'purchased_by_user_id', 'purchased_at'];
    if (price !== undefined) {
      fieldPaths.push('price');
    }
    
    const url = `${FIRESTORE_BASE_URL}/shoppingItems/${itemId}?` + 
      fieldPaths.map(path => `updateMask.fieldPaths=${path}`).join('&');

    const res = await fetch(url, {
      method: 'PATCH',
      headers: H(idToken),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('Firestore markShoppingItemPurchased error:', res.status, text);
      throw new Error(`MARK_SHOPPING_ITEM_PURCHASED_${res.status}: ${text}`);
    }

    return await res.json();
  }

  // ===== CLEANING CHECKLIST FUNCTIONS =====

  // Idempotent checklist seeding configuration
  private readonly CHECKLIST_TEMPLATE_VERSION = 1;
  private readonly DEFAULT_CHECKLIST_TITLES: string[] = [
    'ניקוי מטבח',
    'שטיפת רצפות',
    'ניקוי שירותים',
    'פינוי אשפה',
    'אבק רהיטים',
  ];

  private slugifyChecklistTitle(input: string): string {
    return String(input)
      .normalize('NFKD')
      .replace(/\s+/g, '-')
      .replace(/[^\w\-]/g, '')
      .toLowerCase();
  }

  /**
   * Ensure checklist is seeded once per apartment (idempotent)
   */
  private async ensureChecklistSeeded(aptId: string, idToken: string): Promise<void> {
    try {
      // 1) Ensure cleaning task exists
      const taskUrl = `${FIRESTORE_BASE_URL}/cleaningTasks/${aptId}`;
      let taskRes = await fetch(taskUrl, { method: 'GET', headers: H(idToken) });
      if (taskRes.status === 404) {
        try {
          await this.createCleaningTask(aptId);
        } catch {}
        taskRes = await fetch(taskUrl, { method: 'GET', headers: H(idToken) });
      }

      if (!taskRes.ok) return; // skip silently
      const taskDoc = await taskRes.json().catch(() => null);
      const currentVersion = Number(taskDoc?.fields?.checklist_seed_version?.integerValue || 0);
      if (currentVersion >= this.CHECKLIST_TEMPLATE_VERSION) return; // already seeded

      // 2) Seed deterministic docs (upsert-like via documentId)
      for (let i = 0; i < this.DEFAULT_CHECKLIST_TITLES.length; i++) {
        const title = this.DEFAULT_CHECKLIST_TITLES[i];
        const deterministicId = `tpl_${this.slugifyChecklistTitle(title)}_${i}`;
        const colUrl = `${FIRESTORE_BASE_URL}/cleaningTasks/${aptId}/checklistItems?documentId=${encodeURIComponent(deterministicId)}`;
        const body = {
          fields: {
            title: { stringValue: title },
            apartment_id: { stringValue: aptId },
            cleaning_task_id: { stringValue: aptId },
            created_at: { timestampValue: new Date().toISOString() },
            template_key: { stringValue: deterministicId },
            completed: { booleanValue: false },
          }
        };
        const createRes = await fetch(colUrl, { method: 'POST', headers: H(idToken), body: JSON.stringify(body) });
        // If already exists (409) or created (200), continue. Otherwise log and continue.
        if (!createRes.ok && createRes.status !== 409) {
          try { console.warn('CHECKLIST_SEED_CREATE_SKIPPED', deterministicId, await createRes.text()); } catch {}
        }
      }

      // 3) Mark seed version on parent task
      const verPatchUrl = `${FIRESTORE_BASE_URL}/cleaningTasks/${aptId}?updateMask.fieldPaths=checklist_seed_version`;
      const verBody = { fields: { checklist_seed_version: { integerValue: String(this.CHECKLIST_TEMPLATE_VERSION) } } };
      await fetch(verPatchUrl, { method: 'PATCH', headers: H(idToken), body: JSON.stringify(verBody) }).catch(() => {});
    } catch (e) {
      // Non-fatal
      console.warn('ensureChecklistSeeded failed (non-fatal)', e);
    }
  }

  /**
   * Get all checklist items for current apartment (always all items)
   */
  async getCleaningChecklist(): Promise<ChecklistItem[]> {
    try {
      const { uid, idToken, aptId } = await getApartmentContext();
      
      // Ensure current apartment ID matches for security rules
      await ensureCurrentApartmentIdMatches(aptId);

      // Seed checklist once per apartment (idempotent, deterministic IDs)
      await this.ensureChecklistSeeded(aptId, idToken);

      const parentPath = `${FIRESTORE_BASE_URL}/cleaningTasks/${aptId}`;
      
      // Debug log before query
      console.log('🧪 checklist query ctx', { uid, aptId, current: await getUserCurrentApartmentId(uid, idToken) });
      
      // Query collection-group with required filters for security rules
      const body = {
        structuredQuery: {
          from: [{ collectionId: 'checklistItems', allDescendants: true }],
          where: {
            compositeFilter: {
              op: 'AND',
              filters: [
                { fieldFilter: { field: { fieldPath: 'apartment_id' },    op: 'EQUAL', value: { stringValue: aptId } } },
                { fieldFilter: { field: { fieldPath: 'cleaning_task_id' }, op: 'EQUAL', value: { stringValue: aptId } } },
              ],
            },
          },
          orderBy: [{ field: { fieldPath: 'created_at' }, direction: 'DESCENDING' }],
          limit: 200,
        }
      };

      const url = `${FIRESTORE_BASE_URL}:runQuery`;
      let res = await fetch(url, {
        method: "POST",
        headers: H(idToken),
        body: JSON.stringify(body),
      });

      // Fallback without orderBy in case of index issues
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        console.error("GET_CHECKLIST_400", t);

        const fallback = {
          structuredQuery: {
            from: [{ collectionId: 'checklistItems', allDescendants: true }],
            where: {
              compositeFilter: {
                op: 'AND',
                filters: [
                  { fieldFilter: { field: { fieldPath: 'apartment_id' },    op: 'EQUAL', value: { stringValue: aptId } } },
                  { fieldFilter: { field: { fieldPath: 'cleaning_task_id' }, op: 'EQUAL', value: { stringValue: aptId } } },
                ],
              },
            },
            limit: 200,
          },
        };

        res = await fetch(url, {
          method: "POST",
          headers: H(idToken),
          body: JSON.stringify(fallback),
        });

        if (!res.ok) {
          console.error("GET_CHECKLIST_FALLBACK_400", await res.text().catch(() => ""));
          return []; // Don't crash UI
        }
      }

      const rows = await res.json();
      
      // Normalize and deduplicate results
      function normalizeChecklistResults(json: any[]): ChecklistItem[] {
        // 1) Keep only items under cleaningTasks subcollection
        const onlyUnderCleaningTasks = json
          .map(r => r.document)
          .filter(Boolean)
          .filter((d: any) => typeof d.name === 'string' && d.name.includes('/documents/cleaningTasks/'));

        // 2) Deduplicate by full document name (unique path)
        const seen = new Set<string>();
        const items: ChecklistItem[] = [];
        for (const d of onlyUnderCleaningTasks) {
          if (!seen.has(d.name)) {
            seen.add(d.name);
            const f = d.fields || {};
            items.push({
              id: d.name.split('/').pop()!,
              title: f.title?.stringValue ?? f.name?.stringValue ?? '',
              completed: !!f.completed?.booleanValue,
              completed_by: f.completed_by?.stringValue ?? null,
              completed_at: f.completed_at?.timestampValue ?? null,
              order: f.order?.integerValue ? Number(f.order.integerValue) : null,
              created_at: f.created_at?.timestampValue ?? null,
            });
          }
        }

        // 3) Sort by order first, then by created_at DESC
        items.sort((a, b) => {
          const orderA = a.order ?? 0;
          const orderB = b.order ?? 0;
          if (orderA !== orderB) return orderA - orderB;
          
          const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return timeB - timeA; // DESC order for newest first
        });
        
        return items;
      }

              const items = normalizeChecklistResults(rows);
        return items;
    } catch (error) {
      console.error("Error getting cleaning checklist:", error);
      return [];
    }
  }

  /**
   * Mark checklist item as completed (only if it's my turn)
   */
  async markChecklistItemCompleted(itemId: string): Promise<void> {
    try {
      console.log('🔄 Starting markChecklistItemCompleted for item:', itemId);
      const { uid, idToken, aptId } = await getApartmentContext();
      console.log('✅ Got apartment context:', { uid, aptId });
      await ensureCurrentApartmentIdMatches(aptId);

      // Read cleaning task to verify it's my turn (user_id)
      const task = await this.getCleaningTask();
      if (!task || task.user_id !== uid) {
        console.error('❌ Not my turn:', { 
          taskUserId: task?.user_id, 
          myUserId: uid, 
          hasTask: !!task 
        });
        throw new Error("NOT_YOUR_TURN");
      }
      console.log('✅ Verified it\'s my turn to clean');

      // Update document: completed=true, with by/at
      const nowIso = new Date().toISOString();
      const path = `${FIRESTORE_BASE_URL}/cleaningTasks/${aptId}/checklistItems/${itemId}`;

      const body = {
        fields: {
          completed: { booleanValue: true },
          completed_by: { stringValue: uid },
          completed_at: { timestampValue: nowIso },
          // Don't touch other fields
        }
      };
      
      // Update - Firestore REST: PATCH with updateMask to update only these fields
      const fieldPaths = ['completed', 'completed_by', 'completed_at'];
      const url = `${path}?` + fieldPaths.map(path => `updateMask.fieldPaths=${path}`).join('&');
      
      const res = await fetch(url, {
        method: "PATCH",
        headers: H(idToken),
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.error('Checklist PATCH failed:', res.status, text);
        console.error('Request details:', { 
          url, 
          method: 'PATCH', 
          itemId, 
          body: JSON.stringify(body, null, 2) 
        });
        throw new Error(`CHECKLIST_UPDATE_FAILED_${res.status}`);
      }
      console.log('✅ Checklist item marked as completed successfully');
    } catch (error) {
      console.error("Error marking checklist item completed:", error);
      throw error;
    }
  }

  /**
   * Unmark checklist item as completed (only if it's my turn)
   */
  async unmarkChecklistItemCompleted(itemId: string): Promise<void> {
    try {
      const { uid, idToken, aptId } = await getApartmentContext();
      await ensureCurrentApartmentIdMatches(aptId);

      // Read cleaning task to verify it's my turn (user_id)
      const task = await this.getCleaningTask();
      if (!task || task.user_id !== uid) {
        throw new Error("NOT_YOUR_TURN");
      }

      // Update document: completed=false, clear by/at
      const path = `${FIRESTORE_BASE_URL}/cleaningTasks/${aptId}/checklistItems/${itemId}`;

      const body = {
        fields: {
          completed: { booleanValue: false },
          completed_by: { nullValue: null },
          completed_at: { nullValue: null },
        }
      };
      
      // Update - Firestore REST: PATCH with updateMask to update only these fields
      const fieldPaths = ['completed', 'completed_by', 'completed_at'];
      const url = `${path}?` + fieldPaths.map(path => `updateMask.fieldPaths=${path}`).join('&');
      
      const res = await fetch(url, {
        method: "PATCH",
        headers: H(idToken),
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.error('Checklist unmark PATCH failed:', res.status, text);
        throw new Error(`CHECKLIST_UNMARK_FAILED_${res.status}`);
      }
    } catch (error) {
      console.error("Error unmarking checklist item:", error);
      throw error;
    }
  }

  /**
   * Add new checklist item to the apartment
   */
  async addChecklistItem(title: string, order?: number): Promise<ChecklistItem> {
    try {
      const { uid, idToken, aptId } = await getApartmentContext();
      await ensureCurrentApartmentIdMatches(aptId);

      const parent = `${FIRESTORE_BASE_URL}/cleaningTasks/${aptId}/checklistItems`;
      const nowIso = new Date().toISOString();
      
      const body = {
        fields: {
          title: { stringValue: title },
          completed: { booleanValue: false },
          order: order !== undefined ? { integerValue: String(order) } : { nullValue: null },
          created_at: { timestampValue: nowIso },
          apartment_id: { stringValue: aptId },
          // cleaning_task_id removed - not needed since path contains taskId
        }
      };

      const res = await fetch(parent, {
        method: "POST",
        headers: H(idToken),
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const t = await res.text().catch(() => "");
        console.error("ADD_CHECKLIST_ITEM_400", t);
        throw new Error("ADD_CHECKLIST_ITEM_FAILED");
      }

      const doc = await res.json();
      return {
        id: doc.name.split("/").pop()!,
        title,
        completed: false,
        order: order || null,
        created_at: nowIso,
      };
    } catch (error) {
      console.error("Error adding checklist item:", error);
      throw error;
    }
  }

  /**
   * Remove checklist item from the apartment
   */
  async removeChecklistItem(itemId: string): Promise<void> {
    try {
      const { uid, idToken, aptId } = await getApartmentContext();
      await ensureCurrentApartmentIdMatches(aptId);

      const path = `${FIRESTORE_BASE_URL}/cleaningTasks/${aptId}/checklistItems/${itemId}`;
      
      const res = await fetch(path, {
        method: "DELETE",
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
      });

      if (!res.ok) {
        const t = await res.text().catch(() => "");
        console.error("REMOVE_CHECKLIST_ITEM_400", t);
        throw new Error(`REMOVE_CHECKLIST_ITEM_FAILED_${res.status}`);
      }

      console.log("✅ Checklist item removed successfully:", itemId);
    } catch (error) {
      console.error("Error removing checklist item:", error);
      throw error;
    }
  }

  /**
   * Reset all checklist items (mark all as not completed)
   * Used when finishing a turn
   */
  async resetAllChecklistItems(): Promise<void> {
    try {
      console.log('🔄 Starting resetAllChecklistItems...');
      const { uid, idToken, aptId } = await getApartmentContext();
      console.log('✅ Got apartment context:', { uid, aptId });
      await ensureCurrentApartmentIdMatches(aptId);

      // Verify it's the current user's turn
      const currentTask = await this.getCleaningTask();
      if (!currentTask) {
        throw new Error('No cleaning task found');
      }
      if (currentTask.user_id !== uid) {
        throw new Error('Not your turn to clean');
      }
      console.log('✅ Verified it\'s my turn to clean');

      // Get all items first
      const items = await this.getCleaningChecklist();
      console.log(`📋 Found ${items.length} checklist items to reset`);
      
      // Reset each item
      const resetPromises = items.map(item => {
        const path = `${FIRESTORE_BASE_URL}/cleaningTasks/${aptId}/checklistItems/${item.id}`;
        const body = {
          fields: {
            completed: { booleanValue: false },
            completed_by: { nullValue: null },
            completed_at: { nullValue: null },
          }
        };
        
        const fieldPaths = ['completed', 'completed_by', 'completed_at'];
        const url = `${path}?` + fieldPaths.map(path => `updateMask.fieldPaths=${path}`).join('&');
        
        return fetch(url, {
          method: "PATCH",
          headers: H(idToken),
          body: JSON.stringify(body),
        });
      });

      const results = await Promise.all(resetPromises);
      
      // Check if any failed
      for (let i = 0; i < results.length; i++) {
        if (!results[i].ok) {
          const t = await results[i].text().catch(() => "");
          console.error(`RESET_CHECKLIST_ITEM_${i}_FAILED`, t);
          console.error(`Failed item details:`, { 
            itemId: items[i]?.id, 
            status: results[i].status, 
            response: t 
          });
          throw new Error(`RESET_CHECKLIST_ITEM_${i}_FAILED_${results[i].status}`);
        }
      }
      console.log('✅ All checklist items reset successfully');
    } catch (error) {
      console.error("Error resetting checklist items:", error);
      throw error;
    }
  }

  /**
   * Clean up duplicate checklist items (for debugging)
   */
  async cleanupChecklistDuplicates(): Promise<void> {
    try {
      const { uid, idToken, aptId } = await getApartmentContext();
      await ensureCurrentApartmentIdMatches(aptId);

      console.log('🧹 Starting cleanup for apartment:', aptId);

      // First, let's see what we have in the database
      console.log('🔍 Querying all checklist items for apartment...');

      // Query all checklist items for this apartment
      const queryBody = {
        structuredQuery: {
          from: [{ collectionId: 'checklistItems', allDescendants: true }],
          where: {
            compositeFilter: {
              op: 'AND',
              filters: [
                { fieldFilter: { field: { fieldPath: 'apartment_id' }, op: 'EQUAL', value: { stringValue: aptId } } },
                { fieldFilter: { field: { fieldPath: 'cleaning_task_id' }, op: 'EQUAL', value: { stringValue: aptId } } },
              ],
            },
          },
          orderBy: [{ field: { fieldPath: 'created_at' }, direction: 'ASCENDING' }], // Keep oldest first
          limit: 500
        }
      };

      const response = await fetch(`${FIRESTORE_BASE_URL}:runQuery`, {
        method: 'POST',
        headers: H(idToken),
        body: JSON.stringify(queryBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Query failed: ${response.status} - ${errorText}`);
      }

      const rows = await response.json();
      console.log(`📊 Found ${rows.length} checklist items`);

      // Log all items for debugging
      console.log('📋 All items found:');
      rows.forEach((row: any, index: number) => {
        const doc = row.document;
        if (doc) {
          const fields = doc.fields || {};
          const title = fields.title?.stringValue || '';
          const docId = doc.name.split('/').pop();
          console.log(`  ${index + 1}. "${title}" (${docId})`);
        }
      });

      const byTitle = new Map(); // Group by normalized title
      const toDelete = [];

      for (const row of rows) {
        const doc = row.document;
        if (!doc) continue;

        const fields = doc.fields || {};
        const title = fields.title?.stringValue || '';
        const createdAt = fields.created_at?.timestampValue || '';
        
        // Skip empty titles
        if (!title.trim()) {
          console.log(`⚠️ Skipping item with empty title: ${doc.name.split('/').pop()}`);
          continue;
        }
        
        // Normalize title for comparison (remove extra spaces, lowercase, etc.)
        const normalizedTitle = title.trim().toLowerCase().replace(/\s+/g, ' ');
        
        if (!byTitle.has(normalizedTitle)) {
          // First occurrence of this title - keep it
          byTitle.set(normalizedTitle, {
            doc,
            title,
            createdAt,
            docId: doc.name.split('/').pop()
          });
          console.log(`✅ Keeping first: "${title}" (${doc.name.split('/').pop()})`);
        } else {
          // Duplicate found - mark for deletion
          const existing = byTitle.get(normalizedTitle);
          toDelete.push({
            docName: doc.name,
            title,
            createdAt,
            docId: doc.name.split('/').pop()
          });
          console.log(`🗑️ Found duplicate: "${title}" (${doc.name.split('/').pop()}) - keeping original (${existing.docId})`);
        }
      }

      console.log(`📊 Analysis complete: ${byTitle.size} unique titles, ${toDelete.length} duplicates to delete`);

      if (toDelete.length > 0) {
        console.log(`🔄 Deleting ${toDelete.length} duplicates...`);
        
        // Delete each duplicate
        let deletedCount = 0;
        for (const item of toDelete) {
          try {
            // Extract the document path correctly
            let docPath;
            if (item.docName.startsWith('projects/')) {
              docPath = item.docName.replace('projects/roomies-hub/databases/(default)/documents/', '');
            } else {
              docPath = item.docName;
            }
            
            const fullUrl = `${FIRESTORE_BASE_URL}/${docPath}`;
            console.log(`🗑️ Attempting to delete: "${item.title}"`);
            console.log(`   Full URL: ${fullUrl}`);
            console.log(`   Doc path: ${docPath}`);
            
            const deleteResponse = await fetch(fullUrl, {
              method: 'DELETE',
              headers: H(idToken),
            });
            
            if (deleteResponse.ok) {
              deletedCount++;
              console.log(`✅ Successfully deleted: "${item.title}" (${item.docId})`);
            } else {
              const errorText = await deleteResponse.text().catch(() => '');
              console.log(`❌ Failed to delete: "${item.title}" (${item.docId})`);
              console.log(`   Status: ${deleteResponse.status}`);
              console.log(`   Error: ${errorText}`);
            }
          } catch (deleteError) {
            console.error(`❌ Error deleting "${item.title}" (${item.docId}):`, deleteError);
          }
        }
        
        console.log(`✅ Cleanup completed! Successfully deleted ${deletedCount}/${toDelete.length} duplicates`);
      } else {
        console.log(`✨ No duplicates found - cleanup not needed`);
      }

      console.log(`📋 Final count: ${byTitle.size} unique items`);
      
    } catch (error) {
      console.error('❌ Cleanup failed:', error);
      throw error;
    }
  }

}

// Export singleton instance
export const firestoreService = FirestoreService.getInstance();


