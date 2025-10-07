import { useIsRTL } from '../hooks/useIsRTL';
import { useStore } from '../state/store';

/**
 * Hebrew-aware number formatting utilities
 * Uses Intl.NumberFormat to ensure proper RTL number display
 */

// Number formatter for ILS (Shekel)
const ilsNumberFormatter = new Intl.NumberFormat('he-IL', {
  style: 'currency',
  currency: 'ILS',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

// Number formatter for USD (Dollar)
const usdNumberFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

// Date formatter for Hebrew locale
const hebrewDateFormatter = new Intl.DateTimeFormat('he-IL', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

// Date formatter for English locale
const englishDateFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

/**
 * Format currency with proper RTL support
 * @param amount - The amount to format
 * @param currency - The currency to use ('ILS' | 'USD')
 * @returns Formatted currency string
 */
export function formatCurrency(amount: number, currency: 'ILS' | 'USD'): string {
  if (currency === 'ILS') {
    return ilsNumberFormatter.format(amount);
  } else {
    return usdNumberFormatter.format(amount);
  }
}

/**
 * Format date with proper RTL support
 * @param date - The date to format
 * @param isRTL - Whether current language is RTL
 * @returns Formatted date string
 */
export function formatDate(date: Date, isRTL: boolean): string {
  if (isRTL) {
    return hebrewDateFormatter.format(date);
  } else {
    return englishDateFormatter.format(date);
  }
}

/**
 * Format number with proper RTL support
 * @param number - The number to format
 * @param isRTL - Whether current language is RTL
 * @returns Formatted number string
 */
export function formatNumber(number: number, isRTL: boolean): string {
  const formatter = new Intl.NumberFormat(isRTL ? 'he-IL' : 'en-US');
  return formatter.format(number);
}

/**
 * Hook version of formatCurrency that automatically uses selected currency
 */
export function useFormatCurrency() {
  const currency = useStore(state => state.currency);
  return (amount: number) => formatCurrency(amount, currency);
}

/**
 * Hook version of formatDate that automatically detects RTL
 */
export function useFormatDate() {
  const isRTL = useIsRTL();
  return (date: Date) => formatDate(date, isRTL);
}

/**
 * Hook version of formatNumber that automatically detects RTL
 */
export function useFormatNumber() {
  const isRTL = useIsRTL();
  return (number: number) => formatNumber(number, isRTL);
}
