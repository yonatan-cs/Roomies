/**
 * Migration script for cleaning tasks
 * Updates existing checklist items to support the new schema with default task support
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    // Add your project ID here if needed
    // projectId: 'your-project-id'
  });
}

const db = admin.firestore();

// Default task mapping
const DEFAULT_TASK_MAPPING = {
  'cleaning.defaultTasks.kitchen': {
    template_key: 'cleaning.defaultTasks.kitchen',
    is_default: true,
    user_modified: false,
    created_from_default_version: 1
  },
  'cleaning.defaultTasks.floors': {
    template_key: 'cleaning.defaultTasks.floors',
    is_default: true,
    user_modified: false,
    created_from_default_version: 1
  },
  'cleaning.defaultTasks.bathroom': {
    template_key: 'cleaning.defaultTasks.bathroom',
    is_default: true,
    user_modified: false,
    created_from_default_version: 1
  },
  'cleaning.defaultTasks.garbage': {
    template_key: 'cleaning.defaultTasks.garbage',
    is_default: true,
    user_modified: false,
    created_from_default_version: 1
  },
  'cleaning.defaultTasks.dusting': {
    template_key: 'cleaning.defaultTasks.dusting',
    is_default: true,
    user_modified: false,
    created_from_default_version: 1
  }
};

async function migrateCleaningTasks() {
  console.log('🔄 Starting cleaning tasks migration...');
  
  try {
    // Get all apartments
    const apartmentsSnapshot = await db.collection('apartments').get();
    console.log(`📊 Found ${apartmentsSnapshot.size} apartments`);
    
    let totalUpdated = 0;
    let totalSkipped = 0;
    
    for (const apartmentDoc of apartmentsSnapshot.docs) {
      const apartmentId = apartmentDoc.id;
      console.log(`\n🏠 Processing apartment: ${apartmentId}`);
      
      try {
        // Get all checklist items for this apartment
        const checklistSnapshot = await db
          .collection('apartments')
          .doc(apartmentId)
          .collection('tasks')
          .get();
        
        console.log(`  📋 Found ${checklistSnapshot.size} checklist items`);
        
        for (const itemDoc of checklistSnapshot.docs) {
          const itemData = itemDoc.data();
          const itemId = itemDoc.id;
          
          // Check if this is a default task that needs migration
          if (itemData.title && itemData.title.startsWith('cleaning.defaultTasks.')) {
            const defaultTaskConfig = DEFAULT_TASK_MAPPING[itemData.title];
            
            if (defaultTaskConfig) {
              // Check if already migrated
              if (itemData.is_default !== undefined) {
                console.log(`    ⏭️  Item ${itemId} already migrated, skipping`);
                totalSkipped++;
                continue;
              }
              
              // Update the item with new fields
              await itemDoc.ref.update({
                template_key: defaultTaskConfig.template_key,
                is_default: defaultTaskConfig.is_default,
                user_modified: defaultTaskConfig.user_modified,
                created_from_default_version: defaultTaskConfig.created_from_default_version
              });
              
              console.log(`    ✅ Updated item ${itemId}: ${itemData.title}`);
              totalUpdated++;
            }
          } else {
            // This is a custom task - mark as not default
            if (itemData.is_default === undefined) {
              await itemDoc.ref.update({
                is_default: false,
                user_modified: false,
                created_from_default_version: null
              });
              
              console.log(`    ✅ Marked custom task ${itemId} as non-default`);
              totalUpdated++;
            }
          }
        }
        
      } catch (error) {
        console.error(`  ❌ Error processing apartment ${apartmentId}:`, error);
      }
    }
    
    console.log(`\n🎉 Migration completed!`);
    console.log(`   ✅ Updated: ${totalUpdated} items`);
    console.log(`   ⏭️  Skipped: ${totalSkipped} items`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration if this script is executed directly
if (require.main === module) {
  migrateCleaningTasks()
    .then(() => {
      console.log('✅ Migration script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Migration script failed:', error);
      process.exit(1);
    });
}

module.exports = { migrateCleaningTasks };
