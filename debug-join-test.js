#!/usr/bin/env node3

/**
 * Debug script to test apartment join functionality
 * Run with: node3 debug-join-test.js <INVITE_CODE> <USER_ID_TOKEN>
 */

const PROJECT_ID = 'roomies-hub';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

const headers = (idToken) => ({
  Authorization: `Bearer ${idToken}`,
  'Content-Type': 'application/json',
});

async function testJoinProcess(inviteCode, idToken) {
  console.log('🧪 Testing apartment join process...');
  console.log('📋 Invite code:', inviteCode);
  console.log('🔑 Token preview:', idToken.substring(0, 50) + '...');
  
  try {
    // Step 1: Test invite document access
    console.log('\n1️⃣ Testing invite document access...');
    const inviteCodeUpper = String(inviteCode).trim().toUpperCase();
    const inviteUrl = `${BASE}/apartmentInvites/${encodeURIComponent(inviteCodeUpper)}`;
    
    console.log('📋 URL:', inviteUrl);
    
    const inviteResponse = await fetch(inviteUrl, {
      method: 'GET',
      headers: headers(idToken),
    });
    
    console.log(`📊 Response: ${inviteResponse.status} (${inviteResponse.statusText})`);
    
    if (inviteResponse.status === 200) {
      const inviteDoc = await inviteResponse.json();
      const fields = inviteDoc.fields || {};
      const apartmentId = fields.apartment_id?.stringValue;
      const apartmentName = fields.apartment_name?.stringValue;
      
      console.log('✅ Invite found:', {
        apartmentId,
        apartmentName,
        inviteCode: fields.invite_code?.stringValue
      });
      
      // Step 2: Extract user ID from token (simplified)
      console.log('\n2️⃣ Extracting user ID from token...');
      
      // For testing, we'll use a placeholder user ID
      // In real app, this comes from firebaseAuth.getCurrentUser().localId
      const testUserId = 'test_user_id_for_debugging';
      console.log('👤 Test user ID:', testUserId);
      
      // Step 3: Test membership creation
      console.log('\n3️⃣ Testing membership creation...');
      const membershipId = `${apartmentId}_${testUserId}`;
      const membershipUrl = `${BASE}/apartmentMembers?documentId=${encodeURIComponent(membershipId)}`;
      
      const membershipBody = {
        fields: {
          apartment_id: { stringValue: apartmentId },
          user_id: { stringValue: testUserId },
          role: { stringValue: 'member' },
          created_at: { timestampValue: new Date().toISOString() }
        },
      };
      
      console.log('📋 Membership URL:', membershipUrl);
      console.log('🆔 Membership ID:', membershipId);
      console.log('📝 Body:', JSON.stringify(membershipBody, null, 2));
      
      const membershipResponse = await fetch(membershipUrl, {
        method: 'POST',
        headers: headers(idToken),
        body: JSON.stringify(membershipBody),
      });
      
      console.log(`📊 Membership response: ${membershipResponse.status} (${membershipResponse.statusText})`);
      
      if (membershipResponse.status === 200) {
        console.log('✅ Membership created successfully');
      } else if (membershipResponse.status === 409) {
        console.log('✅ Membership already exists (idempotent)');
      } else {
        console.log('❌ Membership creation failed');
        
        // Get error details
        try {
          const errorData = await membershipResponse.json();
          console.log('📋 Error details:', JSON.stringify(errorData, null, 2));
        } catch (e) {
          console.log('❌ Could not parse error response');
        }
      }
      
      // Step 4: Test setting current apartment
      console.log('\n4️⃣ Testing current apartment update...');
      const userUrl = `${BASE}/users/${testUserId}?updateMask.fieldPaths=current_apartment_id`;
      const userBody = {
        fields: {
          current_apartment_id: { stringValue: apartmentId }
        }
      };
      
      console.log('📋 User URL:', userUrl);
      console.log('📝 Body:', JSON.stringify(userBody, null, 2));
      
      const userResponse = await fetch(userUrl, {
        method: 'PATCH',
        headers: headers(idToken),
        body: JSON.stringify(userBody),
      });
      
      console.log(`📊 User update response: ${userResponse.status} (${userResponse.statusText})`);
      
      if (userResponse.status === 200) {
        console.log('✅ Current apartment set successfully');
      } else {
        console.log('❌ User update failed');
        
        // Get error details
        try {
          const errorData = await userResponse.json();
          console.log('📋 Error details:', JSON.stringify(errorData, null, 2));
        } catch (e) {
          console.log('❌ Could not parse error response');
        }
      }
      
    } else if (inviteResponse.status === 404) {
      console.log('❌ Invite code not found');
    } else if (inviteResponse.status === 403) {
      console.log('❌ Permission denied for invite read');
      
      // Get error details
      try {
        const errorData = await inviteResponse.json();
        console.log('📋 Error details:', JSON.stringify(errorData, null, 2));
      } catch (e) {
        console.log('❌ Could not parse error response');
      }
    } else {
      console.log(`❌ Unexpected response: ${inviteResponse.status}`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length !== 2) {
    console.log('Usage: node3 debug-join-test.js <INVITE_CODE> <ID_TOKEN>');
    console.log('');
    console.log('Example:');
    console.log('  node3 debug-join-test.js PWU0VU "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."');
    process.exit(1);
  }
  
  const [inviteCode, idToken] = args;
  
  testJoinProcess(inviteCode, idToken)
    .then(() => {
      console.log('\n🏁 Test completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Test failed:', error);
      process.exit(1);
    });
}

module.exports = { testJoinProcess };
