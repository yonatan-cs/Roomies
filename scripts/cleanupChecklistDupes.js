/**
 * Cleanup script for duplicate checklist items
 * 
 * Usage: node scripts/cleanupChecklistDupes.js <apartmentId>
 * 
 * This script removes duplicate checklist items, keeping only the first one
 * for each template_key or title.
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
// You'll need to set up service account credentials
// For now, this is a template - you'll need to configure it properly
admin.initializeApp({
  // Add your service account configuration here
  // credential: admin.credential.applicationDefault(),
  // projectId: 'your-project-id'
});

const db = admin.firestore();

async function cleanupChecklistDuplicates(aptId) {
  console.log(`🧹 Starting cleanup for apartment: ${aptId}`);
  
  try {
    // Query all checklist items for this apartment
    const snap = await db.collectionGroup('checklistItems')
      .where('apartment_id', '==', aptId)
      .where('cleaning_task_id', '==', aptId)
      .get();

    console.log(`📊 Found ${snap.size} checklist items`);

    const byKey = new Map(); // template_key or title
    const batch = db.batch();
    let duplicatesFound = 0;

    snap.forEach(doc => {
      const data = doc.data();
      const key = data.template_key || `${(data.title || '').trim().toLowerCase()}`;
      
      if (!byKey.has(key)) {
        byKey.set(key, doc); // Keep the first one
        console.log(`✅ Keeping: ${data.title} (${doc.id})`);
      } else {
        batch.delete(doc.ref); // Delete duplicate
        duplicatesFound++;
        console.log(`🗑️ Deleting duplicate: ${data.title} (${doc.id})`);
      }
    });

    if (duplicatesFound > 0) {
      console.log(`🔄 Committing batch delete of ${duplicatesFound} duplicates...`);
      await batch.commit();
      console.log(`✅ Cleanup completed! Deleted ${duplicatesFound} duplicates`);
    } else {
      console.log(`✨ No duplicates found - cleanup not needed`);
    }

    console.log(`📋 Final count: ${byKey.size} unique items`);
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    throw error;
  }
}

// Get apartment ID from command line arguments
const aptId = process.argv[2];

if (!aptId) {
  console.error('❌ Please provide an apartment ID as an argument');
  console.error('Usage: node scripts/cleanupChecklistDupes.js <apartmentId>');
  process.exit(1);
}

// Run the cleanup
cleanupChecklistDuplicates(aptId)
  .then(() => {
    console.log('🎉 Cleanup completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Cleanup failed:', error);
    process.exit(1);
  });
