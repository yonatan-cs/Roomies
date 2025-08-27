# 🔧 מדריך פתרון בעיות - Roomies Hub

## 🚨 הבעיות הנפוצות וכיצד לפתור אותן

### 1. ❌ "Missing or insufficient permissions"

**סיבות אפשריות:**
- המשתמש לא מחובר כראוי
- ה-ID Token פג תוקף
- בעיה בכללי האבטחה של Firestore

**פתרונות:**
1. **בדוק אימות משתמש:**
   ```javascript
   // בלוגים, חפש:
   🧑‍💻 Current user: NULL  // ⚠️ בעיה!
   🔑 ID Token: MISSING      // ⚠️ בעיה!
   ```

2. **התנתק והתחבר מחדש:**
   - לחץ על "התנתקות מהחשבון" בהגדרות
   - התחבר מחדש עם המייל והסיסמה

3. **בדוק תוקף Token:**
   ```javascript
   // בלוגים, חפש:
   ⏰ Token expires in -5 minutes  // ⚠️ Token פג!
   ```

### 2. ❌ "קוד דירה לא נמצא"

**סיבות אפשריות:**
- הקוד לא קיים ב-Firebase
- טעות הקלדה בקוד
- הקוד לא נוצר כראוי

**פתרונות:**
1. **בדוק קודים זמינים:**
   - השתמש בכפתור "בדיקת חיבור Firebase" בהגדרות
   - בלוגים, חפש: `📋 Available invite codes:`

2. **בדוק ב-Firebase Console:**
   - כנס ל-Firebase Console
   - לך ל-Firestore Database
   - בדוק את collection `apartmentInvites`
   - ודא שהקוד קיים כ-Document ID

3. **בדוק פורמט הקוד:**
   ```javascript
   // הקוד צריך להיות:
   📏 Code length: 6 characters  // ✅ נכון
   🔤 Code format: ABC123        // ✅ נכון - אותיות גדולות ומספרים
   ```

### 3. 🔄 "Token expired" / "Token refresh failed"

**פתרון:**
1. התנתק מהמערכת
2. התחבר מחדש
3. אם הבעיה נמשכת, נקה את cache האפליקציה

### 4. 🌐 "Network error" / "בעיית חיבור"

**פתרונות:**
1. בדוק חיבור אינטרנט
2. ודא שכתובת ה-Firebase נכונה:
   ```
   Project ID: roomies-hub
   Firestore URL: https://firestore.googleapis.com/v1/projects/roomies-hub/...
   ```

## 🧪 כלי דיבוג

### 1. בדיקת חיבור באפליקציה
- לך להגדרות → "בדיקת חיבור Firebase"
- הכפתור יראה מצב החיבור וקודים זמינים

### 2. בדיקת חיבור מהמחשב
```bash
cd /home/user/workspace
node debug-apartment-codes.js
```

### 3. בדיקה עם אימות
```bash
# העתק ID Token מהלוגים של האפליקציה
node debug-apartment-codes.js YOUR_ID_TOKEN

# בדיקת קוד ספציפי
node debug-apartment-codes.js YOUR_ID_TOKEN ABC123
```

## 📋 לוגים חשובים לחיפוש

### ✅ לוגים תקינים:
```
🔐 Getting auth headers...
🧑‍💻 Current user: abc123 (user@email.com)
🔑 ID Token: Present (eyJhbGciOiJSUzI1...)
✅ Auth headers prepared successfully
🔍 Token info: { algorithm: 'RS256', userId: 'abc123', email: 'user@email.com' }
⏰ Token expires in 55 minutes
```

### ❌ לוגים עם בעיות:
```
🧑‍💻 Current user: NULL                    // ⚠️ לא מחובר
🔑 ID Token: MISSING                       // ⚠️ אין Token
❌ Token is expired!                        // ⚠️ Token פג
❌ Authentication failed: No ID token      // ⚠️ בעיית אימות
```

## 🔨 צעדי פתרון בעיות שלב אחר שלב

### צעד 1: בדיקה בסיסית
1. פתח את הקונסול של האפליקציה
2. נסה להצטרף לדירה עם קוד
3. חפש בלוגים את הסמלים 🔐 🧑‍💻 🔑

### צעד 2: בדיקת אימות
אם רואה "NULL" או "MISSING":
1. לך להגדרות
2. לחץ "התנתקות מהחשבון"
3. התחבר מחדש

### צעד 3: בדיקת קודים
1. לחץ "בדיקת חיבור Firebase" בהגדרות
2. בדוק איזה קודים זמינים
3. השווה עם הקוד שאתה מנסה להכניס

### צעד 4: פתרון מתקדם
אם כלום לא עובד:
1. הרץ: `node debug-apartment-codes.js`
2. שלח את התוצאות למפתח
3. כלול את הלוגים מהקונסול

## 🎯 כיצד ליצור קוד דירה חדש

אם אין קודים זמינים:
1. צור דירה חדשה באפליקציה
2. הקוד ייווצר אוטומטית
3. שתף את הקוד עם שותפים

## 📞 קבלת עזרה

אם הבעיה לא נפתרת:
1. צלם screenshot של השגיאה
2. העתק את הלוגים מהקונסול
3. כלול את תוצאות בדיקת החיבור
4. פנה לתמיכה עם כל המידע
