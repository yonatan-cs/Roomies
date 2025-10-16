/**
 * דוגמה לשימוש בפונקציית סגירת חוב החדשה
 * 
 * קובץ זה מראה איך להשתמש בפונקציות החדשות לסגירת חוב
 * שמשתמשות ב-updateMask כדי לעקוף בעיות הרשאה
 */

import { firestoreService } from '../services/firestore-service';
import { useStore } from '../state/store';

/**
 * דוגמה 1: סגירת חוב פשוטה דרך firestoreService
 */
export async function closeDebtExample1(debtId: string): Promise<void> {
  try {
    console.log('🔒 מתחיל לסגור חוב:', debtId);
    
    // סגירת חוב עם המשתמש הנוכחי
    await firestoreService.closeDebt(debtId);
    
    console.log('✅ החוב נסגר בהצלחה:', debtId);
  } catch (error) {
    console.error('❌ שגיאה בסגירת החוב:', error);
    throw error;
  }
}

/**
 * דוגמה 2: סגירת חוב דרך ה-store
 */
export async function closeDebtExample2(debtId: string): Promise<void> {
  try {
    console.log('🔒 מתחיל לסגור חוב דרך store:', debtId);
    
    // קבלת הפונקציה מה-store
    const { closeDebt } = useStore();
    
    // סגירת חוב דרך ה-store
    await closeDebt(debtId);
    
    console.log('✅ החוב נסגר בהצלחה דרך store:', debtId);
  } catch (error) {
    console.error('❌ שגיאה בסגירת החוב דרך store:', error);
    throw error;
  }
}

/**
 * דוגמה 3: סגירת חוב עם פרמטרים נוספים
 */
export async function closeDebtExample3(debtId: string, closedBy?: string): Promise<void> {
  try {
    console.log('🔒 מתחיל לסגור חוב עם פרמטרים:', { debtId, closedBy });
    
    // סגירת חוב עם משתמש ספציפי
    await firestoreService.closeDebtWithParams(debtId, closedBy);
    
    console.log('✅ החוב נסגר בהצלחה עם פרמטרים:', debtId);
  } catch (error) {
    console.error('❌ שגיאה בסגירת החוב עם פרמטרים:', error);
    throw error;
  }
}

/**
 * דוגמה 4: סגירת חוב עם בדיקות נוספות
 */
export async function closeDebtExample4(debtId: string): Promise<void> {
  try {
    console.log('🔒 מתחיל לסגור חוב עם בדיקות:', debtId);
    
    // בדיקה שהחוב קיים
    const debts = await firestoreService.getDebts();
    const debt = debts.find(d => d.name?.split('/').pop() === debtId);
    
    if (!debt) {
      throw new Error('חוב לא נמצא');
    }
    
    // בדיקה שהחוב פתוח
    const status = debt.fields?.status?.stringValue;
    if (status !== 'open') {
      throw new Error('החוב כבר סגור או במצב לא תקין');
    }
    
    // סגירת החוב
    await firestoreService.closeDebt(debtId);
    
    console.log('✅ החוב נסגר בהצלחה עם בדיקות:', debtId);
  } catch (error) {
    console.error('❌ שגיאה בסגירת החוב עם בדיקות:', error);
    throw error;
  }
}

/**
 * דוגמה 5: סגירת חוב עם retry logic
 */
export async function closeDebtExample5(debtId: string, maxRetries: number = 3): Promise<void> {
  let retries = 0;
  
  while (retries < maxRetries) {
    try {
      console.log(`🔒 מתחיל לסגור חוב (ניסיון ${retries + 1}/${maxRetries}):`, debtId);
      
      await firestoreService.closeDebt(debtId);
      
      console.log('✅ החוב נסגר בהצלחה עם retry:', debtId);
      return;
    } catch (error) {
      retries++;
      console.error(`❌ שגיאה בסגירת החוב (ניסיון ${retries}/${maxRetries}):`, error);
      
      if (retries >= maxRetries) {
        throw error;
      }
      
      // המתנה לפני הניסיון הבא
      await new Promise(resolve => setTimeout(resolve, 1000 * retries));
    }
  }
}

