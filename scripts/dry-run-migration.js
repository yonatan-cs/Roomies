/**
 * Dry-run script for cleaning tasks migration
 * Shows what would be updated without actually making changes
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
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

async function dryRunMigration() {
  console.log('🔍 Starting dry-run for cleaning tasks migration...');
  console.log('⚠️  This is a DRY RUN - no changes will be made\n');
  
  try {
    // Get all apartments
    const apartmentsSnapshot = await db.collection('apartments').get();
    console.log(`📊 Found ${apartmentsSnapshot.size} apartments\n`);
    
    let totalToUpdate = 0;
    let totalToSkip = 0;
    let defaultTasksFound = 0;
    let customTasksFound = 0;
    
    for (const apartmentDoc of apartmentsSnapshot.docs) {
      const apartmentId = apartmentDoc.id;
      const apartmentData = apartmentDoc.data();
      console.log(`🏠 Apartment: ${apartmentData.name || apartmentId}`);
      
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
            defaultTasksFound++;
            const defaultTaskConfig = DEFAULT_TASK_MAPPING[itemData.title];
            
            if (defaultTaskConfig) {
              // Check if already migrated
              if (itemData.is_default !== undefined) {
                console.log(`    ⏭️  Item ${itemId}: ${itemData.title} (already migrated)`);
                totalToSkip++;
              } else {
                console.log(`    🔄 Item ${itemId}: ${itemData.title} (would be updated)`);
                console.log(`       - template_key: ${defaultTaskConfig.template_key}`);
                console.log(`       - is_default: ${defaultTaskConfig.is_default}`);
                console.log(`       - user_modified: ${defaultTaskConfig.user_modified}`);
                console.log(`       - created_from_default_version: ${defaultTaskConfig.created_from_default_version}`);
                totalToUpdate++;
              }
            } else {
              console.log(`    ⚠️  Item ${itemId}: ${itemData.title} (unknown default task)`);
            }
          } else {
            customTasksFound++;
            if (itemData.is_default === undefined) {
              console.log(`    🔄 Custom task ${itemId}: "${itemData.title}" (would be marked as non-default)`);
              totalToUpdate++;
            } else {
              console.log(`    ⏭️  Custom task ${itemId}: "${itemData.title}" (already processed)`);
              totalToSkip++;
            }
          }
        }
        
      } catch (error) {
        console.error(`  ❌ Error processing apartment ${apartmentId}:`, error);
      }
      
      console.log(''); // Empty line for readability
    }
    
    console.log('📊 DRY RUN SUMMARY:');
    console.log(`   🏠 Apartments: ${apartmentsSnapshot.size}`);
    console.log(`   🔄 Items to update: ${totalToUpdate}`);
    console.log(`   ⏭️  Items to skip: ${totalToSkip}`);
    console.log(`   📋 Default tasks found: ${defaultTasksFound}`);
    console.log(`   📝 Custom tasks found: ${customTasksFound}`);
    
    if (totalToUpdate > 0) {
      console.log('\n✅ Ready to run migration! Use: node scripts/migrate-cleaning-tasks.js');
    } else {
      console.log('\n✅ No items need migration');
    }
    
  } catch (error) {
    console.error('❌ Dry-run failed:', error);
    process.exit(1);
  }
}

// Run dry-run if this script is executed directly
if (require.main === module) {
  dryRunMigration()
    .then(() => {
      console.log('\n✅ Dry-run completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Dry-run failed:', error);
      process.exit(1);
    });
}

module.exports = { dryRunMigration };
