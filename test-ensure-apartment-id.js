#!/usr/bin/env node3

/**
 * Test script to verify ensureCurrentApartmentId functionality
 * Run with: node3 test-ensure-apartment-id.js <USER_ID> <ID_TOKEN> [APARTMENT_ID]
 */

const PROJECT_ID = 'roomies-hub';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

const headers = (idToken) => ({
  Authorization: `Bearer ${idToken}`,
  'Content-Type': 'application/json',
});

async function testEnsureCurrentApartmentId(userId, idToken, fallbackApartmentId = null) {
  console.log('🧪 Testing ensureCurrentApartmentId functionality...');
  console.log('👤 User ID:', userId);
  console.log('🔑 Token preview:', idToken.substring(0, 50) + '...');
  console.log('🏠 Fallback apartment ID:', fallbackApartmentId || 'null');
  
  try {
    // Step 1: Read user profile
    console.log('\n1️⃣ Step 1: Reading user profile...');
    const userUrl = `${BASE}/users/${userId}`;
    
    console.log('📋 User URL:', userUrl);
    
    const userResponse = await fetch(userUrl, {
      method: 'GET',
      headers: headers(idToken),
    });
    
    console.log(`📊 User response: ${userResponse.status} (${userResponse.statusText})`);
    
    if (userResponse.status === 200) {
      const userDoc = await userResponse.json();
      console.log('📋 User document:', JSON.stringify(userDoc, null, 2));
      
      const currentApartmentId = userDoc.fields?.current_apartment_id?.stringValue || null;
      console.log('📋 Current apartment ID in profile:', currentApartmentId);
      
      // If current_apartment_id exists and matches fallback - perfect
      if (currentApartmentId && currentApartmentId === fallbackApartmentId) {
        console.log('✅ current_apartment_id is already set correctly');
        return currentApartmentId;
      }
      
      // If missing or different, and we have a fallback - update it
      if (fallbackApartmentId) {
        console.log('🔄 Updating current_apartment_id to:', fallbackApartmentId);
        
        const updateResponse = await fetch(
          `${BASE}/users/${userId}?updateMask.fieldPaths=current_apartment_id`,
          {
            method: 'PATCH',
            headers: headers(idToken),
            body: JSON.stringify({
              fields: {
                current_apartment_id: { stringValue: fallbackApartmentId }
              }
            })
          }
        );
        
        console.log(`📊 Update response: ${updateResponse.status} (${updateResponse.statusText})`);
        
        if (updateResponse.status === 200) {
          console.log('✅ Successfully updated current_apartment_id');
          return fallbackApartmentId;
        } else {
          console.log('❌ Failed to update current_apartment_id');
          try {
            const errorData = await updateResponse.json();
            console.log('📋 Error details:', JSON.stringify(errorData, null, 2));
          } catch (e) {
            console.log('❌ Could not parse error response');
          }
        }
      }
      
      // Return current value if exists, otherwise null
      return currentApartmentId;
    }
    
    // If user document doesn't exist and we have fallback - create user and set apartment
    if (userResponse.status === 404 && fallbackApartmentId) {
      console.log('📭 User document not found, creating with apartment ID...');
      
      // Create user document first
      const createResponse = await fetch(`${BASE}/users?documentId=${userId}`, {
        method: 'POST',
        headers: headers(idToken),
        body: JSON.stringify({
          fields: {
            email: { stringValue: '' },
            full_name: { stringValue: '' },
            phone: { stringValue: '' }
          }
        })
      });
      
      console.log(`📊 Create user response: ${createResponse.status} (${createResponse.statusText})`);
      
      if (createResponse.status === 200) {
        // Now update with apartment ID
        const updateResponse = await fetch(
          `${BASE}/users/${userId}?updateMask.fieldPaths=current_apartment_id`,
          {
            method: 'PATCH',
            headers: headers(idToken),
            body: JSON.stringify({
              fields: {
                current_apartment_id: { stringValue: fallbackApartmentId }
              }
            })
          }
        );
        
        console.log(`📊 Update apartment response: ${updateResponse.status} (${updateResponse.statusText})`);
        
        if (updateResponse.status === 200) {
          console.log('✅ Successfully created user and set apartment ID');
          return fallbackApartmentId;
        }
      }
    }
    
    console.log('📭 Could not ensure current_apartment_id');
    return null;
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return null;
  }
}

async function testApartmentMembersQuery(apartmentId, idToken) {
  console.log('\n2️⃣ Step 2: Testing apartment members query with ensured apartment ID...');
  
  const queryBody = {
    structuredQuery: {
      from: [{ collectionId: 'apartmentMembers' }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'apartment_id' },
          op: 'EQUAL',
          value: { stringValue: apartmentId }
        }
      }
    }
  };
  
  const queryUrl = `${BASE}:runQuery`;
  console.log('📋 Members query URL:', queryUrl);
  console.log('📝 Members query body:', JSON.stringify(queryBody, null, 2));
  
  const response = await fetch(queryUrl, {
    method: 'POST',
    headers: headers(idToken),
    body: JSON.stringify(queryBody),
  });
  
  console.log(`📊 Members query response: ${response.status} (${response.statusText})`);
  
  if (response.status === 200) {
    const rows = await response.json();
    console.log('📋 Raw members query results:', JSON.stringify(rows, null, 2));
    
    const memberships = rows
      .map((row) => row.document)
      .filter(Boolean)
      .map((doc) => {
        const fields = doc.fields || {};
        return {
          id: doc.name.split('/').pop(),
          apartment_id: fields.apartment_id?.stringValue,
          user_id: fields.user_id?.stringValue,
          role: fields.role?.stringValue,
          joined_at: fields.joined_at?.timestampValue || fields.created_at?.timestampValue,
        };
      });
    
    console.log('✅ Found memberships:', memberships);
    console.log(`🎉 Success! Found ${memberships.length} members for apartment ${apartmentId}`);
    
  } else if (response.status === 403) {
    console.log('❌ PERMISSION_DENIED - This means the apartment ID is wrong or user is not a member');
    
    try {
      const errorData = await response.json();
      console.log('📋 Error details:', JSON.stringify(errorData, null, 2));
    } catch (e) {
      console.log('❌ Could not parse error response');
    }
    
  } else {
    console.log('❌ Unexpected response');
    
    try {
      const errorData = await response.json();
      console.log('📋 Error details:', JSON.stringify(errorData, null, 2));
    } catch (e) {
      console.log('❌ Could not parse error response');
    }
  }
}

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 2 || args.length > 3) {
    console.log('Usage: node3 test-ensure-apartment-id.js <USER_ID> <ID_TOKEN> [APARTMENT_ID]');
    console.log('');
    console.log('Example:');
    console.log('  node3 test-ensure-apartment-id.js "PLh6PVuKlCQYFqd170jdJahgXLD2" "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..." "apartment123"');
    process.exit(1);
  }
  
  const [userId, idToken, apartmentId] = args;
  
  testEnsureCurrentApartmentId(userId, idToken, apartmentId)
    .then(async (ensuredApartmentId) => {
      if (ensuredApartmentId) {
        console.log('\n✅ Successfully ensured apartment ID:', ensuredApartmentId);
        
        // Test the apartment members query with the ensured apartment ID
        await testApartmentMembersQuery(ensuredApartmentId, idToken);
      } else {
        console.log('\n❌ Failed to ensure apartment ID');
      }
      
      console.log('\n🏁 Test completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testEnsureCurrentApartmentId };
