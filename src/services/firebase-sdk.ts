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

// 3) Runtime verification function - call this after login
export async function assertSameProject(): Promise<void> {
  try {
    const token = await auth.currentUser?.getIdToken(true);
    if (!token) {
      console.log('⚠️ No auth token available for project verification');
      return;
    }
    
    const payload = JSON.parse(atob(token.split('.')[1]));
    const authProj = payload?.aud || payload?.firebase?.project_id; // פרויקט של הטוקן
    const sdkProj = app.options.projectId;                         // פרויקט של ה-SDK

    console.log('🔍 [DEBUG] auth token project:', authProj, 'sdk project:', sdkProj);
    if (authProj && sdkProj && authProj !== sdkProj) {
      throw new Error(`AUTH_MISMATCH: token=${authProj} sdk=${sdkProj}`);
    }
    console.log('✅ Project verification passed - same project for auth and SDK');
  } catch (error) {
    console.error('❌ Project verification failed:', error);
    throw error;
  }
}

// 4) Client state cleanup function
export async function clearClientState(): Promise<void> {
  try {
    console.log('🧹 Clearing client state...');
    await auth.signOut();
    console.log('✅ Client state cleared - please restart app and login again');
  } catch (error) {
    console.error('❌ Error clearing client state:', error);
    throw error;
  }
}

// Enable debug logging for Firestore (helps debug Rules issues)
if (__DEV__) {
  setLogLevel('debug');
  console.log('🔧 Firestore debug logging enabled');
}

// Connect to emulators in development (if needed)
if (__DEV__ && process.env.EXPO_PUBLIC_USE_EMULATOR === 'true') {
  try {
    // Only connect if not already connected - check project ID instead
    if (!app.options.projectId?.includes('demo-')) {
      connectFirestoreEmulator(db, 'localhost', 8080);
      connectAuthEmulator(auth, 'http://localhost:9099');
      console.log('🔧 Connected to Firebase emulators');
    }
  } catch (error) {
    console.log('⚠️ Emulator connection failed (probably already connected):', error);
  }
}

export default app;
