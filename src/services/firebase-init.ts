/**
 * Firebase Initialization
 * Initialize Firebase app for React Native Firebase
 */

import { initializeApp, getApps } from '@react-native-firebase/app';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCdVexzHD5StQIK_w3GSbdYHYoE7fBqDps",
  authDomain: "roomies-hub.firebaseapp.com",
  projectId: "roomies-hub",
  storageBucket: "roomies-hub.firebasestorage.app",
  messagingSenderId: "845572884017",
  appId: "1:845572884017:web:37a56b35ad8ea53df6b710",
  measurementId: "G-NQWQ32NKHM"
};

// Initialize Firebase if not already initialized
if (getApps().length === 0) {
  initializeApp(firebaseConfig);
  console.log('✅ Firebase initialized successfully');
} else {
  console.log('✅ Firebase already initialized');
}

export default firebaseConfig;
