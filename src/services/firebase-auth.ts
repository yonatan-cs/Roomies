/**
 * Firebase Authentication Service using REST API
 * Handles user authentication operations without Firebase SDK
 */

import * as SecureStore from 'expo-secure-store';
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
          displayName: fullName,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw this.handleAuthError(data);
      }

      const authUser: AuthUser = {
        localId: data.localId,
        email: data.email,
        displayName: fullName,
        idToken: data.idToken,
        refreshToken: data.refreshToken,
        expiresIn: data.expiresIn,
      };

      // Store tokens securely
      await this.storeUserTokens(authUser);
      this.currentUser = authUser;

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
      const refreshToken = await SecureStore.getItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
      
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await fetch(AUTH_ENDPOINTS.REFRESH_TOKEN, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw this.handleAuthError(data);
      }

      // Store new tokens
      await SecureStore.setItemAsync(STORAGE_KEYS.ID_TOKEN, data.id_token);
      await SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, data.refresh_token);

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
      const idToken = await SecureStore.getItemAsync(STORAGE_KEYS.ID_TOKEN);
      
      if (!idToken) {
        return null;
      }

      // Check if token is expired (basic check)
      const tokenData = this.decodeJWT(idToken);
      const currentTime = Math.floor(Date.now() / 1000);
      
      if (tokenData.exp && tokenData.exp < currentTime) {
        // Token expired, refresh it
        return await this.refreshToken();
      }

      return idToken;
    } catch (error) {
      console.error('Get current token error:', error);
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
      const idToken = await this.getCurrentIdToken();
      const userId = await SecureStore.getItemAsync(STORAGE_KEYS.USER_ID);
      const userEmail = await SecureStore.getItemAsync(STORAGE_KEYS.USER_EMAIL);

      if (idToken && userId && userEmail) {
        const refreshToken = await SecureStore.getItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
        
        this.currentUser = {
          localId: userId,
          email: userEmail,
          idToken,
          refreshToken: refreshToken || '',
          expiresIn: '3600', // Default 1 hour
        };

        return this.currentUser;
      }

      return null;
    } catch (error) {
      console.error('Restore session error:', error);
      return null;
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
   */
  private handleAuthError(errorData: FirebaseError): Error {
    const errorMessage = errorData.error?.message || 'Authentication failed';
    
    // Convert Firebase error messages to user-friendly Hebrew messages
    const errorTranslations: { [key: string]: string } = {
      'EMAIL_EXISTS': 'כתובת האימייל כבר קיימת במערכת',
      'OPERATION_NOT_ALLOWED': 'פעולה זו אינה מורשת',
      'TOO_MANY_ATTEMPTS_TRY_LATER': 'יותר מדי ניסיונות. נסה שוב מאוחר יותר',
      'EMAIL_NOT_FOUND': 'כתובת אימייל לא נמצאה',
      'INVALID_PASSWORD': 'סיסמה שגויה',
      'USER_DISABLED': 'משתמש זה הושבת',
      'INVALID_EMAIL': 'כתובת אימייל לא חוקית',
      'WEAK_PASSWORD': 'הסיסמה חייבת להכיל לפחות 6 תווים',
    };

    for (const [key, translation] of Object.entries(errorTranslations)) {
      if (errorMessage.includes(key)) {
        return new Error(translation);
      }
    }

    return new Error('שגיאה באימות המשתמש');
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
