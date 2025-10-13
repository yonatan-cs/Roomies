import React from 'react';
import MockAdItem from './MockAdItem';

/**
 * Shopping List Ad Component
 * Wrapper for MockAdItem with shopping list styling
 * 
 * ADMOB RESTORE: Replace MockAdItem import with RealNativeAdItem before App Store deployment
 */

export default function ShoppingListAd() {
  return <MockAdItem variant="shopping" />;
}

