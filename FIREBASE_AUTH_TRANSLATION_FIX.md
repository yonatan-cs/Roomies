# תיקון תרגום שגיאות Firebase Authentication

## 🔍 הבעיה שזוהתה
היו טקסטים קשיחים בעברית ב-`firebase-auth.ts` שלא התאימו לשינוי שפה:
- "שגיאה באימות המשתמש"
- "כתובת האימייל כבר קיימת במערכת"
- "סיסמה שגויה"
- ועוד...

## ✅ הפתרון
הפרדנו בין לוגיקת השגיאות לתרגום:

### 1. Service Layer (firebase-auth.ts)
**לפני:**
```typescript
return new Error('שגיאה באימות המשתמש');  // טקסט קשיח!
```

**אחרי:**
```typescript
return new Error('AUTHENTICATION_FAILED');  // קוד שגיאה
```

השירות כעת מחזיר **קודי שגיאה** במקום טקסטים מתורגמים.

### 2. Translation Layer (i18n/index.ts)
נוספו תרגומים לכל קודי השגיאה:

#### 🇺🇸 English:
```typescript
EMAIL_EXISTS: 'This email address is already in use',
OPERATION_NOT_ALLOWED: 'This operation is not allowed',
TOO_MANY_ATTEMPTS: 'Too many attempts. Please try again later',
EMAIL_NOT_FOUND: 'Email address not found',
INVALID_PASSWORD: 'Incorrect password',
USER_DISABLED: 'This user has been disabled',
INVALID_EMAIL: 'Invalid email address',
WEAK_PASSWORD: 'Password must be at least 6 characters',
AUTHENTICATION_FAILED: 'Authentication error'
```

#### 🇮🇱 עברית:
```typescript
EMAIL_EXISTS: 'כתובת האימייל כבר קיימת במערכת',
OPERATION_NOT_ALLOWED: 'פעולה זו אינה מורשית',
TOO_MANY_ATTEMPTS: 'יותר מדי ניסיונות. נסה שוב מאוחר יותר',
EMAIL_NOT_FOUND: 'כתובת אימייל לא נמצאה',
INVALID_PASSWORD: 'סיסמה שגויה',
USER_DISABLED: 'משתמש זה הושבת',
INVALID_EMAIL: 'כתובת אימייל לא חוקית',
WEAK_PASSWORD: 'הסיסמה חייבת להכיל לפחות 6 תווים',
AUTHENTICATION_FAILED: 'שגיאה באימות המשתמש'
```

### 3. UI Layer (AuthScreen.tsx)
**לפני:**
```typescript
setLoginError(error.message || t('auth.errors.loginFailed'));
```

**אחרי:**
```typescript
const errorCode = error.message || 'AUTHENTICATION_FAILED';
const translationKey = `auth.errors.${errorCode}`;
const translatedError = t(translationKey, { defaultValue: t('auth.errors.loginFailed') });
setLoginError(translatedError);
```

ה-UI מתרגם את קודי השגיאה לשפה המתאימה.

## 📋 קודי שגיאה נתמכים

| קוד שגיאה | עברית | English |
|-----------|-------|---------|
| `EMAIL_EXISTS` | כתובת האימייל כבר קיימת במערכת | This email address is already in use |
| `INVALID_PASSWORD` | סיסמה שגויה | Incorrect password |
| `EMAIL_NOT_FOUND` | כתובת אימייל לא נמצאה | Email address not found |
| `TOO_MANY_ATTEMPTS` | יותר מדי ניסיונות | Too many attempts |
| `USER_DISABLED` | משתמש זה הושבת | This user has been disabled |
| `WEAK_PASSWORD` | הסיסמה חייבת להכיל לפחות 6 תווים | Password must be at least 6 characters |
| `AUTHENTICATION_FAILED` | שגיאה באימות המשתמש | Authentication error |

## 🎯 איך זה עובד עכשיו?

1. **Firebase מחזיר שגיאה** → `EMAIL_EXISTS`
2. **Service מעביר קוד** → `new Error('EMAIL_EXISTS')`
3. **UI מתרגם לשפה** → `t('auth.errors.EMAIL_EXISTS')`
4. **משתמש רואה** → "כתובת האימייל כבר קיימת במערכת" (עברית) או "This email address is already in use" (אנגלית)

## ✨ יתרונות

- ✅ תמיכה מלאה בשינוי שפה
- ✅ אין טקסט קשיח בשירותים
- ✅ קל להוסיף שפות נוספות
- ✅ מרכזיות התרגומים במקום אחד
- ✅ ברירת מחדל אם תרגום לא נמצא
- ✅ קריאות ותחזוקה טובה יותר

## 🧪 בדיקות

### תרחישי בדיקה:
1. ✅ ניסיון להירשם עם אימייל קיים
2. ✅ סיסמה שגויה בהתחברות
3. ✅ אימייל לא נמצא
4. ✅ יותר מדי ניסיונות
5. ✅ שינוי שפה בזמן הצגת שגיאה

### תוצאות:
- **עברית** 🇮🇱 - כל השגיאות מוצגות בעברית
- **אנגלית** 🇺🇸 - כל השגיאות מוצגות באנגלית
- **מצב כהה** 🌙 - השגיאות מוצגות בצבעים מותאמים

## 📝 קבצים שעודכנו

1. `/src/services/firebase-auth.ts` - החזרת קודי שגיאה
2. `/src/i18n/index.ts` - תרגומי קודי השגיאה
3. `/src/screens/AuthScreen.tsx` - תרגום קודי השגיאה ב-UI

## 🚀 שימוש לעתיד

כדי להוסיף קוד שגיאה חדש:

1. **הוסף את הקוד ב-firebase-auth.ts:**
```typescript
'NEW_ERROR': 'NEW_ERROR',
```

2. **הוסף תרגום ב-i18n/index.ts:**
```typescript
// English
NEW_ERROR: 'Error message in English',

// Hebrew
NEW_ERROR: 'הודעת שגיאה בעברית',
```

3. **השתמש בו:** הקוד יתורגם אוטומטית ב-AuthScreen!

