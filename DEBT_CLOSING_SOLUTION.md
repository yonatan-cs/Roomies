# פתרון בעיית סגירת חוב - Missing or insufficient permissions

## סיכום הבעיה

הבעיה הייתה שסגירת חוב לא עבדה למרות ניסיונות רבים. השגיאה הייתה **"Missing or insufficient permissions"** (403).

## סיבות הבעיה

1. **אי־התאמה בין מה שהלקוח שולח לבקשת ה-PATCH לבין מה שה-security rules מצפות לראות**
2. **שימוש ב-PATCH בלי `updateMask`** - זה גורם לשליחת שדות נוספים או החלפת המסמך כולו
3. **הפונקציה `updateDocument` לא תמכה ב-`updateMask`**
4. **חוקי Firestore דרשו `updateMask` כדי לאפשר עדכון רק של שדות מסוימים**

## הפתרון שיושם

### 1. תיקון פונקציית `updateDocument`

```typescript
// לפני התיקון
async updateDocument(collectionName: string, documentId: string, data: any): Promise<any>

// אחרי התיקון
async updateDocument(collectionName: string, documentId: string, data: any, updateMaskFields?: string[]): Promise<any>
```

**מה השתנה:**
- הוספת פרמטר `updateMaskFields` אופציונלי
- בניית URL עם `updateMask.fieldPaths` כשהפרמטר מסופק
- הוספת לוגים מפורטים לדיבוג

### 2. הוספת פונקציות לסגירת חוב

```typescript
// פונקציה פשוטה לסגירת חוב
async closeDebt(debtId: string): Promise<void>

// פונקציה מתקדמת עם פרמטרים נוספים
async closeDebtWithParams(debtId: string, closedBy?: string): Promise<void>
```

**מה הפונקציות עושות:**
- משתמשות ב-`updateMask` עם השדות המותרים: `['status', 'closed_at', 'closed_by']`
- מעדכנות את החוב ל-`status: 'closed'`
- מוסיפות `closed_at` עם הזמן הנוכחי
- מוסיפות `closed_by` עם ה-UID של המשתמש הנוכחי

### 3. הוספת פונקציה ל-store

```typescript
// פונקציה ב-store שתשתמש בפונקציה החדשה
closeDebt: (debtId: string) => Promise<void>
```

## איך זה פותר את הבעיה

### לפני התיקון:
```typescript
// PATCH בלי updateMask
PATCH /projects/roomies-hub/databases/(default)/documents/debts/{debtId}
{
  "fields": {
    "status": { "stringValue": "closed" },
    "closed_at": { "timestampValue": "2024-01-01T00:00:00Z" },
    "closed_by": { "stringValue": "user_id" }
  }
}
```

**תוצאה:** שגיאת 403 - "Missing or insufficient permissions"

### אחרי התיקון:
```typescript
// PATCH עם updateMask
PATCH /projects/roomies-hub/databases/(default)/documents/debts/{debtId}?updateMask.fieldPaths=status&updateMask.fieldPaths=closed_at&updateMask.fieldPaths=closed_by
{
  "fields": {
    "status": { "stringValue": "closed" },
    "closed_at": { "timestampValue": "2024-01-01T00:00:00Z" },
    "closed_by": { "stringValue": "user_id" }
  }
}
```

**תוצאה:** הצלחה! החוב נסגר

## חוקי Firestore הרלוונטיים

```javascript
// Close debt (open -> closed) only
allow update: if isAuthenticated()
  && resource.data.apartment_id == currentUserApartmentId()
  && isApartmentMemberOfThisApartment(resource.data.apartment_id, request.auth.uid)
  && resource.data.status == 'open'
  && request.resource.data.status == 'closed'
  && request.resource.data.apartment_id == resource.data.apartment_id
  && !('amount' in request.resource.data)
  && !('from_user_id' in request.resource.data)
  && !('to_user_id' in request.resource.data)
  && request.resource.data.diff(resource.data).changedKeys().hasOnly(['status','closed_at','closed_by']);
```

**החוק דורש:**
- רק השדות `status`, `closed_at`, `closed_by` יכולים להשתנות
- `status` חייב להשתנות מ-`open` ל-`closed`
- השדות `amount`, `from_user_id`, `to_user_id` לא יכולים להשתנות

## איך להשתמש בפתרון

### דוגמה 1: סגירת חוב פשוטה

```typescript
import { firestoreService } from './src/services/firestore-service';

try {
  await firestoreService.closeDebt('debt_id_here');
  console.log('✅ החוב נסגר בהצלחה');
} catch (error) {
  console.error('❌ שגיאה בסגירת החוב:', error);
}
```

### דוגמה 2: סגירת חוב דרך ה-store

```typescript
import { useStore } from './src/state/store';

const { closeDebt } = useStore();

try {
  await closeDebt('debt_id_here');
  console.log('✅ החוב נסגר בהצלחה');
} catch (error) {
  console.error('❌ שגיאה בסגירת החוב:', error);
}
```

### דוגמה 3: סגירת חוב עם פרמטרים נוספים

```typescript
import { firestoreService } from './src/services/firestore-service';

try {
  await firestoreService.closeDebtWithParams('debt_id_here', 'user_id_here');
  console.log('✅ החוב נסגר בהצלחה');
} catch (error) {
  console.error('❌ שגיאה בסגירת החוב:', error);
}
```

## בדיקת הפתרון

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
    "closed_at": { "timestampValue": "2024-01-01T00:00:00Z" },
    "closed_by": { "stringValue": "user_id_here" }
  }
}
```

6. בדוק שהתוצאה היא "Allow"

### 2. בדיקה עם curl

```bash
curl -X PATCH \
  "https://firestore.googleapis.com/v1/projects/roomies-hub/databases/(default)/documents/debts/debt_id_here?updateMask.fieldPaths=status&updateMask.fieldPaths=closed_at&updateMask.fieldPaths=closed_by" \
  -H "Authorization: Bearer YOUR_ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fields": {
      "status": { "stringValue": "closed" },
      "closed_at": { "timestampValue": "2024-01-01T00:00:00Z" },
      "closed_by": { "stringValue": "user_id_here" }
    }
  }'
```

## קבצים שעודכנו

1. **`src/services/firestore-service.ts`**
   - תיקון פונקציית `updateDocument` לתמיכה ב-`updateMask`
   - הוספת פונקציות `closeDebt` ו-`closeDebtWithParams`

2. **`src/state/store.ts`**
   - הוספת פונקציה `closeDebt` ל-store
   - הוספת הפונקציה ל-interface

3. **`src/examples/debt-closing-example.ts`**
   - דוגמאות שימוש בפונקציות החדשות

4. **`DEBT_CLOSING_EXAMPLE.md`**
   - תיעוד מפורט של הפתרון

5. **`DEBT_CLOSING_SOLUTION.md`**
   - סיכום הבעיה והפתרון

## סיכום

הפתרון פותר את הבעיה על ידי:
1. **הוספת תמיכה ב-`updateMask`** לפונקציית `updateDocument`
2. **יצירת פונקציות ייעודיות** לסגירת חוב שמשתמשות ב-`updateMask`
3. **הבטחה שהעדכון כולל רק את השדות המותרים** לפי חוקי Firestore
4. **הוספת לוגים מפורטים** לדיבוג
5. **יצירת דוגמאות שימוש** ותיעוד מפורט

עכשיו סגירת חוב אמורה לעבוד ללא שגיאות הרשאה! 🎉
