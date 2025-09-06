# אינדקסים נדרשים ל-Firestore

## אינדקס לחובות פתוחים

כדי שהשאילתה על חובות פתוחים תרוץ מהר וללא שגיאת "needs index", צריך ליצור אינדקס:

### Collection: `debts`
- **Fields:** `apartment_id` (Ascending), `status` (Ascending)
- **Purpose:** שאילתה לחובות פתוחים של דירה ספציפית

### איך ליצור את האינדקס

1. **דרך Firebase Console:**
   - לך ל-Firebase Console
   - בחר את הפרויקט
   - לך ל-Firestore Database
   - לך לטאב "Indexes"
   - לחץ "Create Index"
   - בחר collection: `debts`
   - הוסף fields: `apartment_id` (Ascending), `status` (Ascending)
   - לחץ "Create"

2. **דרך Firebase CLI:**
   ```bash
   firebase firestore:indexes
   ```
   
   הוסף לקובץ `firestore.indexes.json`:
   ```json
   {
     "indexes": [
       {
         "collectionGroup": "debts",
         "queryScope": "COLLECTION",
         "fields": [
           {
             "fieldPath": "apartment_id",
             "order": "ASCENDING"
           },
           {
             "fieldPath": "status", 
             "order": "ASCENDING"
           }
         ]
       }
     ]
   }
   ```

### אינדקסים נוספים (אופציונלי)

אם אתה רוצה להוסיף `orderBy` על `created_at`:

```
Collection: debts
Fields: apartment_id (Ascending), status (Ascending), created_at (Descending)
```

### בדיקה שהאינדקס עובד

אחרי יצירת האינדקס, הפעל את האפליקציה ונסה לסגור חוב. אם הכל עובד בלי שגיאות, האינדקס נוצר בהצלחה.

### הערה חשובה

בלי האינדקס, השאילתה על חובות פתוחים תכשל עם שגיאה:
```
The query requires an index. You can create it here: [URL]
```

אז חשוב ליצור את האינדקס לפני השימוש בפתרון החדש.
