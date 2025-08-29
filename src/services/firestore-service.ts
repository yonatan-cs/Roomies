/**
 * Firestore Database Service using REST API
 * Handles database operations without Firebase SDK
 */

import { FIRESTORE_BASE_URL, COLLECTIONS } from './firebase-config';
import { firebaseAuth } from './firebase-auth';

// --- Session helpers ---
const authHeaders = (idToken: string) => ({
  Authorization: `Bearer ${idToken}`,
  'Content-Type': 'application/json',
});

// Ensure we always have uid + idToken (try to restore session if missing from memory)
async function requireSession(): Promise<{ uid: string; idToken: string }> {
  try {
    // Try to get current user and token
    const currentUser = await firebaseAuth.getCurrentUser();
    const idToken = await firebaseAuth.getCurrentIdToken();
    
    if (currentUser?.localId && idToken) {
      console.log('✅ Session available:', { uid: currentUser.localId, tokenPreview: idToken.substring(0, 20) + '...' });
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

// Get user's current apartment ID from profile or fallback to latest membership
async function getUserCurrentApartmentId(uid: string, idToken: string): Promise<string | null> {
  try {
    // Step 1: Try from user profile
    const userResponse = await fetch(`${FIRESTORE_BASE_URL}/users/${uid}`, {
      method: 'GET',
      headers: authHeaders(idToken),
    });
    
    if (userResponse.status === 200) {
      const userDoc = await userResponse.json();
      const apartmentId = userDoc.fields?.current_apartment_id?.stringValue;
      if (apartmentId) {
        console.log('✅ Found apartment ID in user profile:', apartmentId);
        return apartmentId;
      }
    }
    
    // Step 2: Fallback - query user's memberships and get the latest one
    const queryBody = {
      structuredQuery: {
        from: [{ collectionId: COLLECTIONS.APARTMENT_MEMBERS }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'user_id' },
            op: 'EQUAL',
            value: { stringValue: uid }
          }
        },
        orderBy: [{ field: { fieldPath: 'joined_at' }, direction: 'DESCENDING' }],
        limit: 1
      }
    };
    
    const queryResponse = await fetch(`${FIRESTORE_BASE_URL}:runQuery`, {
      method: 'POST',
      headers: authHeaders(idToken),
      body: JSON.stringify(queryBody),
    });
    
    if (queryResponse.status === 200) {
      const rows = await queryResponse.json();
      const latestMembership = rows.find((row: any) => row.document)?.document;
      if (latestMembership) {
        const apartmentId = latestMembership.fields?.apartment_id?.stringValue;
        if (apartmentId) {
          console.log('✅ Found apartment ID from latest membership:', apartmentId);
          
          // Sync back to user profile
          await fetch(`${FIRESTORE_BASE_URL}/users/${uid}?updateMask.fieldPaths=current_apartment_id`, {
            method: 'PATCH',
            headers: authHeaders(idToken),
            body: JSON.stringify({
              fields: { current_apartment_id: { stringValue: apartmentId } }
            }),
          });
          
          return apartmentId;
        }
      }
    }
    
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
export async function ensureCurrentApartmentIdMatches(aptId: string): Promise<void> {
  const { uid, idToken } = await requireSession();
  const current = await getUserCurrentApartmentId(uid, idToken);
  if (current === aptId) return;

  // PATCH: users/{uid}?updateMask.fieldPaths=current_apartment_id
  const url = `${FIRESTORE_BASE_URL}/users/${uid}?updateMask.fieldPaths=current_apartment_id`;
  const body = {
    fields: {
      current_apartment_id: { stringValue: aptId },
    },
  };
  const res = await fetch(url, { method: 'PATCH', headers: authHeaders(idToken), body: JSON.stringify(body) });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    console.error('ensureCurrentApartmentIdMatches PATCH failed', res.status, t);
    throw new Error('ENSURE_APARTMENT_CONTEXT_FAILED');
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
        const payload = JSON.parse(atob(tokenParts[1]));
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
      const header = JSON.parse(atob(tokenParts[0]));
      const payload = JSON.parse(atob(tokenParts[1]));
      
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
          const payload = JSON.parse(atob(tokenParts[1]));
          console.log('🔍 Token details:', {
            aud: payload.aud,
            email: payload.email,
            exp: new Date(payload.exp * 1000).toISOString(),
            firebase: payload.firebase
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
      console.log('📋 Response headers:', Object.fromEntries(response.headers.entries()));
      
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
        fields[key] = { stringValue: value };
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
        console.error('📋 Response headers:', Object.fromEntries(response.headers.entries()));
        
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
   * Update a document
   */
  async updateDocument(collectionName: string, documentId: string, data: any): Promise<any> {
    try {
      const headers = await this.getAuthHeaders();
      const url = `${FIRESTORE_BASE_URL}/${collectionName}/${documentId}`;

      const response = await fetch(url, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          fields: this.toFirestoreFormat(data)
        }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(`Failed to update document: ${responseData.error?.message || 'Unknown error'}`);
      }

      const convertedData = this.fromFirestoreFormat(responseData.fields);
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
    phone?: string;
  }): Promise<any> {
    const user = await firebaseAuth.getCurrentUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    // Ensure no current_apartment_id in user creation (per security rules)
    const cleanUserData = {
      email: userData.email,
      full_name: userData.full_name,
      ...(userData.phone && { phone: userData.phone })
    };

    console.log('🆕 Creating user with clean data (no apartment ID):', cleanUserData);
    return this.createDocument(COLLECTIONS.USERS, cleanUserData, user.localId);
  }

  async getUser(userId: string): Promise<any | null> {
    return this.getDocument(COLLECTIONS.USERS, userId);
  }

  async updateUser(userId: string, userData: { full_name?: string; phone?: string; current_apartment_id?: string }): Promise<any> {
    return this.updateDocument(COLLECTIONS.USERS, userId, userData);
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
          
          // Create membership for the creator directly
          console.log('👤 Creating membership for apartment creator...');
          await this.createMembershipDirectly(apartment.id, currentUser.localId);
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

      // Check if user is already a member of another apartment
      const existingApartment = await this.getUserCurrentApartment(userId);
      if (existingApartment && existingApartment.id !== apartmentId) {
        throw new Error('User is already a member of another apartment');
      }
      
      const memberId = `${apartmentId}_${userId}`;
      
      // Check if membership already exists
      try {
        const existingMembership = await this.getDocument(COLLECTIONS.APARTMENT_MEMBERS, memberId);
        if (existingMembership) {
          console.log('✅ User is already a member of this apartment');
          return existingMembership;
        }
      } catch (error) {
        // Document doesn't exist, continue with creation
      }
      
      const memberData = {
        apartment_id: apartmentId,
        user_id: userId,
        role: 'member',
        joined_at: new Date(),
      };
      
      console.log('📝 Creating apartment membership record...');
      console.log(`🆔 Member ID: ${memberId}`);
      console.log(`📋 Member data:`, memberData);
      
      // Create the membership record
      const membershipResult = await this.createDocument(COLLECTIONS.APARTMENT_MEMBERS, memberData, memberId);
      console.log('✅ Membership record created');
      
      // Update user's current_apartment_id with a short retry in case rules check races the membership propagation
      console.log('👤 Updating user profile with apartment ID...');
      {
        const maxUpdateAttempts = 5;
        let attempt = 0;
        let updated = false;
        let lastError: any = null;
        while (attempt < maxUpdateAttempts && !updated) {
          try {
            await this.updateUser(userId, { current_apartment_id: apartmentId });
            updated = true;
            console.log('✅ User profile updated');
          } catch (e: any) {
            lastError = e;
            const message = String(e?.message || e || '');
            // Only retry on permission errors that may be due to immediate consistency on rules exists()
            if (message.includes('Missing or insufficient permissions')) {
              attempt++;
              console.warn(`⚠️ Update permission not ready (attempt ${attempt}/${maxUpdateAttempts}). Retrying shortly...`);
              await new Promise(r => setTimeout(r, 150 * attempt));
              continue;
            }
            // Non-retryable
            throw e;
          }
        }
        if (!updated) {
          console.error('❌ Failed to update user after retries:', lastError);
          throw lastError;
        }
      }
      
      return membershipResult;
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
      
      // 2. Create membership with proper document ID format
      await this.createMembershipDocument(invite.apartmentId, currentUser.localId, idToken);
      
      // 3. Update user's current_apartment_id
      await this.setCurrentApartment(currentUser.localId, invite.apartmentId, idToken);
      
      // 4. Get full apartment details
      const apartment = await this.getDocument(COLLECTIONS.APARTMENTS, invite.apartmentId);
      
      console.log('✅ Successfully joined apartment:', apartment);
      return apartment;
      
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

  /**
   * Create membership document with proper REST API call
   */
  private async createMembershipDocument(apartmentId: string, uid: string, idToken: string): Promise<void> {
    const membershipId = `${apartmentId}_${uid}`; // MUST be underscore
    const url = `${FIRESTORE_BASE_URL}/apartmentMembers?documentId=${encodeURIComponent(membershipId)}`;
    
    const body = {
      fields: {
        apartment_id: { stringValue: apartmentId },
        user_id: { stringValue: uid },
        role: { stringValue: 'member' }, // rules require 'member'
        created_at: { timestampValue: new Date().toISOString() }
      },
    };
    
    console.log('🤝 Creating membership document:');
    console.log('📋 URL:', url);
    console.log('🆔 Membership ID:', membershipId);
    console.log('👤 User ID:', uid);
    console.log('🏠 Apartment ID:', apartmentId);
    console.log('📝 Body:', JSON.stringify(body, null, 2));
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    
    console.log(`📊 Membership creation response: ${response.status} (${response.statusText})`);
    
    if (response.status === 200) {
      console.log('✅ Membership created successfully');
      return;
    }
    
    if (response.status === 409) {
      console.log('✅ Membership already exists (idempotent)');
      return;
    }
    
    if (response.status === 403) {
      console.error('❌ PERMISSION_DENIED_MEMBER_CREATE');
      
      // Get detailed error information
      let errorData = {};
      try {
        errorData = await response.json();
      } catch (e) {
        console.error('❌ Could not parse error response');
      }
      
      console.error('📋 Error response:', errorData);
      throw new Error('PERMISSION_DENIED_MEMBER_CREATE');
    }
    
    throw new Error(`UNEXPECTED_${response.status}`);
  }

  /**
   * Set user's current apartment ID
   */
  private async setCurrentApartment(uid: string, apartmentId: string, idToken: string): Promise<void> {
    const url = `${FIRESTORE_BASE_URL}/users/${uid}?updateMask.fieldPaths=current_apartment_id`;
    const body = {
      fields: {
        current_apartment_id: { stringValue: apartmentId }
      }
    };
    
    console.log('👤 Setting current apartment for user:', uid);
    console.log('📋 URL:', url);
    console.log('📝 Body:', JSON.stringify(body, null, 2));
    
    const response = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    
    console.log(`📊 Set current apartment response: ${response.status} (${response.statusText})`);
    
    if (response.status === 200) {
      console.log('✅ Current apartment set successfully');
      return;
    }
    
    if (response.status === 403) {
      throw new Error('PERMISSION_DENIED_SET_CURRENT_APT');
    }
    
    throw new Error(`UNEXPECTED_${response.status}`);
  }

  /**
   * Get apartment members from apartmentMembers collection
   * Uses runQuery to find all members of a specific apartment
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
      
      // Ensure current_apartment_id is set before querying
      console.log('🔧 Ensuring current_apartment_id before query...');
      const ensuredApartmentId = await this.ensureCurrentApartmentId(currentUser.localId, apartmentId);
      
      if (!ensuredApartmentId) {
        throw new Error('Could not ensure current_apartment_id');
      }
      
      console.log('✅ Using ensured apartment ID for query:', ensuredApartmentId);
      
      const url = `${FIRESTORE_BASE_URL}:runQuery`;
      const body = {
        structuredQuery: {
          from: [{ collectionId: COLLECTIONS.APARTMENT_MEMBERS }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'apartment_id' },
              op: 'EQUAL',
              value: { stringValue: ensuredApartmentId }
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
        throw new Error(`APARTMENT_MEMBERS_QUERY_${response.status}`);
      }
      
      const rows = await response.json();
      console.log('📋 Raw query results:', rows);
      
      const members = rows
        .map((row: any) => row.document)
        .filter(Boolean)
        .map((doc: any) => {
          const fields = doc.fields || {};
          return {
            id: doc.name.split('/').pop(), // "<aptId>_<uid>"
            apartment_id: fields.apartment_id?.stringValue as string,
            user_id: fields.user_id?.stringValue as string,
            role: fields.role?.stringValue as 'member' | 'admin' | string,
            joined_at: fields.joined_at?.timestampValue || fields.created_at?.timestampValue || null,
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
          displayName: fields.displayName?.stringValue,
          name: fields.name?.stringValue,
        };
      }
      
      console.log('✅ User profiles loaded:', Object.keys(userMap));
      return userMap;
      
    } catch (error) {
      console.error('❌ Error getting user profiles:', error);
      throw error;
    }
  }

  /**
   * Ensure current_apartment_id is set in user profile before queries
   * This prevents 403 errors on apartment-related queries
   */
  async ensureCurrentApartmentId(userId: string, fallbackApartmentId: string | null): Promise<string | null> {
    try {
      console.log('🔧 Ensuring current_apartment_id for user:', userId);
      
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
        const currentApartmentId = userDoc.fields?.current_apartment_id?.stringValue || null;
        
        console.log('📋 Current apartment ID in profile:', currentApartmentId);
        
        // If current_apartment_id exists and matches fallback - perfect
        if (currentApartmentId && currentApartmentId === fallbackApartmentId) {
          console.log('✅ current_apartment_id is already set correctly');
          return currentApartmentId;
        }
        
        // If missing or different, and we have a fallback - update it
        if (fallbackApartmentId) {
          console.log('🔄 Updating current_apartment_id to:', fallbackApartmentId);
          
          const updateResponse = await fetch(
            `${FIRESTORE_BASE_URL}/users/${userId}?updateMask.fieldPaths=current_apartment_id`,
            {
              method: 'PATCH',
              headers: {
                'Authorization': `Bearer ${idToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                fields: {
                  current_apartment_id: { stringValue: fallbackApartmentId }
                }
              })
            }
          );
          
          console.log(`📊 Update response: ${updateResponse.status} (${updateResponse.statusText})`);
          
          if (updateResponse.status === 200) {
            console.log('✅ Successfully updated current_apartment_id');
            return fallbackApartmentId;
          } else {
            console.log('❌ Failed to update current_apartment_id');
            try {
              const errorData = await updateResponse.json();
              console.log('📋 Error details:', JSON.stringify(errorData, null, 2));
            } catch (e) {
              console.log('❌ Could not parse error response');
            }
          }
        }
        
        // Return current value if exists, otherwise null
        return currentApartmentId;
      }
      
      // If user document doesn't exist and we have fallback - create user and set apartment
      if (userResponse.status === 404 && fallbackApartmentId) {
        console.log('📭 User document not found, creating with apartment ID...');
        
        // Create user document first
        const createResponse = await fetch(`${FIRESTORE_BASE_URL}/users?documentId=${userId}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${idToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fields: {
              email: { stringValue: '' },
              full_name: { stringValue: '' },
              phone: { stringValue: '' }
            }
          })
        });
        
        console.log(`📊 Create user response: ${createResponse.status} (${createResponse.statusText})`);
        
        if (createResponse.status === 200) {
          // Now update with apartment ID
          const updateResponse = await fetch(
            `${FIRESTORE_BASE_URL}/users/${userId}?updateMask.fieldPaths=current_apartment_id`,
            {
              method: 'PATCH',
              headers: {
                'Authorization': `Bearer ${idToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                fields: {
                  current_apartment_id: { stringValue: fallbackApartmentId }
                }
              })
            }
          );
          
          console.log(`📊 Update apartment response: ${updateResponse.status} (${updateResponse.statusText})`);
          
          if (updateResponse.status === 200) {
            console.log('✅ Successfully created user and set apartment ID');
            return fallbackApartmentId;
          }
        }
      }
      
      console.log('📭 Could not ensure current_apartment_id');
      return null;
      
    } catch (error) {
      console.error('❌ Error ensuring current apartment ID:', error);
      return null;
    }
  }

  /**
   * Get reliable apartment ID for the current user
   * First tries from user profile, then falls back to membership query
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
      console.log('📋 Step 1: Checking user profile for current_apartment_id...');
      const userResponse = await fetch(`${FIRESTORE_BASE_URL}/users/${userId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (userResponse.status === 200) {
        const userDoc = await userResponse.json();
        const apartmentId = userDoc.fields?.current_apartment_id?.stringValue;
        if (apartmentId) {
          console.log('✅ Found apartment ID in user profile:', apartmentId);
          return apartmentId;
        }
      }
      
      console.log('📭 No apartment ID in user profile, trying membership query...');
      
      // Step 2: Fallback - query user's memberships and get the latest one
      const queryBody = {
        structuredQuery: {
          from: [{ collectionId: COLLECTIONS.APARTMENT_MEMBERS }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'user_id' },
              op: 'EQUAL',
              value: { stringValue: userId }
            }
          },
          orderBy: [{ field: { fieldPath: 'joined_at' }, direction: 'DESCENDING' }],
          limit: 1
        }
      };
      
      console.log('📋 Step 2: Querying user memberships...');
      console.log('📝 Query body:', JSON.stringify(queryBody, null, 2));
      
      const queryResponse = await fetch(`${FIRESTORE_BASE_URL}:runQuery`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(queryBody),
      });
      
      console.log(`📊 Membership query response: ${queryResponse.status} (${queryResponse.statusText})`);
      
      if (queryResponse.status === 200) {
        const rows = await queryResponse.json();
        console.log('📋 Raw membership query results:', rows);
        
        const latestMembership = rows.find((row: any) => row.document)?.document;
        if (latestMembership) {
          const apartmentId = latestMembership.fields?.apartment_id?.stringValue;
          if (apartmentId) {
            console.log('✅ Found apartment ID from latest membership:', apartmentId);
            return apartmentId;
          }
        }
      }
      
      console.log('📭 No apartment ID found from any source');
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
      
      // 1. Get all memberships
      const memberships = await this.getApartmentMembers(apartmentId);
      console.log('📋 Found memberships:', memberships);
      
      if (!memberships.length) {
        console.log('📭 No members found for apartment');
        return [];
      }
      
      // 2. Extract unique user IDs
      const uids = [...new Set(memberships.map(m => m.user_id).filter(Boolean))];
      console.log('👤 Unique user IDs:', uids);
      
      // 3. Get user profiles
      const userProfiles = await this.getUsersByIds(uids);
      console.log('📋 User profiles loaded:', userProfiles);
      
      // 4. Combine memberships with profiles
      const membersWithProfiles = memberships.map(membership => ({
        ...membership,
        profile: userProfiles[membership.user_id] || { 
          id: membership.user_id, 
          full_name: 'אורח',
          email: 'unknown@example.com'
        }
      }));
      
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
      
      // 2. Ensure current_apartment_id is set before any queries
      console.log('🔧 Ensuring current_apartment_id before getting apartment data...');
      const ensuredApartmentId = await this.ensureCurrentApartmentId(uid, apartmentId);
      
      if (!ensuredApartmentId) {
        console.log('❌ Could not ensure current_apartment_id');
        return null;
      }
      
      console.log('✅ Using ensured apartment ID:', ensuredApartmentId);
      
      // 3. Get apartment details
      const apartment = await this.getApartment(ensuredApartmentId);
      
      // 4. Get members with profiles
      const membersWithProfiles = await this.getApartmentMembersWithProfiles(ensuredApartmentId);
      
      // 5. Combine everything
      const completeData = {
        ...apartment,
        members: membersWithProfiles.map(member => ({
          id: member.user_id,
          email: member.profile.email || '',
          name: member.profile.full_name || member.profile.name || member.profile.displayName || 'אורח',
          role: member.role,
          current_apartment_id: ensuredApartmentId,
        }))
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
      
      const memberId = `${apartmentId}_${userId}`;
      
      // Remove membership record
      console.log('🗑️ Removing apartment membership record...');
      await this.deleteDocument(COLLECTIONS.APARTMENT_MEMBERS, memberId);
      console.log('✅ Membership record removed');
      
      // Clear user's current_apartment_id
      console.log('👤 Clearing user profile apartment reference...');
      await this.updateUser(userId, { current_apartment_id: undefined });
      console.log('✅ User profile updated');
      
    } catch (error) {
      console.error('❌ Leave apartment error:', error);
      throw error;
    }
  }

  // This function is replaced by the new getApartmentMembers that uses runQuery
  // Keeping for backward compatibility but it's deprecated
  async getApartmentMembersOld(apartmentId: string): Promise<any[]> {
    return this.queryCollection(COLLECTIONS.APARTMENT_MEMBERS, 'apartment_id', 'EQUAL', apartmentId);
  }

  /**
   * Create membership directly without going through join flow
   * Used for apartment creator to become a member immediately
   */
  async createMembershipDirectly(apartmentId: string, userId: string): Promise<any> {
    try {
      console.log(`🤝 Creating direct membership for user ${userId} in apartment ${apartmentId}`);
      
      const memberId = `${apartmentId}_${userId}`;
      
      // Check if membership already exists
      try {
        const existingMembership = await this.getDocument(COLLECTIONS.APARTMENT_MEMBERS, memberId);
        if (existingMembership) {
          console.log('✅ User is already a member of this apartment');
          return existingMembership;
        }
      } catch (error) {
        // Document doesn't exist, continue with creation
      }
      
      const memberData = {
        apartment_id: apartmentId,
        user_id: userId,
        role: 'member',
        joined_at: new Date(),
      };
      
      console.log('📝 Creating apartment membership record...');
      console.log(`🆔 Member ID: ${memberId}`);
      console.log(`📋 Member data:`, memberData);
      
      // Create the membership record
      const membershipResult = await this.createDocument(COLLECTIONS.APARTMENT_MEMBERS, memberData, memberId);
      console.log('✅ Membership record created');
      
      // Update user's current_apartment_id
      console.log('👤 Updating user profile with apartment ID...');
      await this.updateUser(userId, { current_apartment_id: apartmentId });
      console.log('✅ User profile updated');
      
      return membershipResult;
    } catch (error) {
      console.error('❌ Create membership directly error:', error);
      throw error;
    }
  }

  /**
   * Get user's current apartment based on user profile
   * Updated to avoid the circular permission issue with apartmentMembers
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
      
      // Get user's profile to find their current_apartment_id
      const userData = await this.getDocument(COLLECTIONS.USERS, userId);
      
      if (!userData || !userData.current_apartment_id) {
        console.log('📋 User has no current apartment ID in profile');
        return null;
      }
      
      console.log(`🏠 User has apartment ID in profile: ${userData.current_apartment_id}`);
      
      // Get the apartment details
      return await this.getApartment(userData.current_apartment_id);
      
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

  // ===== CLEANING TASKS FUNCTIONS WITH APARTMENT CONTEXT =====



  /**
   * Get or create cleaning task for current apartment
   */
  async getCleaningTask(): Promise<any | null> {
    try {
      const { idToken, aptId } = await getApartmentContextSlim();
      await ensureCurrentApartmentIdMatches(aptId);

      const url = `${FIRESTORE_BASE_URL}:runQuery`;
      const body = {
        structuredQuery: {
          from: [{ collectionId: 'cleaningTasks' }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'apartment_id' },
              op: 'EQUAL',
              value: { stringValue: aptId },
            },
          },
          limit: 1,
        },
      };

      const res = await fetch(url, { method: 'POST', headers: authHeaders(idToken), body: JSON.stringify(body) });
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        console.warn('GET_CLEANING_TASK_403?', res.status, t);
        return null; // לא מפיל את ה־UI
      }

      const rows = await res.json();
      const first = (rows || []).find((r: any) => r.document?.fields);
      if (!first) {
        // Try to create new cleaning task if none exists
        try {
          return await this.createCleaningTask(aptId);
        } catch (createError) {
          console.error('Failed to create cleaning task:', createError);
          return null;
        }
      }

      const doc = first.document;
      const f = doc.fields ?? {};
      const id = doc.name.split('/').pop();
      return {
        id,
        apartment_id: f.apartment_id?.stringValue ?? aptId,
        queue: (f.queue?.arrayValue?.values || []).map((v: any) => v.stringValue),
        current_index: f.current_index?.integerValue ? Number(f.current_index.integerValue) : 0,
        last_completed_at: f.last_completed_at?.timestampValue ?? null,
      };
    } catch (e) {
      console.error('GET_CLEANING_TASK_ERROR', e);
      return null;
    }
  }

  /**
   * Create new cleaning task for apartment
   */
  async createCleaningTask(apartmentId: string): Promise<any> {
    const { idToken } = await getApartmentContext();

    // Get apartment members for the queue
    const membersRes = await fetch(`${FIRESTORE_BASE_URL}:runQuery`, {
      method: 'POST',
      headers: authHeaders(idToken),
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'apartmentMembers' }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'apartment_id' },
              op: 'EQUAL',
              value: { stringValue: apartmentId }
            }
          },
        }
      }),
    });

    if (!membersRes.ok) {
      throw new Error(`GET_MEMBERS_FOR_CLEANING_${membersRes.status}`);
    }

    const membersData = await membersRes.json();
    const queue = membersData
      .map((row: any) => row.document?.fields?.user_id?.stringValue)
      .filter(Boolean);

    const cleaningTask = {
      fields: {
        apartment_id: { stringValue: apartmentId },
        queue: { arrayValue: { values: queue.map((uid: string) => ({ stringValue: uid })) } },
        current_index: { integerValue: '0' },
        last_completed_at: { timestampValue: new Date().toISOString() },
        created_at: { timestampValue: new Date().toISOString() },
      },
    };

    const res = await fetch(`${FIRESTORE_BASE_URL}/cleaningTasks/${apartmentId}`, {
      method: 'POST',
      headers: authHeaders(idToken),
      body: JSON.stringify(cleaningTask),
    });

    if (!res.ok) {
      throw new Error(`CREATE_CLEANING_TASK_${res.status}`);
    }

    return await res.json();
  }

  /**
   * Mark cleaning as completed and move to next person
   */
  async markCleaningCompleted(): Promise<any> {
    const { uid, idToken, aptId } = await getApartmentContext();

    // Get current cleaning task
    const currentTask = await this.getCleaningTask();
    if (!currentTask) {
      throw new Error('No cleaning task found');
    }

    const queue = currentTask.fields?.queue?.arrayValue?.values?.map((v: any) => v.stringValue) || [];
    let currentIndex = parseInt(currentTask.fields?.current_index?.integerValue || '0');

    // Move to next person
    currentIndex = (currentIndex + 1) % queue.length;

    const updateBody = {
      fields: {
        current_index: { integerValue: currentIndex.toString() },
        last_completed_at: { timestampValue: new Date().toISOString() },
        last_completed_by: { stringValue: uid },
      },
    };

    const res = await fetch(`${FIRESTORE_BASE_URL}/cleaningTasks/${aptId}?updateMask.fieldPaths=current_index,last_completed_at,last_completed_by`, {
      method: 'PATCH',
      headers: authHeaders(idToken),
      body: JSON.stringify(updateBody),
    });

    if (!res.ok) {
      throw new Error(`UPDATE_CLEANING_TASK_${res.status}`);
    }

    return await res.json();
  }

  // ===== SHOPPING FUNCTIONS WITH APARTMENT CONTEXT =====

  /**
   * Add shopping item with apartment context
   */
  async addShoppingItem(name: string, addedByUserId: string): Promise<any> {
    const { idToken, aptId } = await getApartmentContext();

    const body = {
      fields: {
        apartment_id: { stringValue: aptId },
        name: { stringValue: name },
        added_by_user_id: { stringValue: addedByUserId },
        purchased: { booleanValue: false },
        created_at: { timestampValue: new Date().toISOString() },
      },
    };

    const res = await fetch(`${FIRESTORE_BASE_URL}/shoppingItems`, {
      method: 'POST',
      headers: authHeaders(idToken),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`ADD_SHOPPING_ITEM_${res.status}`);
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
          orderBy: [{ field: { fieldPath: 'created_at' }, direction: 'DESCENDING' }],
          limit: 200,
        },
      };

      const res = await fetch(url, { method: 'POST', headers: authHeaders(idToken), body: JSON.stringify(body) });
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        console.warn('GET_SHOPPING_ITEMS_400?', res.status, t);
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
            created_at: f.created_at?.timestampValue ?? null,
            purchased: !!f.purchased?.booleanValue,
            purchased_by_user_id: f.purchased_by_user_id?.stringValue ?? null,
            added_by_user_id: f.added_by_user_id?.stringValue ?? null,
          };
        });

      return items;
    } catch (e) {
      console.error('GET_SHOPPING_ITEMS_ERROR', e);
      return []; // תמיד מחזיר מערך ולא מפיל
    }
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

    const res = await fetch(`${FIRESTORE_BASE_URL}/shoppingItems/${itemId}?updateMask.fieldPaths=purchased,purchased_by_user_id,purchased_at${price !== undefined ? ',price' : ''}`, {
      method: 'PATCH',
      headers: authHeaders(idToken),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`MARK_SHOPPING_ITEM_PURCHASED_${res.status}`);
    }

    return await res.json();
  }


}

