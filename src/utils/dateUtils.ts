export const formatDate = (date: Date | string | undefined | null, locale: string = 'he-IL'): string => {
  if (!date) return locale === 'he-IL' ? 'תאריך לא זמין' : 'Date not available';
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) {
      return locale === 'he-IL' ? 'תאריך לא תקין' : 'Invalid date';
    }
    
    return new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short'
    }).format(dateObj);
  } catch (error) {
    return locale === 'he-IL' ? 'תאריך לא תקין' : 'Invalid date';
  }
};

export const formatDateTime = (date: Date | string | undefined | null, locale: string = 'he-IL'): string => {
  if (!date) return locale === 'he-IL' ? 'תאריך לא זמין' : 'Date not available';
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) {
      return locale === 'he-IL' ? 'תאריך לא תקין' : 'Invalid date';
    }
    
    return new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    }).format(dateObj);
  } catch (error) {
    return locale === 'he-IL' ? 'תאריך לא תקין' : 'Invalid date';
  }
};

export const formatDueDate = (date: Date | string | undefined | null, locale: string = 'he-IL'): string => {
  if (!date) return locale === 'he-IL' ? 'תאריך לא זמין' : 'Date not available';
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) {
      return locale === 'he-IL' ? 'תאריך לא תקין' : 'Invalid date';
    }
    
    return new Intl.DateTimeFormat(locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'short'
    }).format(dateObj);
  } catch (error) {
    return locale === 'he-IL' ? 'תאריך לא תקין' : 'Invalid date';
  }
};

export const isDateValid = (date: Date | string | undefined | null): boolean => {
  if (!date) return false;
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    return !isNaN(dateObj.getTime());
  } catch {
    return false;
  }
};

export const isDateOverdue = (date: Date | string | undefined | null): boolean => {
  if (!isDateValid(date)) return false;
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date!;
    return new Date() > dateObj;
  } catch {
    return false;
  }
};

// Cleaning cycle calculation functions
export interface CleaningTask {
  assigned_at: string | null; // ISO timestamp
  frequency_days: number;
  last_completed_at?: string | null; // ISO timestamp
  last_completed_by?: string | null;
}

export interface ChecklistItem {
  completed: boolean;
  completed_by?: string | null;
  completed_at?: string | null; // ISO timestamp
}

/**
 * Find the next occurrence of a specific day of week from a given date
 * @param fromDate Starting date
 * @param targetDow Target day of week (0=Sunday, 1=Monday, ..., 6=Saturday)
 * @param inclusive When true, if fromDate is already on targetDow, return fromDate
 */
export function getNextDayOfWeek(fromDate: Date, targetDow: number, inclusive: boolean = false): Date {
  const current = new Date(fromDate);
  const currentDow = current.getDay();
  let daysToAdd = (targetDow - currentDow + 7) % 7;
  if (daysToAdd === 0 && !inclusive) {
    daysToAdd = 7;
  }
  current.setDate(current.getDate() + daysToAdd);
  return current;
}

/**
 * Calculate the proper cycle anchor based on day of week settings
 * If creation is already on the anchor day, return creation (inclusive)
 */
export function calculateCycleAnchor(creationDate: Date, anchorDow: number): Date {
  const creation = new Date(creationDate);
  const creationDow = creation.getDay();
  if (creationDow === anchorDow) {
    return creation;
  }
  return getNextDayOfWeek(creation, anchorDow, false);
}

/**
 * Calculate the current cleaning cycle based on assigned_at and frequency_days
 */
export function getCurrentCycle(task: {
  assigned_at: string | null;
  frequency_days: number;     // או intervalDays
  dueDate?: string | null;
}) {
  const dayMs = 24 * 60 * 60 * 1000;
  const frequencyDays = task.frequency_days && task.frequency_days > 0 ? task.frequency_days : 7;
  const lenMs = frequencyDays * dayMs;
  const now = new Date();

  // אם אין assigned_at – נתחיל מהיום (מונע NaN)
  const baseStart = task.assigned_at ? new Date(task.assigned_at) : now;

  // אם dueDate קיים והזמן עבר אותו, נגלגל מחזורים קדימה
  if (task.dueDate) {
    const due = new Date(task.dueDate);
    if (!isNaN(due.getTime()) && now > due) {
      // גלגול מדויק לפי מרחק מה־assigned_at
      const diff = now.getTime() - baseStart.getTime();
      const k = Math.floor(diff / lenMs); // כמה מחזורים עברו מאז ה־assigned_at
      const cycleStart = new Date(baseStart.getTime() + k * lenMs);
      const cycleEnd = new Date(cycleStart.getTime() + lenMs);
      return { cycleStart, cycleEnd };
    }
  }

  // מקרה רגיל: עכשיו בתוך המחזור שנקבע מה־assigned_at
  const diff = Math.max(0, now.getTime() - baseStart.getTime());
  const k = Math.floor(diff / lenMs);
  const cycleStart = new Date(baseStart.getTime() + k * lenMs);
  const cycleEnd = new Date(cycleStart.getTime() + lenMs);
  return { cycleStart, cycleEnd };
}

