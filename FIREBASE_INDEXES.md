# Firebase Indexes Required for Debt System

## Collection: `debts`
**Required for:** `getDebts()` function with `orderBy('created_at', 'desc')`

### Composite Index
- **Collection ID:** `debts`
- **Fields:**
  1. `apartment_id` (Ascending)
  2. `created_at` (Descending)
- **Scope:** Collection
- **Query Pattern:** `where('apartment_id', '==', aptId).orderBy('created_at', 'desc')`

---

## Collection: `actions`
**Required for:** `getActions()` function with `orderBy('created_at', 'desc')`

### Composite Index
- **Collection ID:** `actions`
- **Fields:**
  1. `apartment_id` (Ascending)
  2. `created_at` (Descending)
- **Scope:** Collection
- **Query Pattern:** `where('apartment_id', '==', aptId).orderBy('created_at', 'desc')`

---

## How to Create Indexes

### Option 1: Firebase Console (Recommended)
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Go to **Firestore Database** → **Indexes** tab
4. Click **Create Index**
5. Fill in the details above
6. Click **Create**

### Option 2: Wait for Auto-Creation
Firebase will automatically suggest creating these indexes when you run the queries. Look for error messages like:
```
❌ INDEX_ERROR: Debts query requires composite index:
   Collection: debts
   Fields: apartment_id (Ascending), created_at (Descending)
```

### Option 3: Firebase CLI
```bash
# Install Firebase CLI if you haven't
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firebase in your project (if not already done)
firebase init firestore

# Deploy indexes
firebase deploy --only firestore:indexes
```

---

## Index Status
- ✅ **Created:** Index exists and queries will work
- ⏳ **Building:** Index is being created (may take a few minutes)
- ❌ **Missing:** Index doesn't exist, queries will fail with 400 error

---

## Troubleshooting

### Error: `GET_DEBTS_400` or `GET_ACTIONS_400`
This usually means the composite index is missing. Check the console for detailed error messages.

### Error: `INDEX_REQUIRED`
The code will throw this error when indexes are missing. Create the required indexes above.

### Performance
- Indexes may take 1-5 minutes to build
- Large collections may take longer
- Monitor index status in Firebase Console
