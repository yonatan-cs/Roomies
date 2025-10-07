import { I18nManager, TextStyle, ViewStyle, ImageStyle } from 'react-native';

/**
 * RTL Utility Functions
 * Provides helpers for RTL-aware layouts without using I18nManager.forceRTL
 * 
 * NOTE: For dynamic RTL detection, use useIsRTL() hook instead of isRTL constant
 */

// Static RTL check (use useIsRTL() hook for dynamic detection)
export const isRTL = I18nManager.isRTL;

/**
 * Returns RTL-aware text style
 * Applies proper textAlign and writingDirection for mixed content
 */
export function rtlText(extraStyle?: TextStyle): TextStyle {
  return {
    textAlign: isRTL ? 'right' : 'left',
    writingDirection: isRTL ? 'rtl' : 'ltr',
    ...extraStyle,
  };
}

/**
 * Returns RTL-aware row layout
 * Flips flexDirection for RTL languages
 */
export function rtlRow(extraStyle?: ViewStyle): ViewStyle {
  return {
    flexDirection: isRTL ? 'row-reverse' : 'row',
    ...extraStyle,
  };
}

/**
 * Returns RTL-aware start position value
 * Use for positioning elements at the "start" of the layout
 */
export function absStart(value: number): ViewStyle {
  return isRTL ? { right: value } : { left: value };
}

/**
 * Returns RTL-aware end position value
 * Use for positioning elements at the "end" of the layout
 */
export function absEnd(value: number): ViewStyle {
  return isRTL ? { left: value } : { right: value };
}

/**
 * Flips transform for icons/images in RTL
 * Useful for directional icons like chevrons and arrows
 */
export function flipIcon(shouldFlip: boolean = true): ImageStyle {
  if (!shouldFlip || !isRTL) {
    return {};
  }
  return {
    transform: [{ scaleX: -1 }],
  };
}

/**
 * Returns margin start value
 */
export function marginStart(value: number): ViewStyle {
  return { marginStart: value };
}

/**
 * Returns margin end value
 */
export function marginEnd(value: number): ViewStyle {
  return { marginEnd: value };
}

/**
 * Returns padding start value
 */
export function paddingStart(value: number): ViewStyle {
  return { paddingStart: value };
}

/**
 * Returns padding end value
 */
export function paddingEnd(value: number): ViewStyle {
  return { paddingEnd: value };
}

/**
 * Helper for RTL-aware text input
 */
export function rtlTextInput(extraStyle?: TextStyle): TextStyle {
  return {
    textAlign: isRTL ? 'right' : 'left',
    writingDirection: isRTL ? 'rtl' : 'ltr',
    ...(extraStyle || {}),
  };
}

/**
 * Helper for centered text that works in RTL
 */
export function rtlTextCenter(extraStyle?: TextStyle): TextStyle {
  return {
    textAlign: 'center',
    writingDirection: isRTL ? 'rtl' : 'ltr',
    ...extraStyle,
  };
}