/**
 * Calculate the current cleaning cycle based on chosen day-of-week (anchor)
 * and a day-based interval (supports non-multiples of 7 as well).
 */
export function getCurrentCycleWithDayOfWeek(task: {
  assigned_at: string | null;
  frequency_days: number;
  dueDate?: string | null;
}, anchorDow: number = 0) {
  const dayMs = 24 * 60 * 60 * 1000;
  const frequencyDays = task.frequency_days && task.frequency_days > 0 ? task.frequency_days : 7;
  const lenMs = frequencyDays * dayMs;
  const now = new Date();

  const baseCreation = task.assigned_at ? new Date(task.assigned_at) : now;
  const cycleAnchor = calculateCycleAnchor(baseCreation, anchorDow);

  if (task.dueDate) {
    const due = new Date(task.dueDate);
    if (!isNaN(due.getTime()) && now > due) {
      const diff = now.getTime() - cycleAnchor.getTime();
      const k = Math.floor(diff / lenMs);
      const cycleStart = new Date(cycleAnchor.getTime() + k * lenMs);
      const cycleEnd = new Date(cycleStart.getTime() + lenMs);
      return { cycleStart, cycleEnd };
    }
  }

  const diff = Math.max(0, now.getTime() - cycleAnchor.getTime());
  const k = Math.floor(diff / lenMs);
  const cycleStart = new Date(cycleAnchor.getTime() + k * lenMs);
  const cycleEnd = new Date(cycleStart.getTime() + lenMs);
  return { cycleStart, cycleEnd };
}

/**
 * Enhanced version that takes cleaning settings into account
 */
export function getCurrentCycleWithSettings(task: {
  assigned_at: string | null;
  frequency_days: number;
  dueDate?: string | null;
}, cleaningSettings?: {
  anchorDow: number;
  intervalDays: number;
}) {
  if (!cleaningSettings) {
    return getCurrentCycle(task);
  }
  // Respect frequency_days coming from task; fallback to settings interval
  const frequency_days = task.frequency_days || cleaningSettings.intervalDays || 7;
  return getCurrentCycleWithDayOfWeek({ ...task, frequency_days }, cleaningSettings.anchorDow);
}

/**
 * Check if the current user has completed their turn in the current cycle
 */
function inRange(ts: string | null | undefined, start: Date, end: Date) {
  if (!ts) return false;
  const d = new Date(ts);
  return !isNaN(d.getTime()) && d >= start && d <= end;
}

export function isTurnCompletedForCurrentCycleWithSettings({
  uid,
  task,
  checklistItems,
  cleaningSettings,
}: {
  uid: string;
  task: {
    assigned_at: string | null;
    frequency_days: number;
    last_completed_at?: string | null;
    last_completed_by?: string | null;
    dueDate?: string | null;
  };
  checklistItems: Array<{
    completed: boolean;
    completed_by?: string | null;
    completed_at?: string | null;
  }>;
  cleaningSettings?: {
    anchorDow: number;
    intervalDays: number;
  };
}) {
  const now = new Date();

  // אם עבר היעד ⇒ אנחנו במחזור חדש לוגית ⇒ לא הושלם עדיין (מותר לנקות שוב)
  if (task.dueDate) {
    const due = new Date(task.dueDate);
    if (!isNaN(due.getTime()) && now > due) {
      return false;
    }
  }

  const { cycleStart, cycleEnd } = getCurrentCycleWithSettings(task, cleaningSettings);

  // סיום לפי הצ'קליסט בתוך המחזור הנוכחי
  const allItemsDoneInCycle =
    checklistItems.length > 0 &&
    checklistItems.every(
      (it) =>
        it.completed === true &&
        it.completed_by === uid &&
        inRange(it.completed_at, cycleStart, cycleEnd)
    );

  if (allItemsDoneInCycle) return true;

  // פְּרוֹקְסִי לפי מטא (אם נשמרת היסטוריה ברמת המשימה)
  const metaSaysDone =
    task.last_completed_by === uid &&
    inRange(task.last_completed_at ?? null, cycleStart, cycleEnd);

  return !!metaSaysDone;
}

// Backward compatible wrapper (kept API in existing call sites)
export function isTurnCompletedForCurrentCycle({
  uid,
  task,
  checklistItems,
}: {
  uid: string;
  task: {
    assigned_at: string | null;
    frequency_days: number;
    last_completed_at?: string | null;
    last_completed_by?: string | null;
    dueDate?: string | null;
  };
  checklistItems: Array<{
    completed: boolean;
    completed_by?: string | null;
    completed_at?: string | null;
  }>;
}) {
  return isTurnCompletedForCurrentCycleWithSettings({ uid, task, checklistItems });
}