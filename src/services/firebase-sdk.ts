/**
 * Firebase Web SDK Configuration
 * This file sets up Firebase Web SDK for client-side operations
 * Used for transactions and other operations that require SDK features
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator, setLogLevel } from 'firebase/firestore';
import { initializeAuth, getReactNativePersistence, connectAuthEmulator } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { firebaseConfig } from './firebase-config';

// Initialize Firebase app
const app = initializeApp(firebaseConfig);

// Initialize Firestore
export const db = getFirestore(app);

// Initialize Auth with AsyncStorage persistence for React Native
export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

// Enable debug logging for Firestore (helps debug Rules issues)
if (__DEV__) {
  setLogLevel('debug');
  console.log('🔧 Firestore debug logging enabled');
}

// Connect to emulators in development (if needed)
if (__DEV__ && process.env.EXPO_PUBLIC_USE_EMULATOR === 'true') {
  try {
    // Only connect if not already connected
    if (!firebaseConfig.projectId?.includes('demo-')) {
      connectFirestoreEmulator(db, 'localhost', 8080);
      connectAuthEmulator(auth, 'http://localhost:9099');
      console.log('🔧 Connected to Firebase emulators');
    }
  } catch (error) {
    console.log('⚠️ Emulator connection failed (probably already connected):', error);
  }
}

export default app;
