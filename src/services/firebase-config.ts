/**
 * Firebase configuration and constants
 * This file contains the Firebase project configuration and API endpoints
 */

// Firebase configuration from your project
export const firebaseConfig = {
  apiKey: "AIzaSyCdVexzHD5StQIK_w3GSbdYHYoE7fBqDps",
  authDomain: "roomies-hub.firebaseapp.com",
  projectId: "roomies-hub",
  storageBucket: "roomies-hub.firebasestorage.app",
  messagingSenderId: "845572884017",
  appId: "1:845572884017:web:37a56b35ad8ea53df6b710",
  measurementId: "G-NQWQ32NKHM"
};

// Firebase Authentication REST API endpoints
export const AUTH_ENDPOINTS = {
  SIGN_UP: `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${firebaseConfig.apiKey}`,
  SIGN_IN: `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseConfig.apiKey}`,
  REFRESH_TOKEN: `https://securetoken.googleapis.com/v1/token?key=${firebaseConfig.apiKey}`,
  RESET_PASSWORD: `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${firebaseConfig.apiKey}`,
  VERIFY_EMAIL: `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${firebaseConfig.apiKey}`,
  GET_USER_DATA: `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseConfig.apiKey}`,
  UPDATE_PROFILE: `https://identitytoolkit.googleapis.com/v1/accounts:update?key=${firebaseConfig.apiKey}`,
};

// Cloud Firestore REST API base URL
export const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents`;

// Collection names based on your Firestore rules
export const COLLECTIONS = {
  USERS: 'users',
  APARTMENTS: 'apartments',
  APARTMENT_MEMBERS: 'apartmentMembers',
  APARTMENT_INVITES: 'apartmentInvites', // Public collection for invite codes
  EXPENSES: 'expenses',
  DEBT_SETTLEMENTS: 'debtSettlements',
  CLEANING_TASKS: 'cleaningTasks',
  SHOPPING_ITEMS: 'shoppingItems',
  DEBTS: 'debts',
  BALANCES: 'balances',
  ACTIONS: 'actions',
};
