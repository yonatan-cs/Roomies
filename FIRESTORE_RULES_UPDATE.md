# עדכון כללי Firestore

## הוסף את הכללים הבאים לקובץ הכללים שלך ב-Firebase Console:

```javascript
// Collection: apartmentInvites
// Public lookup table for apartment invite codes
// Document ID is the invite code itself for fast lookup
match /apartmentInvites/{inviteCode} {
  // Anyone authenticated can read invite records to find apartments
  allow read: if isAuthenticated();
  // Only authenticated users can create invite records (when creating apartments)
  allow create: if isAuthenticated();
  // No updates or deletes allowed - invite codes are immutable
  allow update, delete: if false;
}
```

## הוסף את הכלל הזה בסוף הקובץ, לפני הסגירה האחרונה של `match /databases/{database}/documents`

הכללים המלאים צריכים להיראות כך:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper functions...
    function isAuthenticated() {
      return request.auth != null;
    }

    // ... שאר הפונקציות שלך ...

    // Collection: users
    match /users/{userId} {
      // הכללים הקיימים שלך...
    }

    // Collection: apartments  
    match /apartments/{apartmentId} {
      // הכללים הקיימים שלך...
    }

    // Collection: apartmentMembers
    match /apartmentMembers/{apartmentMemberId} {
      // הכללים הקיימים שלך...
    }

    // NEW: Collection: apartmentInvites
    // Public lookup table for apartment invite codes
    match /apartmentInvites/{inviteCode} {
      // Anyone authenticated can read invite records to find apartments
      allow read: if isAuthenticated();
      // Only authenticated users can create invite records (when creating apartments)
      allow create: if isAuthenticated();
      // No updates or deletes allowed - invite codes are immutable
      allow update, delete: if false;
    }

    // שאר האוספים שלך (expenses, debtSettlements, וכו')...
  }
}
```

## מה זה פותר:

1. **בעיית ההרשאות**: עכשיו משתמשים יכולים לחפש דירות לפי קוד הזמנה ללא צורך להיות חברים קודם
2. **ביצועים**: חיפוש מהיר באמצעות document ID במקום סריקת כל האוסף
3. **אבטחה**: רק משתמשים מאומתים יכולים לגשת לנתונים

## איך להוסיף:

1. היכנס ל-Firebase Console
2. עבור ל-Firestore Database
3. לחץ על "Rules"
4. הוסף את הכלל החדש לקובץ הכללים
5. לחץ "Publish"

לאחר העדכון, נסה שוב ליצור דירה חדשה ולהצטרף אליה עם משתמש אחר.
