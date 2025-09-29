/**
 * Example usage of navigation helpers
 * Demonstrates how to use the new utility functions for robust navigation
 */

import { 
  isValidApartmentId, 
  fetchWithRetry, 
  validateUserSession, 
  safeNavigate,
  validateApartmentIdWithLogging 
} from '../utils/navigation-helpers';

// Example 1: Basic apartment ID validation
export function exampleApartmentIdValidation() {
  const testCases = [
    null,
    undefined,
    '',
    '   ',
    'null',
    'NULL',
    'apartment123',
    'valid-apartment-id'
  ];

  testCases.forEach(testCase => {
    const isValid = isValidApartmentId(testCase);
    console.log(`Apartment ID "${testCase}" is valid: ${isValid}`);
  });
}

// Example 2: Enhanced validation with logging
export function exampleEnhancedValidation(apartmentId: any) {
  const validation = validateApartmentIdWithLogging(apartmentId, 'Example');
  
  if (validation.isValid) {
    console.log('✅ Valid apartment ID:', apartmentId);
    return true;
  } else {
    console.log('❌ Invalid apartment ID:', validation.reason);
    return false;
  }
}

// Example 3: Retry logic for API calls
export async function exampleRetryLogic() {
  try {
    const result = await fetchWithRetry(
      async () => {
        // Simulate API call that might fail
        const success = Math.random() > 0.7; // 30% success rate
        if (!success) {
          throw new Error('API call failed');
        }
        return { data: 'success' };
      },
      3, // 3 attempts
      300 // 300ms base delay
    );
    
    console.log('✅ API call succeeded:', result);
    return result;
  } catch (error) {
    console.error('❌ All retry attempts failed:', error);
    throw error;
  }
}

// Example 4: User session validation
export async function exampleUserSessionValidation(
  getCurrentUser: () => any,
  getCurrentIdToken: () => Promise<string | null>
) {
  const sessionValidation = await validateUserSession(getCurrentUser, getCurrentIdToken);
  
  if (sessionValidation.isValid) {
    console.log('✅ Valid user session:', {
      userId: sessionValidation.user?.id,
      hasToken: !!sessionValidation.idToken
    });
    return sessionValidation;
  } else {
    console.log('❌ Invalid user session:', sessionValidation.error);
    return null;
  }
}

// Example 5: Safe navigation
export function exampleSafeNavigation(navigation: any) {
  // Safe navigation to apartment screen
  safeNavigate(
    navigation,
    'ApartmentMain',
    { apartmentId: 'apartment123' },
    'Example Navigation'
  );
  
  // Safe navigation to welcome screen
  safeNavigate(
    navigation,
    'Welcome',
    undefined,
    'Example Navigation'
  );
}

// Example 6: Complete navigation flow
export async function exampleCompleteNavigationFlow(
  navigation: any,
  currentUser: any,
  getCurrentUser: () => any,
  getCurrentIdToken: () => Promise<string | null>
) {
  try {
    // Step 1: Validate user session
    const sessionValidation = await validateUserSession(getCurrentUser, getCurrentIdToken);
    if (!sessionValidation.isValid) {
      console.log('🔐 No valid session, navigating to Auth');
      safeNavigate(navigation, 'Auth', undefined, 'Complete Flow');
      return;
    }

    // Step 2: Check apartment ID
    const apartmentId = currentUser?.current_apartment_id;
    const apartmentValidation = validateApartmentIdWithLogging(apartmentId, 'Complete Flow');
    
    if (apartmentValidation.isValid) {
      console.log('🏠 Valid apartment ID, navigating to apartment');
      safeNavigate(navigation, 'ApartmentMain', { apartmentId }, 'Complete Flow');
    } else {
      console.log('📭 No valid apartment, navigating to welcome');
      safeNavigate(navigation, 'Welcome', undefined, 'Complete Flow');
    }
    
  } catch (error) {
    console.error('❌ Navigation flow failed:', error);
    // Fallback to welcome screen
    safeNavigate(navigation, 'Welcome', undefined, 'Complete Flow - Fallback');
  }
}

// Example 7: Error handling patterns
export function exampleErrorHandling() {
  // Pattern 1: Graceful degradation
  const apartmentId = null;
  if (isValidApartmentId(apartmentId)) {
    console.log('Navigate to apartment');
  } else {
    console.log('Navigate to welcome - graceful fallback');
  }

  // Pattern 2: Retry with fallback
  fetchWithRetry(
    () => Promise.reject(new Error('Always fails')),
    2,
    100
  ).catch(() => {
    console.log('Retry failed, using fallback');
    // Use fallback logic here
  });

  // Pattern 3: Validation with detailed logging
  const validation = validateApartmentIdWithLogging('invalid-id', 'Error Handling');
  if (!validation.isValid) {
    console.log('Handling invalid apartment ID:', validation.reason);
  }
}
