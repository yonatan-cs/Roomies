// Centralized Real-time Listener Manager
// Manages all Firestore onSnapshot listeners to prevent duplicates and ensure proper cleanup

import { Unsubscribe } from 'firebase/firestore';
import { firestoreSDKService } from './firestore-sdk-service';

/**
 * Type definition for listener metadata
 */
interface ListenerMetadata {
  unsubscribe: Unsubscribe;
  collectionName: string;
  createdAt: Date;
}

/**
 * Centralized manager for all real-time Firestore listeners
 * Ensures only one listener per collection and proper cleanup
 */
class RealtimeManager {
  private static instance: RealtimeManager;
  private activeListeners: Map<string, ListenerMetadata> = new Map();

  private constructor() {
    console.log('📡 RealtimeManager initialized');
  }

  /**
   * Get singleton instance
   */
  static getInstance(): RealtimeManager {
    if (!RealtimeManager.instance) {
      RealtimeManager.instance = new RealtimeManager();
    }
    return RealtimeManager.instance;
  }

  /**
   * Subscribe to a Firestore collection with real-time updates
   * @param key Unique identifier for this listener (e.g., 'shopping_items', 'expenses')
   * @param collectionName Firestore collection name
   * @param callback Function to call with updated documents
   * @param filters Optional filters to apply to the query
   * @param orderByField Optional field to order results by
   * @param orderDirection Optional direction for ordering
   * @returns Unsubscribe function
   */
  subscribeToCollection(
    key: string,
    collectionName: string,
    callback: (docs: any[]) => void,
    filters?: { field: string; operator: any; value: any }[],
    orderByField?: string,
    orderDirection: 'asc' | 'desc' = 'desc'
  ): Unsubscribe {
    // If listener already exists for this key, unsubscribe first
    if (this.activeListeners.has(key)) {
      console.log(`📡 Replacing existing listener for: ${key}`);
      this.unsubscribeFromCollection(key);
    }

    console.log(`📡 Starting real-time listener for: ${key} (collection: ${collectionName})`);

    // Create the onSnapshot listener
    const unsubscribe = firestoreSDKService.subscribeToCollection(
      collectionName,
      callback,
      filters,
      orderByField,
      orderDirection
    );

    // Store the listener metadata
    this.activeListeners.set(key, {
      unsubscribe,
      collectionName,
      createdAt: new Date(),
    });

    console.log(`✅ Active listeners count: ${this.activeListeners.size}`);

    // Return unsubscribe function that also removes from our map
    return () => {
      this.unsubscribeFromCollection(key);
    };
  }

  /**
   * Unsubscribe from a specific listener
   * @param key Unique identifier for the listener
   */
  unsubscribeFromCollection(key: string): void {
    const listener = this.activeListeners.get(key);
    if (listener) {
      console.log(`📡 Stopping real-time listener for: ${key}`);
      listener.unsubscribe();
      this.activeListeners.delete(key);
      console.log(`✅ Active listeners count: ${this.activeListeners.size}`);
    }
  }

  /**
   * Check if a listener is currently active
   * @param key Unique identifier for the listener
   */
  isListenerActive(key: string): boolean {
    return this.activeListeners.has(key);
  }

  /**
   * Get all active listener keys
   */
  getActiveListeners(): string[] {
    return Array.from(this.activeListeners.keys());
  }

  /**
   * Clean up all active listeners
   * Should be called when app goes to background or user logs out
   */
  cleanupAllListeners(): void {
    console.log(`🧹 Cleaning up all listeners (${this.activeListeners.size} active)`);
    this.activeListeners.forEach((listener, key) => {
      console.log(`  - Stopping listener: ${key}`);
      listener.unsubscribe();
    });
    this.activeListeners.clear();
    console.log('✅ All listeners cleaned up');
  }

  /**
   * Get debug information about active listeners
   */
  getDebugInfo(): any {
    const listeners: any[] = [];
    this.activeListeners.forEach((listener, key) => {
      listeners.push({
        key,
        collection: listener.collectionName,
        createdAt: listener.createdAt.toISOString(),
        ageInSeconds: Math.floor((Date.now() - listener.createdAt.getTime()) / 1000),
      });
    });
    return {
      totalActive: this.activeListeners.size,
      listeners,
    };
  }
}

// Export singleton instance
export const realtimeManager = RealtimeManager.getInstance();

