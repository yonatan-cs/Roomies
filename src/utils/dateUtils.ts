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
 * Calculate the current cleaning cycle based on assigned_at and frequency_days
 */
export function getCurrentCycle(task: {
  assigned_at: string | null;
  frequency_days: number;     // או intervalDays
  dueDate?: string | null;
}) {
  const freq = task.frequency_days || 7;               // fallback לשבועי
  const lenMs = freq * 24 * 60 * 60 * 1000;
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
 * Check if the current user has completed their turn in the current cycle
 */
function inRange(ts: string | null | undefined, start: Date, end: Date) {
  if (!ts) return false;
  const d = new Date(ts);
  return !isNaN(d.getTime()) && d >= start && d <= end;
}

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
  const now = new Date();

  // אם עבר היעד ⇒ אנחנו במחזור חדש לוגית ⇒ לא הושלם עדיין (מותר לנקות שוב)
  if (task.dueDate) {
    const due = new Date(task.dueDate);
    if (!isNaN(due.getTime()) && now > due) {
      return false;
    }
  }

  const { cycleStart, cycleEnd } = getCurrentCycle(task);

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