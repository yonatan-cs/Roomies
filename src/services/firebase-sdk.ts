/**
 * Firebase Web SDK Configuration
 * This file sets up Firebase Web SDK for client-side operations
 * Used for transactions and other operations that require SDK features
 */

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, setLogLevel } from 'firebase/firestore';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { firebaseConfig } from './firebase-config';

// Initialize Firebase app - use existing app if available
export const app: FirebaseApp = getApps()[0] ?? initializeApp(firebaseConfig);

// Initialize Firestore and Auth with the same app
export const db = getFirestore(app);
export const auth = getAuth(app);

// 2) Debug check - both must be 'roomies-hub'
console.log('🔍 Firebase App Debug:');
console.log('auth project:', auth.app.options.projectId);
console.log('db project:', db.app.options.projectId);
console.log('app name:', app.name);

// Enable debug logging for Firestore (helps debug Rules issues)
if (__DEV__) {
  setLogLevel('debug');
  console.log('🔧 Firestore debug logging enabled');
}

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
