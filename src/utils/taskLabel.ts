import i18n from '../i18n';
import { ChecklistItem } from '../types';

/**
 * Helper function to get the proper display label for a cleaning task
 * Handles both default tasks (with translation keys) and custom tasks
 */
export function getTaskLabel(rawTitle: string): string;
export function getTaskLabel(task: ChecklistItem): string;
export function getTaskLabel(input: string | ChecklistItem): string {
  // Handle ChecklistItem object
  if (typeof input === 'object' && input !== null) {
    const task = input as ChecklistItem;
    
    // If it's a default task and has template_key, use that for translation
    if (task.template_key && task.is_default) {
      try {
        return i18n.t(task.template_key, { defaultValue: task.title });
      } catch (error) {
        console.warn('Translation failed for template_key:', task.template_key, error);
        return task.title;
      }
    }
    
    // If title is a translation key, translate it
    if (task.title && task.title.startsWith('cleaning.defaultTasks.')) {
      try {
        return i18n.t(task.title, { defaultValue: task.title });
      } catch (error) {
        console.warn('Translation failed for key:', task.title, error);
        return task.title;
      }
    }
    
    // Otherwise, return the title as is
    return task.title;
  }
  
  // Handle string input (legacy support)
  const rawTitle = input as string;
  
  // If the title starts with 'cleaning.defaultTasks.', it's a translation key
  if (rawTitle && rawTitle.startsWith('cleaning.defaultTasks.')) {
    // Try to translate using i18n, fallback to the raw title if translation fails
    try {
      const translated = i18n.t(rawTitle, { defaultValue: rawTitle });
      return translated;
    } catch (error) {
      console.warn('Translation failed for key:', rawTitle, error);
      return rawTitle;
    }
  }
  
  // Otherwise, it's a custom task title - return as is
  return rawTitle;
}

/**
 * Check if a task title is a default task (translation key)
 */
export function isDefaultTask(title: string): boolean {
  return Boolean(title && title.startsWith('cleaning.defaultTasks.'));
}

/**
 * Get the translation key for a default task
 */
export function getDefaultTaskKey(title: string): string | null {
  if (isDefaultTask(title)) {
    return title;
  }
  return null;
}
