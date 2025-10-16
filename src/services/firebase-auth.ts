/**
 * Firebase Authentication Service using REST API
 * Handles user authentication operations without Firebase SDK
 */

import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { AUTH_ENDPOINTS } from './firebase-config';

// Types for authentication responses
export interface AuthUser {
  localId: string;
  email: string;
  displayName?: string;
  idToken: string;
  refreshToken: string;
  expiresIn: string;
}

export interface SignUpResponse {
  localId: string;
  email: string;
  idToken: string;
  refreshToken: string;
  expiresIn: string;
}

export interface SignInResponse {
  localId: string;
  email: string;
  displayName?: string;
  idToken: string;
  refreshToken: string;
  expiresIn: string;
  registered: boolean;
}

export interface FirebaseError {
  error: {
    code: number;
    message: string;
    errors: Array<{
      message: string;
      domain: string;
      reason: string;
    }>;
  };
}

// Secure storage keys
const STORAGE_KEYS = {
  ID_TOKEN: 'firebase_id_token',
  REFRESH_TOKEN: 'firebase_refresh_token',
  USER_ID: 'firebase_user_id',
  USER_EMAIL: 'firebase_user_email',
};

/**
 * Firebase Authentication Service Class
 */
export class FirebaseAuthService {
  private static instance: FirebaseAuthService;
  private currentUser: AuthUser | null = null;

  private constructor() {}

  public static getInstance(): FirebaseAuthService {
    if (!FirebaseAuthService.instance) {
      FirebaseAuthService.instance = new FirebaseAuthService();
    }
    return FirebaseAuthService.instance;
  }

  // Safe secure-store getter that swallows errors like "User interaction is not allowed"
  private async safeGetSecureItem(key: string): Promise<string | null> {
    try {
      // Prefer AFTER_FIRST_UNLOCK to avoid requiring biometric interaction in background flows
      const value = await SecureStore.getItemAsync(key, { keychainAccessible: (SecureStore as any).AFTER_FIRST_UNLOCK } as any);
      return value;
    } catch (err: any) {
      const message = err?.message || String(err);
      console.warn(`safeGetSecureItem failed for ${key}`, { 
        errMessage: message, 
        appState: AppState.currentState,
        isUserInteractionError: message.includes('User interaction is not allowed')
      });
      return null;
    }
  }

  /**
   * Sign up a new user with email and password
   */
  async signUp(email: string, password: string, fullName?: string): Promise<AuthUser> {
    try {
      const response = await fetch(AUTH_ENDPOINTS.SIGN_UP, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          returnSecureToken: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw this.handleAuthError(data);
      }

      let authUser: AuthUser = {
        localId: data.localId,
        email: data.email,
        displayName: data.displayName || null,
        idToken: data.idToken,
        refreshToken: data.refreshToken,
        expiresIn: data.expiresIn,
      };

      // If fullName is provided, update the user profile
      if (fullName && fullName.trim()) {
        try {
          await this.updateProfile(data.idToken, { displayName: fullName.trim() });
          authUser.displayName = fullName.trim();
        } catch (profileError) {
          console.warn('Failed to update profile displayName:', profileError);
          // Continue with registration even if profile update fails
        }
      }

      // Store tokens securely
      await this.storeUserTokens(authUser);
      this.currentUser = authUser;
      
      // Update in-memory cache
      const { setInMemoryIdToken } = await import('./firestore-service');
      setInMemoryIdToken(authUser.idToken);

      return authUser;
    } catch (error) {
      console.error('Sign up error:', error);
      throw error;
    }
  }

  /**
   * Sign in an existing user with email and password
   */
  async signIn(email: string, password: string): Promise<AuthUser> {
    try {
      const response = await fetch(AUTH_ENDPOINTS.SIGN_IN, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          returnSecureToken: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw this.handleAuthError(data);
      }

      const authUser: AuthUser = {
        localId: data.localId,
        email: data.email,
        displayName: data.displayName,
        idToken: data.idToken,
        refreshToken: data.refreshToken,
        expiresIn: data.expiresIn,
      };

      // Store tokens securely
      await this.storeUserTokens(authUser);
      this.currentUser = authUser;
      
      // Update in-memory cache
      const { setInMemoryIdToken } = await import('./firestore-service');
      setInMemoryIdToken(authUser.idToken);

      return authUser;
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    }
  }

