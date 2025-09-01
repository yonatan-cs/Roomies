/**
 * Cleanup script for duplicate checklist items using REST API
 * 
 * Usage: node scripts/cleanupChecklistDupes.js <apartmentId> <idToken>
 * 
 * This script removes duplicate checklist items, keeping only the first one
 * for each template_key or title.
 */

const FIRESTORE_BASE_URL = 'https://firestore.googleapis.com/v1/projects/roomies-hub/databases/(default)/documents';

async function cleanupChecklistDuplicates(aptId, idToken) {
  console.log(`🧹 Starting cleanup for apartment: ${aptId}`);
  
  try {
    // Query all checklist items for this apartment using collection-group
    const queryBody = {
      structuredQuery: {
        from: [{ collectionId: 'checklistItems', allDescendants: true }],
        where: {
          compositeFilter: {
            op: 'AND',
            filters: [
              { fieldFilter: { field: { fieldPath: 'apartment_id' }, op: 'EQUAL', value: { stringValue: aptId } } },
              { fieldFilter: { field: { fieldPath: 'cleaning_task_id' }, op: 'EQUAL', value: { stringValue: aptId } } },
            ],
          },
        },
        orderBy: [{ field: { fieldPath: 'created_at' }, direction: 'ASCENDING' }], // Keep oldest first
        limit: 500
      }
    };

    const response = await fetch(`${FIRESTORE_BASE_URL}:runQuery`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(queryBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Query failed: ${response.status} - ${errorText}`);
    }

    const rows = await response.json();
    console.log(`📊 Found ${rows.length} checklist items`);

    const byKey = new Map(); // template_key or title
    const toDelete = [];

    for (const row of rows) {
      const doc = row.document;
      if (!doc) continue;

      const fields = doc.fields || {};
      const title = fields.title?.stringValue || '';
      const templateKey = fields.template_key?.stringValue;
      
      // Use template_key if available, otherwise use normalized title
      const key = templateKey || title.trim().toLowerCase();
      
      if (!byKey.has(key)) {
        byKey.set(key, doc); // Keep the first one (oldest)
        console.log(`✅ Keeping: ${title} (${doc.name.split('/').pop()})`);
      } else {
        toDelete.push(doc.name);
        console.log(`🗑️ Marking for deletion: ${title} (${doc.name.split('/').pop()})`);
      }
    }

    if (toDelete.length > 0) {
      console.log(`🔄 Deleting ${toDelete.length} duplicates...`);
      
      // Delete each duplicate
      for (const docName of toDelete) {
        try {
          const deleteResponse = await fetch(`${FIRESTORE_BASE_URL}/${docName.replace('projects/roomies-hub/databases/(default)/documents/', '')}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${idToken}`,
            },
          });
          
          if (deleteResponse.ok) {
            console.log(`✅ Deleted: ${docName.split('/').pop()}`);
          } else {
            console.log(`❌ Failed to delete: ${docName.split('/').pop()} - ${deleteResponse.status}`);
          }
        } catch (deleteError) {
          console.error(`❌ Error deleting ${docName.split('/').pop()}:`, deleteError);
        }
      }
      
      console.log(`✅ Cleanup completed! Deleted ${toDelete.length} duplicates`);
    } else {
      console.log(`✨ No duplicates found - cleanup not needed`);
    }

    console.log(`📋 Final count: ${byKey.size} unique items`);
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    throw error;
  }
}

// Get arguments from command line
const aptId = process.argv[2];
const idToken = process.argv[3];

if (!aptId || !idToken) {
  console.error('❌ Please provide apartment ID and ID token as arguments');
  console.error('Usage: node scripts/cleanupChecklistDupes.js <apartmentId> <idToken>');
  console.error('');
  console.error('To get your ID token:');
  console.error('1. Open browser developer tools');
  console.error('2. Go to Application/Storage > Local Storage');
  console.error('3. Look for firebase auth token');
  console.error('');
  console.error('Or use the debug utility in the app console:');
  console.error('global.debugFirestore.testAuth()');
  process.exit(1);
}

// Run the cleanup
cleanupChecklistDuplicates(aptId, idToken)
  .then(() => {
    console.log('🎉 Cleanup completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Cleanup failed:', error);
    process.exit(1);
  });