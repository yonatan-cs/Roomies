export const APP_VERSION = '1.0.0';
export const APP_NAME = 'רומיז';

export const EXPENSE_CATEGORIES = {
  groceries: 'מכולת',
  utilities: 'שירותים', 
  rent: 'שכירות',
  cleaning: 'ניקיון',
  internet: 'אינטרנט',
  other: 'אחר'
} as const;

export const DEFAULT_CLEANING_TASKS = [
  'ניקוי מטבח',
  'שטיפת רצפות', 
  'ניקוי שירותים',
  'פינוי אשפה',
  'אבק רהיטים'
] as const;

export const CLEANING_INTERVAL_DAYS = 7;