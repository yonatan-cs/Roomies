/**
 * Debug script for apartment code issues
 * Run this script to check Firebase connection, authentication, and apartment codes
 */

const https = require('https');

// Firebase configuration
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCdVexzHD5StQIK_w3GSbdYHYoE7fBqDps",
  projectId: "roomies-hub",
  authDomain: "roomies-hub.firebaseapp.com"
};

const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents`;

// Test function to check if we can access Firestore
async function testFirestoreAccess(idToken = null) {
  console.log('🧪 Testing Firestore access...');
  
  const headers = {
    'Content-Type': 'application/json'
  };
  
  if (idToken) {
    headers['Authorization'] = `Bearer ${idToken}`;
    console.log('🔑 Using authentication token');
  } else {
    console.log('🔓 Testing without authentication');
  }
  
  try {
    const url = `${FIRESTORE_BASE_URL}/apartmentInvites`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers
    });
    
    console.log(`📊 Response status: ${response.status} (${response.statusText})`);
    
    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ Firestore access successful');
      if (data.documents) {
        console.log(`📄 Found ${data.documents.length} apartment invites`);
        data.documents.forEach(doc => {
          const docId = doc.name.split('/').pop();
          console.log(`  - Invite code: ${docId}`);
        });
      } else {
        console.log('📄 No apartment invites found');
      }
    } else {
      console.log('❌ Firestore access failed');
      console.log('Error details:', data);
    }
    
    return { success: response.ok, data };
  } catch (error) {
    console.error('❌ Network error:', error.message);
    return { success: false, error: error.message };
  }
}

// Test function to check specific invite code
async function testInviteCode(inviteCode, idToken = null) {
  console.log(`\n🔍 Testing invite code: "${inviteCode}"`);
  
  const headers = {
    'Content-Type': 'application/json'
  };
  
  if (idToken) {
    headers['Authorization'] = `Bearer ${idToken}`;
  }
  
  try {
    const url = `${FIRESTORE_BASE_URL}/apartmentInvites/${inviteCode}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers
    });
    
    console.log(`📊 Response status: ${response.status} (${response.statusText})`);
    
    const data = await response.json();
    
    if (response.status === 200) {
      console.log('✅ Invite code found!');
      console.log('📋 Invite details:', {
        apartment_id: data.fields?.apartment_id?.stringValue,
        apartment_name: data.fields?.apartment_name?.stringValue,
        invite_code: data.fields?.invite_code?.stringValue
      });
    } else if (response.status === 404) {
      console.log('❌ Invite code not found');
    } else {
      console.log('❌ Error accessing invite code');
      console.log('Error details:', data);
    }
    
    return { success: response.status === 200, data };
  } catch (error) {
    console.error('❌ Network error:', error.message);
    return { success: false, error: error.message };
  }
}

// Main debug function
async function debugApartmentCodes() {
  console.log('🐛 Starting apartment codes debug...\n');
  
  console.log('🔧 Firebase Configuration:');
  console.log(`  Project ID: ${FIREBASE_CONFIG.projectId}`);
  console.log(`  API Key: ${FIREBASE_CONFIG.apiKey.substring(0, 20)}...`);
  console.log(`  Firestore URL: ${FIRESTORE_BASE_URL}\n`);
  
  // Test 1: Access without authentication
  console.log('=== Test 1: Access without authentication ===');
  await testFirestoreAccess();
  
  console.log('\n=== Instructions for further testing ===');
  console.log('📝 To continue testing with authentication:');
  console.log('1. Copy an ID token from your app logs (look for "ID Token: Present (...)") ');
  console.log('2. Run: node debug-apartment-codes.js <YOUR_ID_TOKEN>');
  console.log('3. Or test a specific invite code: node debug-apartment-codes.js <ID_TOKEN> <INVITE_CODE>');
  
  // If arguments provided, use them
  const args = process.argv.slice(2);
  if (args.length >= 1) {
    const idToken = args[0];
    console.log('\n=== Test 2: Access with authentication ===');
    await testFirestoreAccess(idToken);
    
    if (args.length >= 2) {
      const inviteCode = args[1];
      await testInviteCode(inviteCode, idToken);
    }
  }
  
  console.log('\n🎯 Common issues and solutions:');
  console.log('1. "Missing or insufficient permissions" = Security rules not deployed or too restrictive');
  console.log('2. "Invite code not found" = Code doesn\'t exist or wrong format');
  console.log('3. "Network error" = Internet connection or Firebase project issues');
  console.log('4. "Authentication failed" = Invalid or expired ID token');
  
  console.log('\n📋 Next steps:');
  console.log('1. Deploy security rules: ./deploy-firestore-rules.sh');
  console.log('2. Check your app logs for detailed authentication info');
  console.log('3. Verify invite codes exist in Firebase Console');
}

// Global fetch polyfill for Node.js
if (typeof fetch === 'undefined') {
  global.fetch = async (url, options = {}) => {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const reqOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port || 443,
        path: urlObj.pathname + urlObj.search,
        method: options.method || 'GET',
        headers: options.headers || {}
      };
      
      const req = https.request(reqOptions, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            statusText: res.statusMessage,
            json: () => Promise.resolve(JSON.parse(data))
          });
        });
      });
      
      req.on('error', reject);
      
      if (options.body) {
        req.write(options.body);
      }
      
      req.end();
    });
  };
}

// Run the debug function
debugApartmentCodes().catch(console.error);
