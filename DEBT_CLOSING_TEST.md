# בדיקת פתרון סגירת חוב

## מה תוקן

### 1. תיקון `toFirestoreFormat`
- זיהוי אוטומטי של שדות זמן (שמסתיימים ב-`_at` או מכילים `date/time`)
- המרה אוטומטית של מחרוזות ISO ל-`timestampValue`

### 2. תיקון פונקציות `closeDebt`
- קריאת החוב לפני העדכון כדי לקבל `apartment_id`
- וידוא ש-`current_apartment_id` של המשתמש תואם לדירה של החוב
- שליחת `closed_at` כ-`Date` במקום מחרוזת

### 3. הוספת לוגים מפורטים
- לוגים של URL, updateMask, ו-body לפני הקריאה
- לוגים מפורטים של שגיאות

## איך לבדוק

### 1. בדיקה עם Rules Playground

1. לך ל-Firebase Console → Firestore → Rules
2. לחץ על "Rules playground"
3. בחר path: `/projects/roomies-hub/databases/(default)/documents/debts/{debtId}`
4. הגדר `auth.uid` למשתמש הנוכחי
5. הדבק את ה-request body:

```json
{
  "fields": {
    "status": { "stringValue": "closed" },
    "closed_at": { "timestampValue": "2024-01-01T00:00:00.000Z" },
    "closed_by": { "stringValue": "user_id_here" }
  }
}
```

6. בדוק שהתוצאה היא "Allow"

### 2. בדיקה עם curl

```bash
curl -X PATCH \
  -H "Authorization: Bearer YOUR_ID_TOKEN" \
  -H "Content-Type: application/json" \
  "https://firestore.googleapis.com/v1/projects/roomies-hub/databases/(default)/documents/debts/DEBT_ID?updateMask.fieldPaths=status&updateMask.fieldPaths=closed_at&updateMask.fieldPaths=closed_by" \
  -d '{
    "fields": {
      "status": { "stringValue": "closed" },
      "closed_at": { "timestampValue": "2024-01-01T00:00:00.000Z" },
      "closed_by": { "stringValue": "UID_OF_USER" }
    }
  }'
```

### 3. בדיקה מהאפליקציה

```typescript
import { firestoreService } from './src/services/firestore-service';

try {
  await firestoreService.closeDebt('debt_id_here');
  console.log('✅ החוב נסגר בהצלחה');
} catch (error) {
  console.error('❌ שגיאה בסגירת החוב:', error);
}
```

## מה לחפש בלוגים

### לוגים של הצלחה:
```
🔒 Closing debt (ensured apartment context): { debtId: "...", closedBy: "...", closedAt: "...", aptId: "..." }
🔍 PATCH request details: { url: "...", updateMaskFields: [...], body: "..." }
✅ Debt closed successfully: ...
```

### לוגים של שגיאה:
```
❌ Update document failed: { status: 403, error: "...", url: "...", data: {...}, updateMaskFields: [...] }
❌ Failed to close debt: ...
```

## אם עדיין נכשל

### 1. בדוק את הלוגים
- האם `aptId` תואם ל-`current_apartment_id` של המשתמש?
- האם ה-URL מכיל את ה-`updateMask` הנכון?
- האם ה-body מכיל `timestampValue` עבור `closed_at`?

### 2. בדוק את החוקים
- האם החוקים דורשים `resource.data.apartment_id == currentUserApartmentId()`?
- האם החוקים דורשים `request.resource.data.closed_at is timestamp`?

### 3. בדוק את ה-token
- האם ה-ID token תקין?
- האם המשתמש מחובר לדירה הנכונה?

## סיכום התיקונים

1. **תיקון `toFirestoreFormat`** - זיהוי אוטומטי של שדות זמן
2. **תיקון `closeDebt`** - וידוא apartment context
3. **הוספת לוגים** - דיבוג מפורט
4. **שימוש ב-`Date`** - במקום מחרוזות ISO

עכשיו סגירת החוב אמורה לעבוד ללא שגיאות הרשאה! 🎉
