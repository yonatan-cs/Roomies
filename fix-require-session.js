const fs = require('fs');

// Read the file
const filePath = 'src/services/firestore-service.ts';
let content = fs.readFileSync(filePath, 'utf8');

// Replace the requireSession function
const oldFunction = `export async function requireSession(): Promise<{ uid: string; idToken: string }> {
  try {
    // Try to get current user and token
    const currentUser = await firebaseAuth.getCurrentUser();
    const idToken = await firebaseAuth.getCurrentIdToken();
    
    if (currentUser?.localId && idToken) {
      console.log('✅ Session available:', { 
        uid: currentUser.localId, 
        tokenPreview: idToken.substring(0, 20) + '...',
        hasUid: !!currentUser.localId,
        hasToken: !!idToken,
        uidLength: currentUser.localId?.length || 0,
        tokenLength: idToken?.length || 0
      });
      return { uid: currentUser.localId, idToken };
    }
    
    // If no current user, try to restore session
    console.log('🔄 No current session, attempting to restore...');
    const restoredUser = await firebaseAuth.restoreUserSession();
    
    if (restoredUser?.localId) {
      const restoredToken = await firebaseAuth.getCurrentIdToken();
      if (restoredToken) {
        console.log('✅ Session restored:', { uid: restoredUser.localId, tokenPreview: restoredToken.substring(0, 20) + '...' });
        return { uid: restoredUser.localId, idToken: restoredToken };
      }
    }
    
    console.log('❌ No valid session found');
    throw new Error('AUTH_REQUIRED');
    
  } catch (error) {
    console.error('❌ Error in requireSession:', error);
    throw new Error('AUTH_REQUIRED');
  }
}`;

const newFunction = `export async function requireSession(): Promise<{ uid: string; idToken: string }> {
  try {
    // Use SDK Auth instead of REST Auth to avoid mismatch
    const { auth } = await import('./firebase-sdk');
    
    if (!auth.currentUser) {
      console.log('❌ No current user in SDK Auth');
      throw new Error('AUTH_REQUIRED');
    }
    
    const uid = auth.currentUser.uid;
    const idToken = await auth.currentUser.getIdToken(true); // Force refresh
    
    console.log('✅ SDK Session available:', { 
      uid: uid, 
      tokenPreview: idToken.substring(0, 20) + '...',
      hasUid: !!uid,
      hasToken: !!idToken,
      uidLength: uid?.length || 0,
      tokenLength: idToken?.length || 0
    });
    
    return { uid, idToken };
    
  } catch (error) {
    console.error('❌ Error in requireSession:', error);
    throw new Error('AUTH_REQUIRED');
  }
}`;

// Replace the function
content = content.replace(oldFunction, newFunction);

// Write back to file
fs.writeFileSync(filePath, content);

console.log('✅ Fixed requireSession function to use SDK Auth');
