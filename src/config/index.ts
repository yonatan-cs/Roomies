// Main configuration file that initializes all services
import { initializeAdMob } from './admob';
import { initializeFirebase } from './firebase';
import { ReanimatedConfig } from './reanimated';

// Initialize all services
export const initializeApp = async () => {
  try {
    console.log('Initializing app services...');
    
    // Initialize Reanimated and Gesture Handler first
    ReanimatedConfig.initialize();
    
    // Initialize Firebase/FCM
    const firebaseResult = await initializeFirebase();
    
    // Initialize AdMob
    await initializeAdMob();
    
    console.log('All services initialized successfully');
    
    return {
      firebase: firebaseResult,
      success: true,
    };
  } catch (error) {
    console.error('Failed to initialize app services:', error);
    return {
      success: false,
      error,
    };
  }
};

// Export all configurations
export * from './admob';
export * from './firebase';
export * from './reanimated';
