# Debug PERMISSION_DENIED Error

## Problem Fixed
✅ **Removed old `settleCalculatedDebt` function** that was touching `debts` collection
✅ **Added comprehensive debug logging** to track which function is called
✅ **Enabled Firestore debug logging** to see Rules violations

## What to Check Now

### 1. Verify the Simple Function is Called
When you click "סגור חוב", look for these logs in console:

```
🔍 [settleCalculatedDebt] DEBUG - About to call settleOutsideApp: {...}
🔍 [settleOutsideApp] DEBUG - This is the SIMPLE function being called: {...}
🔍 [DEBUG] NO DEBTS COLLECTION TOUCHED - Only balances and actions
```

**If you DON'T see these logs**, the old function is still being called somewhere.

### 2. Check Firestore Rules Requirements

The simple function will work ONLY if these conditions are met:

#### A. User is member of the apartment
- Document must exist: `apartmentMembers/{apartmentId}_{userId}`
- Role can be `member` or `admin`

#### B. User's current apartment matches
- Document: `users/{userId}`
- Field: `current_apartment_id` must equal the `apartmentId` being used

#### C. Only allowed operations
- **balances**: Only `balance` field with `increment()` transform
- **actions**: Only `type: 'debt_closed'` with required fields

### 3. Debug Steps

#### Step 1: Check Console Logs
```bash
# Look for these specific logs:
🔍 [settleCalculatedDebt] DEBUG
🔍 [settleOutsideApp] DEBUG  
🔍 [DEBUG] NO DEBTS COLLECTION TOUCHED
```

#### Step 2: Check Firestore Rules
If you see `PERMISSION_DENIED`, check:

1. **User membership**: Does `apartmentMembers/{apartmentId}_{userId}` exist?
2. **Current apartment**: Does `users/{userId}.current_apartment_id` match?
3. **Collection writes**: Are there any writes to `debts` collection?

#### Step 3: Enable Firestore Debug
The app now has Firestore debug logging enabled. Look for:
```
🔧 Firestore debug logging enabled
```

This will show detailed Rules evaluation in console.

### 4. Expected Behavior

When working correctly, you should see:

```
🔍 [settleCalculatedDebt] DEBUG - About to call settleOutsideApp: {
  actor: "user123",
  apartmentId: "apt456", 
  fromUserId: "user1",
  toUserId: "user2",
  amount: 50
}

🔍 [settleOutsideApp] DEBUG - This is the SIMPLE function being called: {...}

🔄 Transaction started, processing simple settlement...
🔍 [DEBUG] Document references: {
  fromRef: "balances/apt456/users/user1",
  toRef: "balances/apt456/users/user2", 
  actionRef: "actions/auto-generated-id"
}

🔍 [DEBUG] NO DEBTS COLLECTION TOUCHED - Only balances and actions
🎉 Simple debt settlement completed successfully!
```

### 5. If Still Getting PERMISSION_DENIED

Check these in Firebase Console:

1. **apartmentMembers collection**:
   - Document: `{apartmentId}_{userId}`
   - Must exist with any role

2. **users collection**:
   - Document: `{userId}`
   - Field: `current_apartment_id` = `{apartmentId}`

3. **Firestore Rules**:
   - `balances` rules allow `increment()` on `balance` field
   - `actions` rules allow `create` with `type: 'debt_closed'`

### 6. Quick Fix Commands

If you need to fix user data:

```javascript
// Fix current apartment ID
await updateDoc(doc(db, 'users', userId), {
  current_apartment_id: apartmentId
});

// Create apartment membership
await setDoc(doc(db, 'apartmentMembers', `${apartmentId}_${userId}`), {
  role: 'member',
  joined_at: serverTimestamp()
});
```

## Summary

The main issue was the old `settleCalculatedDebt` function that touched `debts` collection. This has been removed. Now only the simple `settleOutsideApp` function is used, which only touches `balances` and `actions` collections.

If you still get `PERMISSION_DENIED`, it's likely a user membership or apartment ID mismatch issue.
