/**
 * Firestore Database Service using REST API
 * Handles database operations without Firebase SDK
 */

import { FIRESTORE_BASE_URL, COLLECTIONS } from './firebase-config';
import { firebaseAuth } from './firebase-auth';

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
    
    const idToken = await firebaseAuth.getCurrentIdToken();
    console.log('🔑 ID Token:', idToken ? `Present (${idToken.substring(0, 20)}...)` : 'MISSING');
    
    if (!idToken) {
      console.error('❌ Authentication failed: No ID token available');
      console.error('🔍 Debug info:');
      console.error('  - Current user object:', currentUser);
      console.error('  - This usually means the user needs to sign in again');
      throw new Error('User not authenticated - Please sign in again');
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
      const headers = await this.getAuthHeaders();
      const url = `${FIRESTORE_BASE_URL}/${collectionName}/${documentId}`;

      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      if (response.status === 404) {
        return null;
      }

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(`Failed to get document: ${responseData.error?.message || 'Unknown error'}`);
      }

      const convertedData = this.fromFirestoreFormat(responseData.fields);
      return {
        id: this.extractDocumentId(responseData.name),
        ...convertedData
      };
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
        try {
          await this.createDocument(COLLECTIONS.APARTMENT_INVITES, inviteData, inviteCode);
          console.log('Invite record created successfully');
          
          // Add the creator as the first member of the apartment
          const currentUser = await firebaseAuth.getCurrentUser();
          if (currentUser) {
            console.log('👤 Adding apartment creator as first member...');
            try {
              await this.joinApartment(apartment.id, currentUser.localId);
              console.log('✅ Creator added as apartment member');
            } catch (memberError) {
              console.error('⚠️ Failed to add creator as member:', memberError);
              // Don't fail the apartment creation for this
            }
          }
          
          // Success! Return the apartment
          return apartment;
          
        } catch (inviteError: any) {
          console.warn('Failed to create invite record (code collision), cleaning up apartment...');
          
          // Clean up the apartment we just created since invite code collided
          try {
            await this.deleteDocument(COLLECTIONS.APARTMENTS, apartment.id);
            console.log('Apartment cleaned up successfully');
          } catch (cleanupError) {
            console.error('Failed to cleanup apartment:', cleanupError);
          }
          
          // This will trigger a retry with a new code
          throw new Error('Invite code collision detected');
        }
        
      } catch (error: any) {
        console.error(`Create apartment error (attempt ${attempts + 1}):`, error);
        attempts++;
        
        if (attempts >= maxAttempts) {
          throw new Error(`Failed to create apartment after ${maxAttempts} attempts: ${error.message}`);
        }
        
        // Wait a bit before retrying
        await new Promise(resolve => setTimeout(resolve, 100 * attempts));
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
      
      // Look up the invite record first (this should be publicly readable)
      console.log(`📊 Looking up invite record in collection: ${COLLECTIONS.APARTMENT_INVITES}`);
      const inviteRecord = await this.getDocument(COLLECTIONS.APARTMENT_INVITES, normalizedCode);
      console.log('📋 Invite record found:', !!inviteRecord);
      
      if (!inviteRecord) {
        console.log(`❌ No invite record found for code: "${normalizedCode}"`);
        console.log('🔍 Attempting fallback search through all apartments...');
        
        // Fallback: scan all apartments
        const apartments = await this.getCollection(COLLECTIONS.APARTMENTS);
        console.log(`📁 Retrieved ${apartments.length} apartments for fallback search`);
        
        const foundApartment = apartments.find(apt => 
          apt.invite_code && apt.invite_code.toUpperCase() === normalizedCode
        );
        
        if (foundApartment) {
          console.log(`✅ Found apartment via fallback: ${foundApartment.name} (ID: ${foundApartment.id})`);
          return foundApartment;
        } else {
          console.log(`❌ No apartment found with invite code "${normalizedCode}" in fallback search either`);
          // Log all available invite codes for debugging
          const availableCodes = apartments
            .filter(apt => apt.invite_code)
            .map(apt => apt.invite_code);
          console.log('🔎 Available invite codes in database:', availableCodes);
          return null;
        }
      }
      
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
      
    } catch (error) {
      console.error(`❌ Get apartment by invite code error for "${inviteCode}":`, error);
      
      // If it's an authentication error, re-throw it
      if (error instanceof Error && error.message.includes('not authenticated')) {
        throw error;
      }
      
      // For other errors, still try fallback but with better error handling
      try {
        console.log('🔄 Attempting fallback collection scan method...');
        const apartments = await this.getCollection(COLLECTIONS.APARTMENTS);
        console.log(`📁 Retrieved ${apartments.length} apartments via fallback`);
        
        const normalizedCode = inviteCode.trim().toUpperCase();
        const foundApartment = apartments.find(apt => 
          apt.invite_code && apt.invite_code.toUpperCase() === normalizedCode
        );
        
        if (foundApartment) {
          console.log(`✅ Found apartment via fallback: ${foundApartment.name}`);
          return foundApartment;
        } else {
          console.log(`❌ No apartment found with code "${normalizedCode}" in fallback either`);
          return null;
        }
        
      } catch (fallbackError) {
        console.error('❌ Fallback method also failed:', fallbackError);
        return null;
      }
    }
  }

  /**
   * Apartment members management
   */
  async joinApartment(apartmentId: string, userId: string): Promise<any> {
    try {
      console.log(`🤝 Adding user ${userId} to apartment ${apartmentId}`);
      
      const memberId = `${apartmentId}_${userId}`;
      const memberData = {
        apartment_id: apartmentId,
        user_id: userId,
        role: 'member',
        joined_at: new Date(),
      };
      
      // Create the membership record
      console.log('📝 Creating apartment membership record...');
      const membershipResult = await this.createDocument(COLLECTIONS.APARTMENT_MEMBERS, memberData, memberId);
      console.log('✅ Membership record created');
      
      // Update user's current_apartment_id
      console.log('👤 Updating user profile with apartment ID...');
      await this.updateUser(userId, { current_apartment_id: apartmentId });
      console.log('✅ User profile updated');
      
      return membershipResult;
    } catch (error) {
      console.error('❌ Join apartment error:', error);
      throw error;
    }
  }

  /**
   * Join apartment using invite code - Works with Spark Plan (free)
   */
  async joinApartmentByInviteCode(inviteCode: string): Promise<any> {
    try {
      console.log('Joining apartment with code:', inviteCode);
      
      // Look up apartment by invite code
      const apartment = await this.getApartmentByInviteCode(inviteCode);
      
      if (!apartment) {
        throw new Error('קוד דירה לא נמצא. וודא שהקוד נכון ושהדירה קיימת.');
      }
      
      console.log('Found apartment:', apartment);
      return apartment;
    } catch (error) {
      console.error('Join apartment error:', error);
      throw error;
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

  async getApartmentMembers(apartmentId: string): Promise<any[]> {
    return this.queryCollection(COLLECTIONS.APARTMENT_MEMBERS, 'apartment_id', 'EQUAL', apartmentId);
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
}

// Export singleton instance
export const firestoreService = FirestoreService.getInstance();
