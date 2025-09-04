# תיקונים קריטיים לבעיות 403/Transaction

## הבעיות שתוקנו

### 1. **פורמט resource name שגוי ב-transaction commit** ✅
**הבעיה:** שימוש ב-URL מלא במקום resource name
```typescript
// לפני התיקון (שגוי)
name: `${FIRESTORE_BASE_URL}/expenses/${expenseId}`
// זה יוצר: https://firestore.googleapis.com/v1/projects/.../documents/expenses/123

// אחרי התיקון (נכון)
const resourcePrefix = FIRESTORE_BASE_URL.replace(/^https?:\/\/[^/]+\/v1\//, '');
const resourceName = `${resourcePrefix}/expenses/${expenseId}`;
// זה יוצר: projects/roomies-hub/databases/(default)/documents/expenses/123
```

### 2. **חוסר updateMask ב-transaction commit** ✅
**הבעיה:** עדכון ללא updateMask יכול להחליף את המסמך כולו
```typescript
// לפני התיקון (בעייתי)
writes: [{
  update: {
    name: resourceName,
    fields: updateFields,
  }
}]

// אחרי התיקון (נכון)
writes: [{
  update: {
    name: resourceName,
    fields: updateFields,
  },
  updateMask: {
    fieldPaths: ['amount', 'participants', 'category', 'title', 'note', 'updated_at', 'lastModifiedBy']
  },
  currentDocument: { exists: true }
}]
```

### 3. **atob לא עובד ב-Node.js/React Native** ✅
**הבעיה:** `atob` לא קיים בסביבות שאינן דפדפן
```typescript
// לפני התיקון (בעייתי)
const payload = JSON.parse(atob(tokenParts[1]));

// אחרי התיקון (בטוח)
function safeBase64Decode(b64: string): string {
  try {
    if (typeof atob === 'function') {
      return atob(b64);
    }
  } catch {}
  try {
    return Buffer.from(b64, 'base64').toString('utf8');
  } catch (e) {
    return '';
  }
}

const payload = JSON.parse(safeBase64Decode(tokenParts[1]));
```

### 4. **לוגים לא מפורטים מספיק** ✅
**הבעיה:** לא רואים את השגיאה המדויקת מהשרת
```typescript
// לפני התיקון
if (!expenseUpdateRes.ok) {
  throw new Error(`UPDATE_EXPENSE_${expenseUpdateRes.status}: Failed to update expense`);
}

// אחרי התיקון
if (!expenseUpdateRes.ok) {
  const errorText = await expenseUpdateRes.text().catch(() => '');
  console.error('❌ Transaction commit failed:', {
    status: expenseUpdateRes.status,
    error: errorText,
    resourceName,
    fieldPaths,
    transactionId
  });
  throw new Error(`UPDATE_EXPENSE_${expenseUpdateRes.status}: ${errorText}`);
}
```

## איך לבדוק שהתיקונים עובדים

### 1. בדוק את הלוגים
חפש בקונסול:
```
🔍 Transaction commit details: {
  resourceName: "projects/roomies-hub/databases/(default)/documents/expenses/123",
  fieldPaths: ["amount", "updated_at", "lastModifiedBy"],
  updateFields: ["amount", "updated_at", "lastModifiedBy"],
  transactionId: "abc123..."
}
```

### 2. בדוק שאין שגיאות 403
אם עדיין יש 403, הלוגים יראו:
```
❌ Transaction commit failed: {
  status: 403,
  error: "Missing or insufficient permissions...",
  resourceName: "...",
  fieldPaths: [...],
  transactionId: "..."
}
```

### 3. בדוק את ה-token
חפש בקונסול:
```
🔍 Token details: {
  aud: "roomies-hub",
  email: "user@example.com",
  exp: "2024-01-01T12:00:00.000Z",
  firebase: { project_id: "roomies-hub" },
  projectId: "roomies-hub"
}
```

## אם עדיין נכשל

### 1. בדוק את ה-resource name
הדפס את `resourceName` ובדוק שהוא תואם למסמך ב-Firestore Console:
- צריך להיות: `projects/roomies-hub/databases/(default)/documents/expenses/123`
- לא צריך להיות: `https://firestore.googleapis.com/v1/projects/...`

### 2. בדוק את ה-token
ודא שה-`projectId` בלוגים תואם לפרויקט שלך (`roomies-hub`)

### 3. בדוק את החוקים
ודא שהחוקים מאפשרים עדכון של השדות ב-`fieldPaths`

### 4. בדוק את ה-transaction
ודא שה-`transactionId` תקין ולא פג תוקף

## סיכום

התיקונים האלה פותרים את הבעיות הנפוצות ביותר שגורמות ל-403 ב-transaction commit:

1. **פורמט resource name נכון** - מונע 400/403
2. **updateMask נכון** - מונע החלפת מסמך לא רצויה
3. **decoder בטוח** - מונע שגיאות בסביבות שונות
4. **לוגים מפורטים** - מאפשר דיבוג מהיר

עכשיו transaction commit אמור לעבוד ללא שגיאות! 🎉
