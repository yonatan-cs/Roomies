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
   * Get authenticated headers for requests
   */
  private async getAuthHeaders(): Promise<HeadersInit> {
    console.log('Getting auth headers...');
    const idToken = await firebaseAuth.getCurrentIdToken();
    console.log('ID Token:', idToken ? 'Present' : 'Missing');
    
    if (!idToken) {
      throw new Error('User not authenticated');
    }

    const headers = {
      'Authorization': `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    };
    
    console.log('Auth headers prepared');
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
      console.log(`Creating document in collection: ${collectionName}`, data);
      
      const headers = await this.getAuthHeaders();
      let url = `${FIRESTORE_BASE_URL}/${collectionName}`;
      
      if (documentId) {
        url += `?documentId=${documentId}`;
      }

      console.log('Request URL:', url);
      console.log('Request headers:', headers);

      const requestBody = {
        fields: this.toFirestoreFormat(data)
      };
      console.log('Request body:', JSON.stringify(requestBody, null, 2));

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      const responseData = await response.json();
      console.log('Response status:', response.status);
      console.log('Response data:', responseData);

      if (!response.ok) {
        throw new Error(`Failed to create document: ${responseData.error?.message || 'Unknown error'}`);
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
      const headers = await this.getAuthHeaders();
      const url = `${FIRESTORE_BASE_URL}/${collectionName}`;

      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      if (response.status === 404) {
        // Collection doesn't exist yet, return empty array
        return [];
      }

      const responseData = await response.json();

      if (!response.ok) {
        // Handle specific Firestore errors
        if (responseData.error?.status === 'NOT_FOUND') {
          return [];
        }
        throw new Error(`Failed to get collection: ${responseData.error?.message || 'Unknown error'}`);
      }

      if (!responseData.documents) {
        return [];
      }

      return responseData.documents.map((doc: FirestoreDocument) => ({
        id: this.extractDocumentId(doc.name),
        ...this.fromFirestoreFormat(doc.fields)
      }));
    } catch (error) {
      console.error('Get collection error:', error);
      // Return empty array instead of throwing for collection access errors
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

    return this.createDocument(COLLECTIONS.USERS, userData, user.localId);
  }

  async getUser(userId: string): Promise<any | null> {
    return this.getDocument(COLLECTIONS.USERS, userId);
  }

  async updateUser(userId: string, userData: { full_name?: string; phone?: string; current_apartment_id?: string }): Promise<any> {
    return this.updateDocument(COLLECTIONS.USERS, userId, userData);
  }

  /**
   * Apartment management - Now using Cloud Functions for secure creation
   */
  async createApartment(apartmentData: {
    name: string;
    description?: string;
  }): Promise<any> {
    try {
      console.log('Creating apartment via Cloud Function...');
      
      // Call Cloud Function for secure apartment creation
      const response = await fetch(`https://us-central1-${firebaseConfig.projectId}.cloudfunctions.net/createApartmentWithInvite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await firebaseAuth.getCurrentIdToken()}`,
        },
        body: JSON.stringify({
          data: {
            name: apartmentData.name,
            description: apartmentData.description || '',
          }
        }),
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error?.message || 'Failed to create apartment');
      }

      console.log('Apartment created successfully via Cloud Function:', result.result);
      return result.result.apartment;
    } catch (error) {
      console.error('Create apartment error:', error);
      throw error;
    }
  }

  async getApartment(apartmentId: string): Promise<any | null> {
    return this.getDocument(COLLECTIONS.APARTMENTS, apartmentId);
  }

  async getApartmentByInviteCode(inviteCode: string): Promise<any | null> {
    try {
      console.log('Searching for apartment with invite code:', inviteCode);
      
      // Look up the invite record first (this should be publicly readable)
      const inviteRecord = await this.getDocument(COLLECTIONS.APARTMENT_INVITES, inviteCode);
      console.log('Invite record found:', !!inviteRecord);
      
      if (!inviteRecord) {
        console.log('No invite record found for code:', inviteCode);
        return null;
      }
      
      console.log('Invite record details:', inviteRecord);
      
      // Now get the actual apartment using the apartment_id from the invite record
      const apartment = await this.getApartment(inviteRecord.apartment_id);
      console.log('Apartment found via invite lookup:', !!apartment);
      
      if (apartment) {
        // Ensure the invite code matches (double check)
        if (apartment.invite_code === inviteCode) {
          return apartment;
        } else {
          console.warn('Invite code mismatch in apartment document');
          return null;
        }
      }
      
      return null;
    } catch (error) {
      console.error('Get apartment by invite code error:', error);
      
      // Fallback: try the old method if the new structure doesn't exist yet
      try {
        console.log('Falling back to collection scan method...');
        const apartments = await this.getCollection(COLLECTIONS.APARTMENTS);
        console.log('Retrieved apartments via fallback:', apartments.length);
        
        const foundApartment = apartments.find(apt => apt.invite_code === inviteCode);
        console.log('Found apartment via fallback:', foundApartment ? 'YES' : 'NO');
        
        return foundApartment || null;
      } catch (fallbackError) {
        console.error('Fallback method also failed:', fallbackError);
        return null;
      }
    }
  }

  /**
   * Apartment members management
   */
  async joinApartment(apartmentId: string, userId: string): Promise<any> {
    // This method is now deprecated in favor of joinApartmentByInviteCode
    // Keeping for backward compatibility
    const memberId = `${apartmentId}_${userId}`;
    const memberData = {
      apartment_id: apartmentId,
      user_id: userId,
      role: 'member',
      joined_at: new Date(),
    };
    
    return this.createDocument(COLLECTIONS.APARTMENT_MEMBERS, memberData, memberId);
  }

  /**
   * Join apartment using invite code via Cloud Function
   */
  async joinApartmentByInviteCode(inviteCode: string): Promise<any> {
    try {
      console.log('Joining apartment via Cloud Function with code:', inviteCode);
      
      // Call Cloud Function for secure apartment joining
      const response = await fetch(`https://us-central1-${firebaseConfig.projectId}.cloudfunctions.net/joinApartment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await firebaseAuth.getCurrentIdToken()}`,
        },
        body: JSON.stringify({
          data: {
            inviteCode: inviteCode.toUpperCase(),
          }
        }),
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error?.message || 'Failed to join apartment');
      }

      console.log('Joined apartment successfully via Cloud Function:', result.result);
      return result.result.apartment;
    } catch (error) {
      console.error('Join apartment error:', error);
      throw error;
    }
  }

  async leaveApartment(apartmentId: string, userId: string): Promise<void> {
    const memberId = `${apartmentId}_${userId}`;
    return this.deleteDocument(COLLECTIONS.APARTMENT_MEMBERS, memberId);
  }

  async getApartmentMembers(apartmentId: string): Promise<any[]> {
    return this.queryCollection(COLLECTIONS.APARTMENT_MEMBERS, 'apartment_id', 'EQUAL', apartmentId);
  }

  /**
   * Get user's current apartment based on apartment membership
   */
  async getUserCurrentApartment(userId: string): Promise<any | null> {
    try {
      // Check if user is authenticated first
      const idToken = await firebaseAuth.getCurrentIdToken();
      if (!idToken) {
        console.log('No authentication token, skipping apartment lookup');
        return null;
      }

      // Get all apartment members and filter by user
      const allMembers = await this.getCollection(COLLECTIONS.APARTMENT_MEMBERS);
      const userMembership = allMembers.find(member => member.user_id === userId);
      
      if (!userMembership) {
        return null;
      }

      // Get the apartment details
      return await this.getApartment(userMembership.apartment_id);
    } catch (error) {
      console.error('Get user current apartment error:', error);
      return null;
    }
  }

  /**
   * Generate unique 6-character invite code
   * Uses timestamp + random for better uniqueness without needing to query existing codes
   */
  generateUniqueInviteCode(): string {
    // Use timestamp + random for better uniqueness
    const timestamp = Date.now().toString(36).slice(-3); // Last 3 chars of timestamp
    const random = Math.random().toString(36).slice(2, 5); // 3 random chars
    const inviteCode = (timestamp + random).toUpperCase().slice(0, 6);
    
    // Ensure it's exactly 6 characters
    if (inviteCode.length < 6) {
      const padding = Math.random().toString(36).slice(2, 8 - inviteCode.length);
      return (inviteCode + padding).toUpperCase().slice(0, 6);
    }
    
    return inviteCode;
  }
}

// Export singleton instance
export const firestoreService = FirestoreService.getInstance();
