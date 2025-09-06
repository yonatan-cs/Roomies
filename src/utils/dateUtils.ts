export const formatDate = (date: Date | string | undefined | null): string => {
  if (!date) return 'תאריך לא זמין';
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) {
      return 'תאריך לא תקין';
    }
    
    return new Intl.DateTimeFormat('he-IL', {
      day: 'numeric',
      month: 'short'
    }).format(dateObj);
  } catch (error) {
    return 'תאריך לא תקין';
  }
};

export const formatDateTime = (date: Date | string | undefined | null): string => {
  if (!date) return 'תאריך לא זמין';
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) {
      return 'תאריך לא תקין';
    }
    
    return new Intl.DateTimeFormat('he-IL', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    }).format(dateObj);
  } catch (error) {
    return 'תאריך לא תקין';
  }
};

export const formatDueDate = (date: Date | string | undefined | null): string => {
  if (!date) return 'תאריך לא זמין';
  
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) {
      return 'תאריך לא תקין';
    }
    
    return new Intl.DateTimeFormat('he-IL', {
      weekday: 'long',
      day: 'numeric',
      month: 'short'
    }).format(dateObj);
  } catch (error) {
    return 'תאריך לא תקין';
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
export function getCurrentCycle(task: CleaningTask, now = new Date()) {
  if (!task.assigned_at) {
    // If no assigned_at, use current time as cycle start
    const cycleStart = new Date(now);
    const cycleEnd = new Date(cycleStart.getTime() + task.frequency_days * 24 * 60 * 60 * 1000);
    return { cycleStart, cycleEnd };
  }

  const start = new Date(task.assigned_at);
  const lenMs = task.frequency_days * 24 * 60 * 60 * 1000;
  const cycles = Math.floor((now.getTime() - start.getTime()) / lenMs);
  const cycleStart = new Date(start.getTime() + cycles * lenMs);
  const cycleEnd = new Date(cycleStart.getTime() + lenMs);
  return { cycleStart, cycleEnd };
}

/**
 * Check if the current user has completed their turn in the current cycle
 */
export function isTurnCompletedForCurrentCycle({
  uid,
  task,
  checklistItems
}: {
  uid: string;
  task: CleaningTask;
  checklistItems: ChecklistItem[];
}) {
  const { cycleStart, cycleEnd } = getCurrentCycle(task);
  
  // Helper function to check if a timestamp is within the current cycle
  const inCycle = (timestamp?: string | null) => {
    if (!timestamp) return false;
    const date = new Date(timestamp);
    return date >= cycleStart && date < cycleEnd;
  };

  // Check if all checklist items are completed by this user in the current cycle
  const allItemsDone = checklistItems.length > 0 && checklistItems.every(
    item => item.completed === true &&
            item.completed_by === uid &&
            inCycle(item.completed_at)
  );

  // Check if the task metadata indicates completion by this user in the current cycle
  const metaSaysDone =
    task.last_completed_by === uid &&
    inCycle(task.last_completed_at);

  return allItemsDone || metaSaysDone;
}