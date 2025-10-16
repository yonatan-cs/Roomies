#!/usr/bin/env node3

/**
 * Test script to verify apartment members functionality
 * Run with: node3 test-members.js <APARTMENT_ID> <ID_TOKEN>
 */

const PROJECT_ID = 'roomies-hub';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

const headers = (idToken) => ({
  Authorization: `Bearer ${idToken}`,
  'Content-Type': 'application/json',
});

async function testApartmentMembers(apartmentId, idToken) {
  console.log('🧪 Testing apartment members functionality...');
  console.log('🏠 Apartment ID:', apartmentId);
  console.log('🔑 Token preview:', idToken.substring(0, 50) + '...');
  
  try {
    // Step 1: Query apartment members
    console.log('\n1️⃣ Querying apartment members...');
    const queryUrl = `${BASE}:runQuery`;
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
    
    console.log('📋 Query URL:', queryUrl);
    console.log('📝 Query body:', JSON.stringify(queryBody, null, 2));
    
    const queryResponse = await fetch(queryUrl, {
      method: 'POST',
      headers: headers(idToken),
      body: JSON.stringify(queryBody),
    });
    
    console.log(`📊 Query response: ${queryResponse.status} (${queryResponse.statusText})`);
    
    if (queryResponse.status === 200) {
      const rows = await queryResponse.json();
      console.log('📋 Raw query results:', JSON.stringify(rows, null, 2));
      
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
      
      if (memberships.length === 0) {
        console.log('📭 No members found for this apartment');
        return;
      }
      
      // Step 2: Get user profiles
      console.log('\n2️⃣ Getting user profiles...');
      const uids = [...new Set(memberships.map(m => m.user_id).filter(Boolean))];
      console.log('👤 User IDs to fetch:', uids);
      
      const batchUrl = `${BASE}:batchGet`;
      const batchBody = {
        documents: uids.map(uid => `${BASE}/users/${uid}`)
      };
      
      console.log('📋 Batch get URL:', batchUrl);
      console.log('📝 Batch get body:', JSON.stringify(batchBody, null, 2));
      
      const batchResponse = await fetch(batchUrl, {
        method: 'POST',
        headers: headers(idToken),
        body: JSON.stringify(batchBody),
      });
      
      console.log(`📊 Batch get response: ${batchResponse.status} (${batchResponse.statusText})`);
      
      if (batchResponse.status === 200) {
        const items = await batchResponse.json();
        console.log('📋 Raw batch results:', JSON.stringify(items, null, 2));
        
        const userProfiles = {};
        for (const item of items) {
          const doc = item.found;
          if (!doc) continue;
          
          const fields = doc.fields || {};
          const id = doc.name.split('/').pop();
          
          userProfiles[id] = {
            id,
            email: fields.email?.stringValue,
            full_name: fields.full_name?.stringValue,
            displayName: fields.displayName?.stringValue,
            name: fields.name?.stringValue,
          };
        }
        
        console.log('✅ User profiles loaded:', userProfiles);
        
        // Step 3: Combine and display results
        console.log('\n3️⃣ Combined results:');
        const membersWithProfiles = memberships.map(membership => ({
          ...membership,
          profile: userProfiles[membership.user_id] || { 
            id: membership.user_id, 
            full_name: 'אורח',
            email: 'unknown@example.com'
          }
        }));
        
        console.log('🎉 Final members with profiles:');
        membersWithProfiles.forEach((member, index) => {
          console.log(`  ${index + 1}. ${member.profile.full_name || member.profile.name || 'אורח'} (${member.user_id})`);
          console.log(`     Role: ${member.role}`);
          console.log(`     Email: ${member.profile.email || 'לא מוגדר'}`);
          console.log(`     Joined: ${member.joined_at || 'לא ידוע'}`);
          console.log('');
        });
        
      } else {
        console.log('❌ Failed to get user profiles');
        
        try {
          const errorData = await batchResponse.json();
          console.log('📋 Error details:', JSON.stringify(errorData, null, 2));
        } catch (e) {
          console.log('❌ Could not parse error response');
        }
      }
      
    } else {
      console.log('❌ Failed to query apartment members');
      
      try {
        const errorData = await queryResponse.json();
        console.log('📋 Error details:', JSON.stringify(errorData, null, 2));
      } catch (e) {
        console.log('❌ Could not parse error response');
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length !== 2) {
    console.log('Usage: node3 test-members.js <APARTMENT_ID> <ID_TOKEN>');
    console.log('');
    console.log('Example:');
    console.log('  node3 test-members.js "wRrDvP7GpwMLNuCwlKkS" "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."');
    process.exit(1);
  }
  
  const [apartmentId, idToken] = args;
  
  testApartmentMembers(apartmentId, idToken)
    .then(() => {
      console.log('\n🏁 Test completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testApartmentMembers };
