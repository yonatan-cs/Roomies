import { Platform } from 'react-native';

// Reanimated/Gesture-Handler Configuration
export const ReanimatedConfig = {
  // Configure gesture handler
  configureGestureHandler: () => {
    if (Platform.OS === 'ios') {
      // iOS specific configuration
      console.log('Gesture Handler configured for iOS');
    } else {
      // Android specific configuration
      console.log('Gesture Handler configured for Android');
    }
  },

  // Configure reanimated
  configureReanimated: () => {
    // Reanimated configuration
    console.log('Reanimated configured');
  },

  // Initialize both
  initialize: () => {
    try {
      ReanimatedConfig.configureGestureHandler();
      ReanimatedConfig.configureReanimated();
      console.log('Reanimated and Gesture Handler initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Reanimated/Gesture Handler:', error);
    }
  },
};

// Common gesture configurations
export const GestureConfigs = {
  // Drag and drop configuration
  dragAndDrop: {
    activeScale: 1.05,
    activeOpacity: 0.8,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },

  // Modal configuration
  modal: {
    snapPoints: ['25%', '50%', '90%'],
    enablePanDownToClose: true,
    enableOverDrag: false,
    enableDismissOnClose: true,
  },

  // Swipe configuration
  swipe: {
    threshold: 50,
    velocity: 500,
    direction: 'horizontal',
  },
};

// Common animation configurations
export const AnimationConfigs = {
  // Spring animations
  spring: {
    damping: 15,
    stiffness: 150,
    mass: 1,
    overshootClamping: false,
    restDisplacementThreshold: 0.01,
    restSpeedThreshold: 0.01,
  },

  // Timing animations
  timing: {
    duration: 300,
    easing: 'easeInOut',
  },

  // Bounce animations
  bounce: {
    damping: 10,
    stiffness: 100,
    mass: 1,
  },
};
