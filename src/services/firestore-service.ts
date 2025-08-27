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
    const idToken = await firebaseAuth.getCurrentIdToken();
    if (!idToken) {
      throw new Error('User not authenticated');
    }

    return {
      'Authorization': `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    };
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
      const headers = await this.getAuthHeaders();
      let url = `${FIRESTORE_BASE_URL}/${collectionName}`;
      
      if (documentId) {
        url += `?documentId=${documentId}`;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          fields: this.toFirestoreFormat(data)
        }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(`Failed to create document: ${responseData.error?.message || 'Unknown error'}`);
      }

      const convertedData = this.fromFirestoreFormat(responseData.fields);
      return {
        id: this.extractDocumentId(responseData.name),
        ...convertedData
      };
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

      const responseData = await response.json();

      if (!response.ok) {
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
      throw error;
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

  async updateUser(userId: string, userData: { full_name?: string; phone?: string }): Promise<any> {
    return this.updateDocument(COLLECTIONS.USERS, userId, userData);
  }

  /**
   * Apartment management
   */
  async createApartment(apartmentData: {
    name: string;
    description?: string;
    invite_code: string;
  }): Promise<any> {
    return this.createDocument(COLLECTIONS.APARTMENTS, apartmentData);
  }

  async getApartment(apartmentId: string): Promise<any | null> {
    return this.getDocument(COLLECTIONS.APARTMENTS, apartmentId);
  }

  async getApartmentByInviteCode(inviteCode: string): Promise<any | null> {
    const apartments = await this.queryCollection(COLLECTIONS.APARTMENTS, 'invite_code', 'EQUAL', inviteCode);
    return apartments.length > 0 ? apartments[0] : null;
  }

  /**
   * Apartment members management
   */
  async joinApartment(apartmentId: string, userId: string): Promise<any> {
    const memberId = `${apartmentId}_${userId}`;
    const memberData = {
      apartment_id: apartmentId,
      user_id: userId,
      role: 'member',
      joined_at: new Date(),
    };
    
    return this.createDocument(COLLECTIONS.APARTMENT_MEMBERS, memberData, memberId);
  }

  async leaveApartment(apartmentId: string, userId: string): Promise<void> {
    const memberId = `${apartmentId}_${userId}`;
    return this.deleteDocument(COLLECTIONS.APARTMENT_MEMBERS, memberId);
  }

  async getApartmentMembers(apartmentId: string): Promise<any[]> {
    return this.queryCollection(COLLECTIONS.APARTMENT_MEMBERS, 'apartment_id', 'EQUAL', apartmentId);
  }

  /**
   * Generate unique 6-character invite code
   */
  async generateUniqueInviteCode(): Promise<string> {
    let inviteCode: string;
    let attempts = 0;
    const maxAttempts = 10;

    do {
      inviteCode = Math.random().toString(36).toUpperCase().slice(2, 8);
      const existingApartment = await this.getApartmentByInviteCode(inviteCode);
      
      if (!existingApartment) {
        return inviteCode;
      }
      
      attempts++;
    } while (attempts < maxAttempts);

    throw new Error('Unable to generate unique invite code');
  }
}

// Export singleton instance
export const firestoreService = FirestoreService.getInstance();
