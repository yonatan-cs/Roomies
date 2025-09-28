export const APP_VERSION = '1.0.0';
export const APP_NAME = 'רומיז';

// Category keys - use with translation system
export const EXPENSE_CATEGORIES = {
  groceries: 'expenses.categories.groceries',
  utilities: 'expenses.categories.utilities', 
  rent: 'expenses.categories.rent',
  cleaning: 'expenses.categories.cleaning',
  internet: 'expenses.categories.internet',
  other: 'expenses.categories.other'
} as const;

// Cleaning task keys - use with translation system
export const DEFAULT_CLEANING_TASKS = [
  'cleaning.defaultTasks.kitchen',
  'cleaning.defaultTasks.floors', 
  'cleaning.defaultTasks.bathroom',
  'cleaning.defaultTasks.garbage',
  'cleaning.defaultTasks.dusting'
] as const;

export const CLEANING_INTERVAL_DAYS = 7;