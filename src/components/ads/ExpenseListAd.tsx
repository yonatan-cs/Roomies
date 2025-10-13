import React from 'react';
import MockAdItem from './MockAdItem';

/**
 * Expense List Ad Component
 * Wrapper for MockAdItem with expense list styling
 * 
 * ADMOB RESTORE: Replace MockAdItem import with RealNativeAdItem before App Store deployment
 */

export default function ExpenseListAd() {
  return <MockAdItem variant="expense" />;
}

