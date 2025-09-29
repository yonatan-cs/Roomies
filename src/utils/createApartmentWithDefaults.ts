import { ChecklistItem } from '../types';
import { DEFAULT_CLEANING_TASKS } from './constants';

/**
 * Creates default cleaning tasks for a new apartment
 * This function should be called when creating a new apartment
 */
export function createDefaultCleaningTasks(apartmentId: string, language: string = 'he'): Omit<ChecklistItem, 'id'>[] {
  const defaultTasks: Omit<ChecklistItem, 'id'>[] = [];
  
  DEFAULT_CLEANING_TASKS.forEach((taskKey, index) => {
    defaultTasks.push({
      title: taskKey, // Store the translation key
      completed: false,
      order: index,
      created_at: new Date().toISOString(),
      // New fields for default tasks support
      template_key: taskKey,
      is_default: true,
      user_modified: false,
      created_from_default_version: 1
    });
  });
  
  return defaultTasks;
}

/**
 * Gets the display title for a default task based on current language
 */
export function getDefaultTaskDisplayTitle(taskKey: string, language: string): string {
  // This would use i18n in the actual implementation
  // For now, return a simple mapping
  const translations: Record<string, Record<string, string>> = {
    'cleaning.defaultTasks.kitchen': {
      he: 'ניקוי מטבח',
      en: 'Kitchen cleaning'
    },
    'cleaning.defaultTasks.floors': {
      he: 'שטיפת רצפות',
      en: 'Floor mopping'
    },
    'cleaning.defaultTasks.bathroom': {
      he: 'ניקוי שירותים',
      en: 'Bathroom cleaning'
    },
    'cleaning.defaultTasks.garbage': {
      he: 'פינוי אשפה',
      en: 'Garbage disposal'
    },
    'cleaning.defaultTasks.dusting': {
      he: 'אבק רהיטים',
      en: 'Furniture dusting'
    }
  };
  
  return translations[taskKey]?.[language] || taskKey;
}

/**
 * Checks if a task is a default task that can be updated from templates
 */
export function canUpdateFromTemplate(task: ChecklistItem): boolean {
  return task.is_default === true && 
         task.user_modified === false && 
         task.template_key !== null;
}

/**
 * Marks a task as user-modified to prevent template updates
 */
export function markTaskAsUserModified(task: ChecklistItem): Partial<ChecklistItem> {
  return {
    user_modified: true,
    // Keep the original template_key for reference
  };
}
