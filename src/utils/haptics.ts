import * as Haptics from 'expo-haptics';
import { AppState } from 'react-native';

// Rate limiting to prevent rapid repeated buzzes
let lastHapticTime = 0;
const HAPTIC_DEBOUNCE_MS = 120;

/**
 * Check if haptics should be triggered
 * - Respects user settings (checked via store)
 * - Rate limits calls to prevent spam
 * - No-op if app is in background
 */
function shouldTriggerHaptic(): boolean {
  const now = Date.now();
  
  // Rate limiting
  if (now - lastHapticTime < HAPTIC_DEBOUNCE_MS) {
    if (__DEV__) {
      console.log('🔇 Haptic blocked: rate limited');
    }
    return false;
  }
  
  // Don't trigger if app is in background
  if (AppState.currentState !== 'active') {
    if (__DEV__) {
      console.log('🔇 Haptic blocked: app not active');
    }
    return false;
  }
  
  lastHapticTime = now;
  return true;
}

/**
 * Get haptics enabled setting from store
 * This is imported dynamically to avoid circular dependencies
 */
function getHapticsEnabled(): boolean {
  try {
    // Dynamic import to avoid circular dependency with store
    const { useStore } = require('../state/store');
    const state = useStore.getState();
    return state.hapticsEnabled ?? true; // Default to enabled
  } catch (error) {
    if (__DEV__) {
      console.warn('Could not get haptics setting, defaulting to enabled:', error);
    }
    return true;
  }
}

/**
 * Light impact haptic - for subtle feedback
 * Use for: light touches, minor confirmations
 */
export function impactLight(): void {
  if (!shouldTriggerHaptic() || !getHapticsEnabled()) return;
  
  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (__DEV__) {
      console.log('🔊 Haptic: light impact');
    }
  } catch (error) {
    if (__DEV__) {
      console.warn('Haptic light impact failed:', error);
    }
  }
}

/**
 * Medium impact haptic - for standard confirmations
 * Use for: primary buttons, confirm actions, successful operations
 */
export function impactMedium(): void {
  if (!shouldTriggerHaptic() || !getHapticsEnabled()) return;
  
  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (__DEV__) {
      console.log('🔊 Haptic: medium impact');
    }
  } catch (error) {
    if (__DEV__) {
      console.warn('Haptic medium impact failed:', error);
    }
  }
}

/**
 * Heavy impact haptic - for strong feedback
 * Use for: destructive actions, important confirmations
 */
export function impactHeavy(): void {
  if (!shouldTriggerHaptic() || !getHapticsEnabled()) return;
  
  try {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    if (__DEV__) {
      console.log('🔊 Haptic: heavy impact');
    }
  } catch (error) {
    if (__DEV__) {
      console.warn('Haptic heavy impact failed:', error);
    }
  }
}

/**
 * Success notification haptic
 * Use for: successful operations, completed tasks
 */
export function success(): void {
  if (!shouldTriggerHaptic() || !getHapticsEnabled()) return;
  
  try {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (__DEV__) {
      console.log('🔊 Haptic: success');
    }
  } catch (error) {
    if (__DEV__) {
      console.warn('Haptic success failed:', error);
    }
  }
}

/**
 * Warning notification haptic
 * Use for: warnings, destructive action confirmations
 */
export function warning(): void {
  if (!shouldTriggerHaptic() || !getHapticsEnabled()) return;
  
  try {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    if (__DEV__) {
      console.log('🔊 Haptic: warning');
    }
  } catch (error) {
    if (__DEV__) {
      console.warn('Haptic warning failed:', error);
    }
  }
}

/**
 * Error notification haptic
 * Use for: errors, failed operations
 */
export function error(): void {
  if (!shouldTriggerHaptic() || !getHapticsEnabled()) return;
  
  try {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    if (__DEV__) {
      console.log('🔊 Haptic: error');
    }
  } catch (error) {
    if (__DEV__) {
      console.warn('Haptic error failed:', error);
    }
  }
}

/**
 * Selection haptic - for UI element selection
 * Use for: picker changes, toggle switches
 */
export function selection(): void {
  if (!shouldTriggerHaptic() || !getHapticsEnabled()) return;
  
  try {
    Haptics.selectionAsync();
    if (__DEV__) {
      console.log('🔊 Haptic: selection');
    }
  } catch (error) {
    if (__DEV__) {
      console.warn('Haptic selection failed:', error);
    }
  }
}