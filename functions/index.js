const functions = require('firebase-functions');
const admin = require('firebase-admin');

// Initialize Firebase Admin
admin.initializeApp();

const db = admin.firestore();

/**
 * Cloud Function to create apartment with secure invite code generation
 * This ensures atomic creation of apartment and invite code
 */
exports.createApartmentWithInvite = functions.https.onCall(async (data, context) => {
  // Verify user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { name, description = '' } = data;
  const userId = context.auth.uid;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw new functions.https.HttpsError('invalid-argument', 'Apartment name is required');
  }

  try {
    // Generate unique invite code
    const inviteCode = await generateUniqueInviteCode();
    
    // Create apartment document
    const apartmentData = {
      name: name.trim(),
      description: description.trim(),
      invite_code: inviteCode,
      created_by: userId,
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Use transaction to ensure atomic creation
    const result = await db.runTransaction(async (transaction) => {
      // Create apartment document
      const apartmentRef = db.collection('apartments').doc();
      transaction.set(apartmentRef, apartmentData);

      // Create invite record
      const inviteRef = db.collection('apartmentInvites').doc(inviteCode);
      const inviteData = {
        apartment_id: apartmentRef.id,
        apartment_name: apartmentData.name,
        invite_code: inviteCode,
        created_at: admin.firestore.FieldValue.serverTimestamp(),
      };
      transaction.set(inviteRef, inviteData);

      // Add user as admin member
      const memberId = `${apartmentRef.id}_${userId}`;
      const memberRef = db.collection('apartmentMembers').doc(memberId);
      const memberData = {
        apartment_id: apartmentRef.id,
        user_id: userId,
        role: 'admin',
        joined_at: admin.firestore.FieldValue.serverTimestamp(),
      };
      transaction.set(memberRef, memberData);

      return {
        apartmentId: apartmentRef.id,
        inviteCode: inviteCode,
        memberId: memberId
      };
    });

    return {
      success: true,
      apartment: {
        id: result.apartmentId,
        name: apartmentData.name,
        description: apartmentData.description,
        invite_code: inviteCode,
        created_by: userId,
        created_at: new Date(),
      },
      inviteCode: inviteCode
    };

  } catch (error) {
    console.error('Error creating apartment:', error);
    throw new functions.https.HttpsError('internal', 'Failed to create apartment');
  }
});

/**
 * Generate unique 6-character invite code
 * Ensures uniqueness by checking against existing codes
 */
async function generateUniqueInviteCode() {
  const maxAttempts = 50;
  let attempts = 0;

  while (attempts < maxAttempts) {
    // Generate code using timestamp + random for better uniqueness
    const timestamp = Date.now().toString(36).slice(-3);
    const random = Math.random().toString(36).slice(2, 5);
    const inviteCode = (timestamp + random).toUpperCase().slice(0, 6);
    
    // Ensure it's exactly 6 characters
    if (inviteCode.length < 6) {
      const padding = Math.random().toString(36).slice(2, 8 - inviteCode.length);
      const finalCode = (inviteCode + padding).toUpperCase().slice(0, 6);
      
      // Check if code already exists
      const existingDoc = await db.collection('apartmentInvites').doc(finalCode).get();
      if (!existingDoc.exists) {
        return finalCode;
      }
    } else {
      // Check if code already exists
      const existingDoc = await db.collection('apartmentInvites').doc(inviteCode).get();
      if (!existingDoc.exists) {
        return inviteCode;
      }
    }
    
    attempts++;
  }

  throw new Error('Unable to generate unique invite code after maximum attempts');
}

/**
 * Cloud Function to join apartment
 * Validates invite code and adds user as member
 */
exports.joinApartment = functions.https.onCall(async (data, context) => {
  // Verify user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { inviteCode } = data;
  const userId = context.auth.uid;

  if (!inviteCode || typeof inviteCode !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'Invite code is required');
  }

  try {
    // Look up the invite record
    const inviteDoc = await db.collection('apartmentInvites').doc(inviteCode.toUpperCase()).get();
    
    if (!inviteDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Invalid invite code');
    }

    const inviteData = inviteDoc.data();
    const apartmentId = inviteData.apartment_id;

    // Check if user is already a member
    const memberId = `${apartmentId}_${userId}`;
    const existingMember = await db.collection('apartmentMembers').doc(memberId).get();
    
    if (existingMember.exists) {
      throw new functions.https.HttpsError('already-exists', 'User is already a member of this apartment');
    }

    // Add user as member
    const memberData = {
      apartment_id: apartmentId,
      user_id: userId,
      role: 'member',
      joined_at: admin.firestore.FieldValue.serverTimestamp(),
    };

    await db.collection('apartmentMembers').doc(memberId).set(memberData);

    // Get apartment details
    const apartmentDoc = await db.collection('apartments').doc(apartmentId).get();
    const apartmentData = apartmentDoc.data();

    return {
      success: true,
      apartment: {
        id: apartmentId,
        name: apartmentData.name,
        description: apartmentData.description,
        invite_code: apartmentData.invite_code,
        created_by: apartmentData.created_by,
        created_at: apartmentData.created_at.toDate(),
      },
      memberId: memberId
    };

  } catch (error) {
    console.error('Error joining apartment:', error);
    
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    
    throw new functions.https.HttpsError('internal', 'Failed to join apartment');
  }
});