  /**
   * Send password reset email
   */
  async resetPassword(email: string): Promise<void> {
    try {
      const response = await fetch(AUTH_ENDPOINTS.RESET_PASSWORD, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requestType: 'PASSWORD_RESET',
          email,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw this.handleAuthError(data);
      }
    } catch (error) {
      console.error('Password reset error:', error);
      throw error;
    }
  }

  /**
   * Refresh the ID token using refresh token
   */
  async refreshToken(): Promise<string> {
    try {
      const refreshToken = await this.safeGetSecureItem(STORAGE_KEYS.REFRESH_TOKEN);
      
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      // Use x-www-form-urlencoded as required by Secure Token API
      const body = `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`;
      const response = await fetch(AUTH_ENDPOINTS.REFRESH_TOKEN, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body,
      });

      const data = await response.json();

      if (!response.ok) {
        throw this.handleAuthError(data);
      }

      // Store new tokens with AFTER_FIRST_UNLOCK accessibility for background access
      const opts = { keychainAccessible: (SecureStore as any).AFTER_FIRST_UNLOCK } as any;
      await SecureStore.setItemAsync(STORAGE_KEYS.ID_TOKEN, data.id_token, opts);
      await SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, data.refresh_token, opts);
      
      // Update in-memory cache
      const { setInMemoryIdToken } = await import('./firestore-service');
      setInMemoryIdToken(data.id_token);

      // Schedule pre-refresh at 70% of token lifetime to avoid hitting NO_ID_TOKEN
      const expiresInSec = Number(data.expires_in) || 3600; // Default to 1 hour if not provided
      const refreshBeforeMs = Math.max(30_000, expiresInSec * 1000 * 0.7); // At least 30s, or 70% of lifetime
      
      setTimeout(async () => {
        try {
          console.log('🔄 Pre-refreshing token before expiry...');
          await this.refreshToken();
          console.log('✅ Pre-refresh completed successfully');
        } catch (error) {
          console.warn('⚠️ Pre-refresh failed (will retry on next request):', error);
        }
      }, refreshBeforeMs);
      
      console.log(`⏰ Scheduled pre-refresh in ${Math.round(refreshBeforeMs / 1000)}s`);

