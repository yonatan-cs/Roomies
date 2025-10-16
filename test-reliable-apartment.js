#!/usr/bin/env node3

/**
 * Test script to verify reliable apartment ID functionality
 * Run with: node3 test-reliable-apartment.js <USER_ID> <ID_TOKEN>
 */

const PROJECT_ID = 'roomies-hub';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

const headers = (idToken) => ({
  Authorization: `Bearer ${idToken}`,
  'Content-Type': 'application/json',
});

async function testReliableApartmentId(userId, idToken) {
  console.log('🧪 Testing reliable apartment ID functionality...');
  console.log('👤 User ID:', userId);
  console.log('🔑 Token preview:', idToken.substring(0, 50) + '...');
  
  try {
    // Step 1: Try from user profile
    console.log('\n1️⃣ Step 1: Checking user profile for current_apartment_id...');
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
      
      const apartmentId = userDoc.fields?.current_apartment_id?.stringValue;
      if (apartmentId) {
        console.log('✅ Found apartment ID in user profile:', apartmentId);
        
        // Test apartment members query with this ID
        await testApartmentMembersQuery(apartmentId, idToken);
        return;
      } else {
        console.log('📭 No current_apartment_id in user profile');
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
    
    // Step 2: Fallback - query user's memberships
    console.log('\n2️⃣ Step 2: Querying user memberships as fallback...');
    const queryBody = {
      structuredQuery: {
        from: [{ collectionId: 'apartmentMembers' }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'user_id' },
            op: 'EQUAL',
            value: { stringValue: userId }
          }
        },
        orderBy: [{ field: { fieldPath: 'joined_at' }, direction: 'DESCENDING' }],
        limit: 1
      }
    };
    
    const queryUrl = `${BASE}:runQuery`;
    console.log('📋 Query URL:', queryUrl);
    console.log('📝 Query body:', JSON.stringify(queryBody, null, 2));
    
    const queryResponse = await fetch(queryUrl, {
      method: 'POST',
      headers: headers(idToken),
      body: JSON.stringify(queryBody),
    });
    
    console.log(`📊 Membership query response: ${queryResponse.status} (${queryResponse.statusText})`);
    
    if (queryResponse.status === 200) {
      const rows = await queryResponse.json();
      console.log('📋 Raw membership query results:', JSON.stringify(rows, null, 2));
      
      const latestMembership = rows.find((row) => row.document)?.document;
      if (latestMembership) {
        const apartmentId = latestMembership.fields?.apartment_id?.stringValue;
        if (apartmentId) {
          console.log('✅ Found apartment ID from latest membership:', apartmentId);
          
          // Test apartment members query with this ID
          await testApartmentMembersQuery(apartmentId, idToken);
          return;
        }
      }
      
      console.log('📭 No apartment ID found in memberships');
    } else {
      console.log('❌ Failed to query memberships');
      
      try {
        const errorData = await queryResponse.json();
        console.log('📋 Error details:', JSON.stringify(errorData, null, 2));
      } catch (e) {
        console.log('❌ Could not parse error response');
      }
    }
    
    console.log('📭 No apartment ID found from any source');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

async function testApartmentMembersQuery(apartmentId, idToken) {
  console.log('\n3️⃣ Step 3: Testing apartment members query with found apartment ID...');
  
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
  
  if (args.length !== 2) {
    console.log('Usage: node3 test-reliable-apartment.js <USER_ID> <ID_TOKEN>');
    console.log('');
    console.log('Example:');
    console.log('  node3 test-reliable-apartment.js "PLh6PVuKlCQYFqd170jdJahgXLD2" "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."');
    process.exit(1);
  }
  
  const [userId, idToken] = args;
  
  testReliableApartmentId(userId, idToken)
    .then(() => {
      console.log('\n🏁 Test completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testReliableApartmentId };
