#!/usr/bin/env node3

/**
 * Test script to verify session and batchGet fixes
 * Run with: node3 test-session-fix.js <USER_ID> <ID_TOKEN> [APARTMENT_ID]
 */

const PROJECT_ID = 'roomies-hub';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

const authHeaders = (idToken) => ({
  Authorization: `Bearer ${idToken}`,
  'Content-Type': 'application/json',
});

async function testSessionAndBatchGet(userId, idToken, apartmentId = null) {
  console.log('🧪 Testing session and batchGet fixes...');
  console.log('👤 User ID:', userId);
  console.log('🔑 Token preview:', idToken.substring(0, 50) + '...');
  console.log('🏠 Apartment ID:', apartmentId || 'null');
  
  try {
    // Step 1: Test user profile read
    console.log('\n1️⃣ Step 1: Testing user profile read...');
    const userUrl = `${BASE}/users/${userId}`;
    
    const userResponse = await fetch(userUrl, {
      method: 'GET',
      headers: authHeaders(idToken),
    });
    
    console.log(`📊 User response: ${userResponse.status} (${userResponse.statusText})`);
    
    if (userResponse.status === 200) {
      const userDoc = await userResponse.json();
      console.log('📋 User document:', JSON.stringify(userDoc, null, 2));
      
      const currentApartmentId = userDoc.fields?.current_apartment_id?.stringValue || null;
      console.log('📋 Current apartment ID in profile:', currentApartmentId);
      
      // Use the apartment ID from profile or the provided one
      const testApartmentId = currentApartmentId || apartmentId;
      
      if (testApartmentId) {
        console.log('✅ Using apartment ID for testing:', testApartmentId);
        
        // Step 2: Test apartment members query
        await testApartmentMembersQuery(testApartmentId, idToken);
        
        // Step 3: Test batch get users
        await testBatchGetUsers([userId], idToken);
        
      } else {
        console.log('📭 No apartment ID available for testing');
      }
      
    } else {
      console.log('❌ Failed to get user profile');
      
      try {
        const errorData = await userResponse.json();
        console.log('📋 Error details:', JSON.stringify(errorData, null, 2));
      } catch (e) {
        console.log('❌ Could not parse error response');
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

async function testApartmentMembersQuery(apartmentId, idToken) {
  console.log('\n2️⃣ Step 2: Testing apartment members query...');
  
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
    headers: authHeaders(idToken),
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
    
    // Return user IDs for batch get test
    return memberships.map(m => m.user_id).filter(Boolean);
    
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
  
  return [];
}

async function testBatchGetUsers(uids, idToken) {
  console.log('\n3️⃣ Step 3: Testing batch get users...');
  
  const uniq = Array.from(new Set((uids || []).filter(Boolean)));
  if (uniq.length === 0) {
    console.log('📭 No UIDs provided for batch get');
    return;
  }
  
  console.log('👤 Getting user profiles for UIDs:', uniq);
  
  // Must use resource names, not full URLs:
  const documents = uniq.map(
    (uid) => `projects/${PROJECT_ID}/databases/(default)/documents/users/${uid}`
  );
  
  const url = `${BASE}:batchGet`;
  const body = { documents };
  
  console.log('📋 Batch get URL:', url);
  console.log('📝 Batch get body:', JSON.stringify(body, null, 2));
  
  const response = await fetch(url, {
    method: 'POST',
    headers: authHeaders(idToken),
    body: JSON.stringify(body),
  });
  
  console.log(`📊 Batch get response: ${response.status} (${response.statusText})`);
  
  if (response.status === 200) {
    const items = await response.json();
    console.log('📋 Raw batch get results:', JSON.stringify(items, null, 2));
    
    const userMap = {};
    
    for (const item of items) {
      const doc = item.found;
      if (!doc) continue;
      
      const name = doc.name; // "projects/.../documents/users/<UID>"
      const uid = name.split('/').pop()!;
      const fields = doc.fields || {};
      
      userMap[uid] = {
        id: uid,
        email: fields.email?.stringValue,
        full_name: fields.full_name?.stringValue,
        displayName: fields.displayName?.stringValue,
        name: fields.name?.stringValue,
      };
    }
    
    console.log('✅ User profiles loaded:', userMap);
    console.log(`🎉 Success! Loaded ${Object.keys(userMap).length} user profiles`);
    
  } else if (response.status === 400) {
    console.log('❌ BAD_REQUEST - This was the original issue with resource names');
    
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
    console.log('Usage: node3 test-session-fix.js <USER_ID> <ID_TOKEN> [APARTMENT_ID]');
    console.log('');
    console.log('Example:');
    console.log('  node3 test-session-fix.js "PLh6PVuKlCQYFqd170jdJahgXLD2" "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..." "apartment123"');
    process.exit(1);
  }
  
  const [userId, idToken, apartmentId] = args;
  
  testSessionAndBatchGet(userId, idToken, apartmentId)
    .then(async () => {
      console.log('\n🏁 Test completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testSessionAndBatchGet };