/**
 * דוגמה 6: סגירת חוב עם transaction
 */
export async function closeDebtExample6(debtId: string): Promise<void> {
  try {
    console.log('🔒 מתחיל לסגור חוב עם transaction:', debtId);
    
    // כאן אפשר להוסיף לוגיקה נוספת לפני סגירת החוב
    // למשל: עדכון balances, יצירת action log וכו'
    
    // סגירת החוב
    await firestoreService.closeDebt(debtId);
    
    // כאן אפשר להוסיף לוגיקה נוספת אחרי סגירת החוב
    // למשל: שליחת התראה, עדכון UI וכו'
    
    console.log('✅ החוב נסגר בהצלחה עם transaction:', debtId);
  } catch (error) {
    console.error('❌ שגיאה בסגירת החוב עם transaction:', error);
    throw error;
  }
}

/**
 * דוגמה 7: סגירת חוב עם error handling מתקדם
 */
export async function closeDebtExample7(debtId: string): Promise<void> {
  try {
    console.log('🔒 מתחיל לסגור חוב עם error handling מתקדם:', debtId);
    
    await firestoreService.closeDebt(debtId);
    
    console.log('✅ החוב נסגר בהצלחה עם error handling מתקדם:', debtId);
  } catch (error) {
    console.error('❌ שגיאה בסגירת החוב עם error handling מתקדם:', error);
    
    // טיפול בשגיאות ספציפיות
    if (error instanceof Error) {
      if (error.message.includes('PERMISSION_DENIED')) {
        throw new Error('אין לך הרשאה לסגור חוב זה');
      } else if (error.message.includes('NOT_FOUND')) {
        throw new Error('החוב לא נמצא');
      } else if (error.message.includes('INVALID_ARGUMENT')) {
        throw new Error('פרמטרים לא תקינים');
      }
    }
    
    throw error;
  }
}

/**
 * דוגמה 8: סגירת חוב עם validation
 */
export async function closeDebtExample8(debtId: string): Promise<void> {
  try {
    console.log('🔒 מתחיל לסגור חוב עם validation:', debtId);
    
    // בדיקות validation
    if (!debtId || debtId.trim() === '') {
      throw new Error('ID החוב לא יכול להיות ריק');
    }
    
    if (debtId.length < 3) {
      throw new Error('ID החוב קצר מדי');
    }
    
    // סגירת החוב
    await firestoreService.closeDebt(debtId);
    
    console.log('✅ החוב נסגר בהצלחה עם validation:', debtId);
  } catch (error) {
    console.error('❌ שגיאה בסגירת החוב עם validation:', error);
    throw error;
  }
}

/**
 * דוגמה 9: סגירת חוב עם logging מתקדם
 */
export async function closeDebtExample9(debtId: string): Promise<void> {
  const startTime = Date.now();
  
  try {
    console.log('🔒 מתחיל לסגור חוב עם logging מתקדם:', {
      debtId,
      timestamp: new Date().toISOString(),
      startTime
    });
    
    await firestoreService.closeDebt(debtId);
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.log('✅ החוב נסגר בהצלחה עם logging מתקדם:', {
      debtId,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    console.error('❌ שגיאה בסגירת החוב עם logging מתקדם:', {
      debtId,
      error: error instanceof Error ? error.message : String(error),
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    });
    
    throw error;
  }
}

/**
 * דוגמה 10: סגירת חוב עם callback
 */
export async function closeDebtExample10(
  debtId: string, 
  onSuccess?: (debtId: string) => void,
  onError?: (debtId: string, error: Error) => void
): Promise<void> {
  try {
    console.log('🔒 מתחיל לסגור חוב עם callback:', debtId);
    
    await firestoreService.closeDebt(debtId);
    
    console.log('✅ החוב נסגר בהצלחה עם callback:', debtId);
    
    // קריאה ל-callback של הצלחה
    if (onSuccess) {
      onSuccess(debtId);
    }
  } catch (error) {
    console.error('❌ שגיאה בסגירת החוב עם callback:', error);
    
    // קריאה ל-callback של שגיאה
    if (onError) {
      onError(debtId, error as Error);
    }
    
    throw error;
  }
}
