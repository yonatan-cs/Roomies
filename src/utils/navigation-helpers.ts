/**
 * Navigation and apartment ID validation helpers
 * Provides utilities for robust apartment ID checking and retry logic
 */

/**
 * Validates if a value is a valid apartment ID
 * Checks for null, undefined, empty string, and "null" string
 */
export function isValidApartmentId(v?: any): v is string {
  if (!v || typeof v !== 'string') return false;
  const s = v.trim();
  if (!s) return false;
  if (s.toLowerCase() === 'null') return false;
  return true;
}

/**
 * Retry utility with exponential backoff
 * Useful for handling race conditions and temporary failures
 */
export async function fetchWithRetry<T>(
  fn: () => Promise<T>, 
  attempts = 3, 
  baseDelayMs = 300
): Promise<T> {
  let lastErr: any;
  
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i < attempts - 1) {
        const delay = baseDelayMs * (2 ** i);
        console.log(`🔄 Retry attempt ${i + 1}/${attempts} after ${delay}ms delay`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  console.error(`❌ All ${attempts} attempts failed, throwing last error:`, lastErr);
  throw lastErr;
}

/**
 * Enhanced apartment ID validation with detailed logging
 */
export function validateApartmentIdWithLogging(
  apartmentId: any, 
  context: string
): { isValid: boolean; reason?: string } {
  if (!apartmentId) {
    console.log(`📭 ${context}: No apartment ID provided`);
    return { isValid: false, reason: 'NO_APARTMENT_ID' };
  }
  
  if (typeof apartmentId !== 'string') {
    console.log(`❌ ${context}: Apartment ID is not a string:`, typeof apartmentId);
    return { isValid: false, reason: 'INVALID_TYPE' };
  }
  
  const trimmed = apartmentId.trim();
  if (!trimmed) {
    console.log(`📭 ${context}: Apartment ID is empty string`);
    return { isValid: false, reason: 'EMPTY_STRING' };
  }
  
  if (trimmed.toLowerCase() === 'null') {
    console.log(`📭 ${context}: Apartment ID is "null" string`);
    return { isValid: false, reason: 'NULL_STRING' };
  }
  
  console.log(`✅ ${context}: Valid apartment ID: ${trimmed}`);
  return { isValid: true };
}

/**
 * Safe navigation with error handling
 * Prevents navigation errors from crashing the app
 */
export function safeNavigate(
  navigation: any,
  routeName: string,
  params?: any,
  context: string = 'Navigation'
) {
  try {
    console.log(`🧭 ${context}: Navigating to ${routeName}`, params ? { params } : '');
    navigation.reset({
      index: 0,
      routes: [{ name: routeName, params }]
    });
  } catch (error) {
    console.error(`❌ ${context}: Navigation failed:`, error);
    // Fallback navigation
    try {
      navigation.navigate(routeName, params);
    } catch (fallbackError) {
      console.error(`❌ ${context}: Fallback navigation also failed:`, fallbackError);
    }
  }
}

/**
 * Enhanced user session validation
 * Checks for valid auth state before proceeding
 */
export async function validateUserSession(
  getCurrentUser: () => any,
  getCurrentIdToken: () => Promise<string | null>
): Promise<{ isValid: boolean; user?: any; idToken?: string; error?: string }> {
  try {
    const user = getCurrentUser();
    if (!user) {
      console.log('🔐 No authenticated user found');
      return { isValid: false, error: 'NO_USER' };
    }
    
    // Try to get ID token with a small retry
    let idToken: string | null = null;
    for (let i = 0; i < 3; i++) {
      try {
        idToken = await getCurrentIdToken();
        if (idToken) break;
      } catch (e) {
        console.log(`🔄 ID token attempt ${i + 1}/3 failed:`, e);
        if (i < 2) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
    }
    
    if (!idToken) {
      console.log('🔐 No valid ID token available');
      return { isValid: false, error: 'NO_ID_TOKEN' };
    }
    
    console.log('✅ User session validated successfully');
    return { isValid: true, user, idToken };
    
  } catch (error) {
    console.error('❌ User session validation failed:', error);
    return { isValid: false, error: 'VALIDATION_ERROR' };
  }
}
