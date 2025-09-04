# Firebase Web SDK Migration

## Problem Solved

The `TRANSACTION_BEGIN_FAILED_403` error was occurring because Firebase REST API's `beginTransaction` endpoint requires IAM permissions that regular Firebase ID tokens don't have. This is a fundamental limitation of using REST API for transactions from the client side.

## Solution: Migration to Firebase Web SDK

We've migrated the transaction operations from REST API to Firebase Web SDK, which handles authentication properly and doesn't require IAM permissions for client-side operations.

## Files Changed

### New Files Created

1. **`src/services/firebase-sdk.ts`**
   - Firebase Web SDK configuration
   - Initializes Firestore and Auth instances
   - Handles emulator connections for development

2. **`src/services/firestore-sdk-service.ts`**
   - New service class for SDK-based operations
   - Implements `settleCalculatedDebt` using `runTransaction`
   - Implements `updateExpense` using `runTransaction`
   - Provides real-time subscription capabilities

### Files Modified

1. **`src/state/store.ts`**
   - Updated `settleCalculatedDebt` to use SDK service
   - Updated `updateExpense` to use SDK service
   - Added import for new SDK service

2. **`package.json`**
   - Added Firebase Web SDK dependency

## Key Benefits

### ✅ Fixed Issues
- **No more 403 errors** - SDK handles authentication properly
- **Proper transactions** - Uses Firebase's native transaction system
- **Server timestamps** - Real `serverTimestamp()` instead of REST workarounds
- **Atomic operations** - True atomicity with `runTransaction`

### ✅ Improved Features
- **Better error handling** - SDK provides more detailed error information
- **Real-time subscriptions** - Can use `onSnapshot` for live updates
- **Type safety** - Better TypeScript support with SDK
- **Performance** - SDK is optimized for client-side operations

## Technical Details

### Before (REST API - Causing 403)
```typescript
// This was failing with 403 errors
const beginResponse = await fetch(`${FIRESTORE_BASE_URL}:beginTransaction`, {
  method: 'POST',
  headers: authHeaders(idToken), // ID token insufficient for IAM
});
```

### After (Firebase Web SDK - Working)
```typescript
// This works perfectly
await runTransaction(db, async (transaction) => {
  transaction.set(debtRef, {
    amount: amount,
    created_at: serverTimestamp(), // Real server timestamp
  });
  
  transaction.update(balanceRef, {
    balance: increment(amount) // Real increment transform
  });
});
```

## Usage

The API remains the same for the application code:

```typescript
// Debt settlement (now uses SDK internally)
await settleCalculatedDebt(fromUserId, toUserId, amount, description);

// Expense update (now uses SDK internally)  
await updateExpense(expenseId, { amount: 100, title: 'New title' });
```

## Migration Notes

- **Backward compatible** - No changes needed in UI components
- **REST API still used** - For non-transaction operations (queries, simple CRUD)
- **Hybrid approach** - Best of both worlds (REST for simple ops, SDK for transactions)
- **No data migration** - All existing data remains unchanged

## Testing

The migration has been tested and verified to:
- ✅ Eliminate 403 errors on transaction begin
- ✅ Maintain atomicity of operations
- ✅ Preserve all existing functionality
- ✅ Improve error handling and logging

## Future Considerations

- Consider migrating more operations to SDK for consistency
- Real-time subscriptions can replace polling for better performance
- SDK provides better offline support for mobile apps
