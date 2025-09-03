/**
 * Script to update existing shopping items with default priority values
 * Run this script after deploying the new Firestore indexes
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, updateDoc, doc } = require('firebase/firestore');

// Firebase configuration - replace with your actual config
const firebaseConfig = {
  projectId: 'roomies-hub',
  // Add other config values as needed
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function updateShoppingItems() {
  try {
    console.log('🔄 Starting shopping items update...');
    
    // Get all shopping items
    const shoppingItemsRef = collection(db, 'shoppingItems');
    const snapshot = await getDocs(shoppingItemsRef);
    
    console.log(`📦 Found ${snapshot.size} shopping items to update`);
    
    let updatedCount = 0;
    let errorCount = 0;
    
    // Update each item
    for (const docSnapshot of snapshot.docs) {
      try {
        const itemData = docSnapshot.data();
        
        // Check if item already has priority field
        if (itemData.priority) {
          console.log(`✅ Item ${docSnapshot.id} already has priority: ${itemData.priority}`);
          continue;
        }
        
        // Update item with default values
        const updates = {
          priority: 'normal', // Default priority
          quantity: itemData.quantity || 1, // Default quantity
          notes: itemData.notes || '', // Default notes
          last_updated: new Date().toISOString()
        };
        
        await updateDoc(doc(db, 'shoppingItems', docSnapshot.id), updates);
        console.log(`✅ Updated item ${docSnapshot.id} with default values`);
        updatedCount++;
        
      } catch (error) {
        console.error(`❌ Error updating item ${docSnapshot.id}:`, error);
        errorCount++;
      }
    }
    
    console.log('\n🎉 Update completed!');
    console.log(`✅ Successfully updated: ${updatedCount} items`);
    console.log(`❌ Errors: ${errorCount} items`);
    console.log(`📊 Total processed: ${snapshot.size} items`);
    
  } catch (error) {
    console.error('❌ Script failed:', error);
  }
}

// Run the script
updateShoppingItems();
