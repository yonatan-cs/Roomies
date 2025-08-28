# 🔧 Apartment Join Debug Guide

## הבעיה
כשמנסים להיכנס מחשבון אחר לדירה קיימת, מקבלים `PERMISSION_DENIED` בשלב יצירת החברות ב-`apartmentMembers`.

## הפתרון
החלפנו את הפונקציה `joinApartmentByInviteCode` עם יישום מדויק של REST API calls:

### 1. קריאת מסמך ההזמנה
```typescript
GET /apartmentInvites/{inviteCode}
Authorization: Bearer {idToken}
```

### 2. יצירת חברות
```typescript
POST /apartmentMembers?documentId={apartmentId}_{userId}
Authorization: Bearer {idToken}
Body: {
  fields: {
    apartment_id: { stringValue: apartmentId },
    user_id: { stringValue: userId },
    role: { stringValue: 'member' },
    created_at: { timestampValue: timestamp }
  }
}
```

### 3. עדכון פרטי המשתמש
```typescript
PATCH /users/{userId}?updateMask.fieldPaths=current_apartment_id
Authorization: Bearer {idToken}
Body: {
  fields: {
    current_apartment_id: { stringValue: apartmentId }
  }
}
```

## 🔍 בדיקות מהירות

### בדיקה 1: קריאת הזמנה
```bash
curl -i -H "Authorization: Bearer <ID_TOKEN>" \
"https://firestore.googleapis.com/v1/projects/roomies-hub/databases/(default)/documents/apartmentInvites/PWU0VU"
```

### בדיקה 2: יצירת חברות
```bash
curl -i -X POST -H "Authorization: Bearer <ID_TOKEN>" \
-H "Content-Type: application/json" \
-d '{
  "fields": {
    "apartment_id": {"stringValue":"<APARTMENT_ID>"},
    "user_id": {"stringValue":"<USER_ID>"},
    "role": {"stringValue":"member"},
    "created_at": {"timestampValue":"2025-01-28T10:00:00.000Z"}
  }
}' \
"https://firestore.googleapis.com/v1/projects/roomies-hub/databases/(default)/documents/apartmentMembers?documentId=<APARTMENT_ID>_<USER_ID>"
```

### בדיקה 3: עדכון משתמש
```bash
curl -i -X PATCH -H "Authorization: Bearer <ID_TOKEN>" \
-H "Content-Type: application/json" \
-d '{"fields":{"current_apartment_id":{"stringValue":"<APARTMENT_ID>"}}}' \
"https://firestore.googleapis.com/v1/projects/roomies-hub/databases/(default)/documents/users/<USER_ID>?updateMask.fieldPaths=current_apartment_id"
```

## 🧪 סקריפט בדיקה אוטומטי
```bash
node3 debug-join-test.js <INVITE_CODE> <ID_TOKEN>
```

## 📋 לוגים חשובים לבדיקה

באפליקציה, חפש את הלוגים האלה:

```
🔗 Joining apartment with code: PWU0VU
👤 Current user ID: abc123...
🔍 Fetching invite document: https://...
📊 Invite response: 200 (OK)
🤝 Creating membership document:
🆔 Membership ID: apartment123_abc123
📊 Membership creation response: 200 (OK)
👤 Setting current apartment for user: abc123
📊 Set current apartment response: 200 (OK)
✅ Successfully joined apartment
```

## ⚠️ מוקשים נפוצים

1. **documentId לא תואם**: חייב להיות `{apartmentId}_{userId}` עם `_` (לא `-`)
2. **שיטה לא נכונה**: חייב להיות `POST` עם `?documentId=`, לא `PATCH`/`PUT`
3. **user_id לא תואם**: חייב להיות זהה ל-`request.auth.uid`
4. **role לא נכון**: חייב להיות `'member'` בדיוק
5. **ID token חסר/פג**: ללא `Authorization: Bearer` נכון

## 🎯 תוצאה צפויה
אחרי התיקון, המשתמש השני אמור להצליח להיכנס לדירה בלי שגיאות הרשאות.