      return data.id_token;
    } catch (error) {
      console.error('Token refresh error:', error);
      throw error;
    }
  }

  /**
   * Get current ID token (refresh if expired)
   */
  async getCurrentIdToken(): Promise<string | null> {
    try {
      console.log('🔑 Getting current ID token...');
      // SecureStore may throw if user interaction is not allowed
      let idToken = await this.safeGetSecureItem(STORAGE_KEYS.ID_TOKEN);
      if (!idToken) {
        // Try to refresh immediately when token is missing but refresh_token may be present
        try {
          console.log('🔄 No ID token found. Attempting refresh via refresh_token...');
          idToken = await this.refreshToken();
        } catch (e) {
          console.warn('Immediate token refresh failed:', e);
          // Optional: fallback to AsyncStorage in dev flows
          try {
            idToken = await AsyncStorage.getItem(STORAGE_KEYS.ID_TOKEN);
          } catch (e2) {
            console.warn('AsyncStorage fallback for ID token failed', e2);
          }
        }
      }
      console.log('🔑 Stored ID token:', idToken ? `Present (${idToken.substring(0, 20)}...)` : 'NULL');
      
      if (!idToken) {
        console.log('❌ No ID token found in storage');
        return null;
      }

      // Check if token is expired (basic check)
      const tokenData = this.decodeJWT(idToken);
      const currentTime = Math.floor(Date.now() / 1000);
      
      if (tokenData && tokenData.exp) {
        const timeUntilExpiry = tokenData.exp - currentTime;
        const minutesUntilExpiry = Math.floor(timeUntilExpiry / 60);
        console.log(`⏰ Token expires in ${minutesUntilExpiry} minutes`);
        
        if (tokenData.exp < currentTime) {
          // Token expired, refresh it
          console.log('🔄 Token expired, refreshing...');
          try {
            const newToken = await this.refreshToken();
            console.log('✅ Token refreshed successfully');
            return newToken;
          } catch (error) {
            console.error('❌ Token refresh failed:', error);
            await this.signOut();
            return null;
          }
        }
      }

      console.log('✅ ID token is valid');
      return idToken;
    } catch (error) {
      console.warn('❌ Get current token error:', error);
      return null;
    }
  }

  /**
   * Get current user
   */
  getCurrentUser(): AuthUser | null {
    return this.currentUser;
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    const token = await this.getCurrentIdToken();
    return token !== null;
  }

  /**
   * Sign out user
   */
  async signOut(): Promise<void> {
    try {
      // Clear stored tokens
      await SecureStore.deleteItemAsync(STORAGE_KEYS.ID_TOKEN);
      await SecureStore.deleteItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
      await SecureStore.deleteItemAsync(STORAGE_KEYS.USER_ID);
      await SecureStore.deleteItemAsync(STORAGE_KEYS.USER_EMAIL);
      
      this.currentUser = null;
      
      // Clear in-memory token cache
      const { setInMemoryIdToken } = await import('./firestore-service');
      setInMemoryIdToken(null);
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  }

  /**
   * Restore user session from stored tokens
   */
  async restoreUserSession(): Promise<AuthUser | null> {
    try {
      console.log('Attempting to restore user session...');
      const idToken = await this.getCurrentIdToken();
      const userId = await this.safeGetSecureItem(STORAGE_KEYS.USER_ID);
      const userEmail = await this.safeGetSecureItem(STORAGE_KEYS.USER_EMAIL);

      console.log('Session restoration check:', {
        hasIdToken: !!idToken,
        hasUserId: !!userId,
        hasUserEmail: !!userEmail
      });

      if (idToken && userId && userEmail) {
        const refreshToken = await this.safeGetSecureItem(STORAGE_KEYS.REFRESH_TOKEN);
        
        this.currentUser = {
          localId: userId,
          email: userEmail,
          idToken,
          refreshToken: refreshToken || '',
          expiresIn: '3600', // Default 1 hour
        };

        console.log('User session restored successfully');
        return this.currentUser;
      }

      console.log('No valid session found');
      return null;
    } catch (error) {
      console.warn('Restore session error:', error);
      return null;
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(idToken: string, profileData: { displayName?: string; photoURL?: string }): Promise<void> {
    try {
      const response = await fetch(AUTH_ENDPOINTS.UPDATE_PROFILE, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          idToken,
          ...profileData,
          returnSecureToken: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw this.handleAuthError(data);
      }

      // Update current user if available
      if (this.currentUser) {
        this.currentUser.displayName = profileData.displayName || this.currentUser.displayName;
      }
    } catch (error) {
      console.error('Update profile error:', error);
      throw error;
    }
  }

  /**
   * Store user tokens securely
   */
  private async storeUserTokens(user: AuthUser): Promise<void> {
    await SecureStore.setItemAsync(STORAGE_KEYS.ID_TOKEN, user.idToken);
    await SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, user.refreshToken);
    await SecureStore.setItemAsync(STORAGE_KEYS.USER_ID, user.localId);
    await SecureStore.setItemAsync(STORAGE_KEYS.USER_EMAIL, user.email);
  }

  /**
   * Handle Firebase authentication errors
   * Returns error codes that can be translated in the UI layer
   */
  private handleAuthError(errorData: FirebaseError): Error {
    const errorMessage = errorData.error?.message || 'AUTHENTICATION_FAILED';
    
    // Map Firebase errors to error codes (not translated here - will be translated in UI)
    const errorCodes: { [key: string]: string } = {
      'EMAIL_EXISTS': 'EMAIL_EXISTS',
      'OPERATION_NOT_ALLOWED': 'OPERATION_NOT_ALLOWED',
      'TOO_MANY_ATTEMPTS_TRY_LATER': 'TOO_MANY_ATTEMPTS',
      'EMAIL_NOT_FOUND': 'EMAIL_NOT_FOUND',
      'INVALID_PASSWORD': 'INVALID_PASSWORD',
      'USER_DISABLED': 'USER_DISABLED',
      'INVALID_EMAIL': 'INVALID_EMAIL',
      'WEAK_PASSWORD': 'WEAK_PASSWORD',
    };

    for (const [key, code] of Object.entries(errorCodes)) {
      if (errorMessage.includes(key)) {
        return new Error(code);
      }
    }

    return new Error('AUTHENTICATION_FAILED');
  }

  /**
   * Decode JWT token (basic implementation)
   */
  private decodeJWT(token: string): any {
    try {
      const parts = token.split('.');
      const payload = parts[1];
      const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(decoded);
    } catch (error) {
      console.error('JWT decode error:', error);
      return {};
    }
  }
}

// Export singleton instance
export const firebaseAuth = FirebaseAuthService.getInstance();
