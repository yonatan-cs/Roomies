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