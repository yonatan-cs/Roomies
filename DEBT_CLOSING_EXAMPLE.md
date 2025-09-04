# דוגמה לשימוש בפונקציית סגירת חוב החדשה

## הבעיה שנפתרה

הבעיה הייתה שסגירת חוב לא עבדה בגלל:
1. הפונקציה `updateDocument` לא תמכה ב-`updateMask`
2. חוקי Firestore דרשו `updateMask` כדי לאפשר עדכון רק של שדות מסוימים
3. הקוד לא השתמש ב-`updateMask` ולכן נדחה עם שגיאת "Missing or insufficient permissions"

## הפתרון

### 1. תיקון פונקציית `updateDocument`

```typescript
// לפני התיקון
async updateDocument(collectionName: string, documentId: string, data: any): Promise<any>

// אחרי התיקון
async updateDocument(collectionName: string, documentId: string, data: any, updateMaskFields?: string[]): Promise<any>
```

### 2. הוספת פונקציות לסגירת חוב

```typescript
// פונקציה פשוטה לסגירת חוב
async closeDebt(debtId: string): Promise<void>

// פונקציה מתקדמת עם פרמטרים נוספים
async closeDebtWithParams(debtId: string, closedBy?: string): Promise<void>
```

### 3. שימוש ב-`updateMask`

הפונקציות החדשות משתמשות ב-`updateMask` כדי לאפשר עדכון רק של השדות המותרים:
- `status`
- `closed_at` 
- `closed_by`

## דוגמאות שימוש

### דוגמה 1: סגירת חוב פשוטה

```typescript
import { firestoreService } from './src/services/firestore-service';

// סגירת חוב עם המשתמש הנוכחי
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

// סגירת חוב דרך ה-store
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

// סגירת חוב עם משתמש ספציפי
try {
  await firestoreService.closeDebtWithParams('debt_id_here', 'user_id_here');
  console.log('✅ החוב נסגר בהצלחה');
} catch (error) {
  console.error('❌ שגיאה בסגירת החוב:', error);
}
```

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

## סיכום

הפתרון פותר את הבעיה על ידי:
1. הוספת תמיכה ב-`updateMask` לפונקציית `updateDocument`
2. יצירת פונקציות ייעודיות לסגירת חוב שמשתמשות ב-`updateMask`
3. הבטחה שהעדכון כולל רק את השדות המותרים לפי חוקי Firestore
4. הוספת לוגים מפורטים לדיבוג

עכשיו סגירת חוב אמורה לעבוד ללא שגיאות הרשאה!