// Export singleton instance
export const firestoreService = FirestoreService.getInstance();

// Debug utilities for development
if (__DEV__) {
  (global as any).debugFirestore = {
    testAuth: async () => {
      const service = FirestoreService.getInstance();
      const currentUser = await firebaseAuth.getCurrentUser();
      const idToken = await firebaseAuth.getCurrentIdToken();
      
      console.log('🔍 Debug Auth Status:');
      console.log('👤 Current user:', currentUser?.email || 'Not signed in');
      console.log('🔑 ID token present:', !!idToken);
      
      if (idToken) {
        try {
          const parts = idToken.split('.');
          const payload = JSON.parse(atob(parts[1]));
          console.log('📋 Token payload:', {
            aud: payload.aud,
            email: payload.email,
            exp: new Date(payload.exp * 1000).toISOString(),
            firebase: payload.firebase
          });
          
          // Test if token works with a simple request
          console.log('🧪 Testing token with simple request...');
          const testUrl = `${FIRESTORE_BASE_URL}/users/${payload.user_id || payload.sub}`;
          const testResponse = await fetch(testUrl, {
            headers: { Authorization: `Bearer ${idToken}` }
          });
          console.log(`📊 Token test result: ${testResponse.status} (${testResponse.statusText})`);
          
        } catch (e) {
          console.error('❌ Failed to decode token:', e);
        }
      }
    },
    
    testInvite: async (code: string) => {
      const service = FirestoreService.getInstance();
      return await service.testInviteAccess(code);
    },
    
    getInvite: async (code: string) => {
      const service = FirestoreService.getInstance();
      return await service.getApartmentByInviteCode(code);
    },
    
    checkInviteExists: async (code: string) => {
      const service = FirestoreService.getInstance();
      
      // Check if document exists without authentication first
      const url = `${FIRESTORE_BASE_URL}/${COLLECTIONS.APARTMENT_INVITES}/${code.trim().toUpperCase()}`;
      console.log('🌐 Checking if invite exists (no auth):', url);
      
      const response = await fetch(url + '?key=AIzaSyCdVexzHD5StQIK_w3GSbdYHYoE7fBqDps', {
        method: 'GET',
      });
      
      console.log(`📊 No-auth response: ${response.status} (${response.statusText})`);
      
      if (response.status === 403) {
        console.log('🔒 Document exists but requires authentication (expected)');
        return true;
      } else if (response.status === 404) {
        console.log('📭 Document does not exist');
        return false;
      } else if (response.status === 200) {
        console.log('🔓 Document is publicly readable (unexpected but OK)');
        return true;
      } else {
        console.log('❓ Unexpected response status');
        return null;
      }
    }
  };
  
  console.log('🛠️ Debug utilities available at global.debugFirestore');
}
