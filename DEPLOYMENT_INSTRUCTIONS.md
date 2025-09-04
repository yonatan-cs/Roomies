# הוראות פריסה - פתרון סגירת חוב אטומית

## שלב 1: הכנת Firebase Functions

### 1.1 התקנת תלויות
```bash
cd functions
npm install
```

### 1.2 בניית הפרויקט
```bash
npm run build
```

### 1.3 בדיקה מקומית (אופציונלי)
```bash
npm run serve
```

## שלב 2: פריסת Cloud Functions

### 2.1 התחברות ל-Firebase
```bash
firebase login
```

### 2.2 בחירת פרויקט
```bash
firebase use your-project-id
```

### 2.3 פריסת Functions
```bash
firebase deploy --only functions
```

### 2.4 בדיקת הפריסה
```bash
firebase functions:log
```

## שלב 3: עדכון Firestore Rules

### 3.1 פריסת Rules
```bash
firebase deploy --only firestore:rules
```

### 3.2 בדיקת Rules
- לך ל-Firebase Console → Firestore → Rules
- ודא שה-rules החדשים פרוסים

## שלב 4: עדכון הקליינט

### 4.1 התקנת Firebase Functions SDK
```bash
npm install firebase
```

### 4.2 עדכון Firebase Config
ודא שה-`firebaseConfig` כולל את ה-project ID הנכון.

### 4.3 בדיקת חיבור
```javascript
import { getFunctions } from 'firebase/functions';
const functions = getFunctions();
console.log('Functions initialized:', functions);
```

## שלב 5: בדיקות QA

### 5.1 בדיקה בסיסית
1. לפתוח את האפליקציה
2. ללכת למסך "חובות קבוצתיים"
3. לנסות לסגור חוב
4. לוודא שהפעולה מצליחה

### 5.2 בדיקת בסיס הנתונים
1. לפתוח Firebase Console
2. לבדוק `debts` collection - החוב צריך להיות `status: 'closed'`
3. לבדוק `monthlyExpenses` - צריך להיות רשומה חדשה
4. לבדוק `balances` - צריך להיות עדכון
5. לבדוק `actions` - צריך להיות action log

### 5.3 בדיקת שגיאות
1. לנסות לסגור חוב שכבר סגור - צריך לקבל שגיאה
2. לנסות לסגור חוב ללא הרשאה - צריך לקבל שגיאה

## שלב 6: ניטור וניפוי באגים

### 6.1 Cloud Functions Logs
```bash
firebase functions:log --only closeDebt,createAndCloseDebt
```

### 6.2 Firestore Logs
- לך ל-Firebase Console → Firestore → Usage
- בדוק אם יש שגיאות

### 6.3 Client Logs
- פתח Developer Tools
- בדוק Console logs
- חפש שגיאות Firebase Functions

## פתרון בעיות נפוצות

### בעיה: "Function not found"
**פתרון:**
1. ודא שה-Functions פרוסות: `firebase functions:list`
2. ודא שה-project ID נכון ב-client
3. המתן כמה דקות אחרי הפריסה

### בעיה: "Permission denied"
**פתרון:**
1. בדוק Firestore Rules
2. ודא שה-user מחובר
3. בדוק `apartmentMembers` collection

### בעיה: "Transaction failed"
**פתרון:**
1. בדוק Cloud Functions logs
2. ודא שהחוב קיים
3. בדוק אם החוב כבר סגור

### בעיה: "Network error"
**פתרון:**
1. בדוק חיבור לאינטרנט
2. בדוק Firebase status
3. נסה שוב אחרי כמה דקות

## בדיקת ביצועים

### מדידת זמן תגובה
```javascript
const startTime = Date.now();
const result = await createAndCloseDebtAtomic(...);
const endTime = Date.now();
console.log(`Operation took ${endTime - startTime}ms`);
```

### בדיקת זיכרון
- פתח Chrome DevTools → Memory
- בצע מספר פעולות
- בדוק שאין דליפות זיכרון

## גיבוי ושחזור

### גיבוי Firestore
```bash
gcloud firestore export gs://your-bucket/backup-$(date +%Y%m%d)
```

### שחזור Firestore
```bash
gcloud firestore import gs://your-bucket/backup-20250104
```

## עדכונים עתידיים

### עדכון Functions
1. ערוך `functions/src/index.ts`
2. הרץ `npm run build`
3. הרץ `firebase deploy --only functions`

### עדכון Rules
1. ערוך `firestore-rules-fixed.txt`
2. הרץ `firebase deploy --only firestore:rules`

### עדכון Client
1. ערוך קבצי הקליינט
2. בנה ופרוס את האפליקציה

## אישור הפריסה

- [ ] Cloud Functions פרוסות
- [ ] Firestore Rules מעודכנים
- [ ] הקליינט מעודכן
- [ ] בדיקות QA עברו
- [ ] ניטור פעיל
- [ ] גיבוי מוכן

**שם המפרס:** _______________
**תאריך:** _______________
**גרסה:** _______________
