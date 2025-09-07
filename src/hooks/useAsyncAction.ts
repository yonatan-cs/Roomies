import { useCallback, useRef, useState } from 'react';

type Options = {
  // מתי להראות ספינר כדי להימנע מהבזק קצר
  spinnerDelayMs?: number; // default 180
  // לכמה זמן מינימום להשאיר את הספינר אחרי שהופיע (נעים לעין)
  minSpinnerVisibleMs?: number; // default 250
  // לנעילת כפתור/אזור בלבד, לא את כל המסך
  onStateChange?: (loading: boolean) => void;
};

export function useAsyncAction<T extends any[]>(
  fn: (...args: T) => Promise<any>,
  opts: Options = {}
) {
  const { spinnerDelayMs = 180, minSpinnerVisibleMs = 250, onStateChange } = opts;

  const [loading, setLoading] = useState(false);
  const spinnerTimer = useRef<NodeJS.Timeout | null>(null);
  const spinnerShownAt = useRef<number | null>(null);
  const isRunning = useRef(false); // הגנה מפני double-tap

  const run = useCallback(async (...args: T) => {
    // הגנה מפני double-tap מהיר
    if (isRunning.current) {
      return;
    }
    isRunning.current = true;

    let showSpinner = false;

    // דחיית הספינר — אם הפעולה קצרה, לא נציג כלום
    spinnerTimer.current = setTimeout(() => {
      showSpinner = true;
      spinnerShownAt.current = Date.now();
      setLoading(true);
      onStateChange?.(true);
    }, spinnerDelayMs);

    // להתחיל בפריים הבא — מרכך סטטרים
    await new Promise<void>((resolve) => {
      if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(() => resolve());
      } else {
        resolve();
      }
    });

    try {
      const res = await fn(...args);
      return res;
    } finally {
      isRunning.current = false; // שחרור הנעילה
      
      if (spinnerTimer.current) {
        clearTimeout(spinnerTimer.current);
        spinnerTimer.current = null;
      }
      if (showSpinner && spinnerShownAt.current) {
        const elapsed = Date.now() - spinnerShownAt.current;
        const remain = Math.max(0, minSpinnerVisibleMs - elapsed);
        setTimeout(() => {
          setLoading(false);
          onStateChange?.(false);
          spinnerShownAt.current = null;
        }, remain);
      } else {
        // לא הוצג ספינר — שחרור מיידי
        setLoading(false);
        onStateChange?.(false);
      }
    }
  }, [fn, spinnerDelayMs, minSpinnerVisibleMs, onStateChange]);

  return { run, loading };
}
