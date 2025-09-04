/**
 * Firebase Web SDK Configuration
 * This file sets up Firebase Web SDK for client-side operations
 * Used for transactions and other operations that require SDK features
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { firebaseConfig } from './firebase-config';

// Initialize Firebase app
const app = initializeApp(firebaseConfig);

// Initialize Firestore
export const db = getFirestore(app);

// Initialize Auth
export const auth = getAuth(app);

// Connect to emulators in development (if needed)
if (__DEV__ && process.env.EXPO_PUBLIC_USE_EMULATOR === 'true') {
  try {
    // Only connect if not already connected
    if (!db._delegate._databaseId.projectId.includes('demo-')) {
      connectFirestoreEmulator(db, 'localhost', 8080);
      connectAuthEmulator(auth, 'http://localhost:9099');
      console.log('🔧 Connected to Firebase emulators');
    }
  } catch (error) {
    console.log('⚠️ Emulator connection failed (probably already connected):', error);
  }
}

export default app;
