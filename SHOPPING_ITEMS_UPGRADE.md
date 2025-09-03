# Shopping Items System Upgrade Guide

## Overview
This guide explains how to upgrade your existing shopping items system to support the new fields: `priority`, `quantity`, and `notes`.

## What's New

### New Fields Added
- **`priority`**: `'low' | 'normal' | 'high'` - Priority level for shopping items
- **`quantity`**: `number` - Quantity of items to buy
- **`notes`**: `string` - Additional notes about the item
- **`last_updated`**: `timestamp` - When the item was last modified

### New Features
- Priority-based filtering and sorting
- Quantity display for items
- Notes support
- Enhanced UI with priority indicators

## Step-by-Step Deployment

### 1. Deploy New Firestore Indexes

First, deploy the updated indexes to Firestore:

```bash
# If you have Firebase CLI installed
firebase deploy --only firestore:indexes

# Or manually create the index in Firebase Console:
# Collection: shoppingItems
# Fields:
#   - apartment_id (Ascending)
#   - purchased (Ascending) 
#   - priority (Descending)
#   - created_at (Descending)
```

### 2. Update Existing Shopping Items (Optional)

If you have existing shopping items, you can update them with default values:

```bash
# Install dependencies
npm install firebase

# Run the update script
node scripts/update-shopping-items.js
```

**Note**: This script will:
- Set all existing items to `priority: 'normal'`
- Set `quantity: 1` for items without quantity
- Set `notes: ''` for items without notes
- Add `last_updated` timestamp

### 3. Test the New System

1. **Add new items** with different priorities, quantities, and notes
2. **Test filtering** by priority (low, normal, high)
3. **Verify sorting** - high priority items should appear first
4. **Check display** - priority badges, quantity indicators, and notes should be visible

## Database Schema Changes

### Before (Old Schema)
```json
{
  "apartment_id": "string",
  "name": "string", 
  "added_by_user_id": "string",
  "purchased": "boolean",
  "created_at": "timestamp"
}
```

### After (New Schema)
```json
{
  "apartment_id": "string",
  "name": "string",
  "added_by_user_id": "string",
  "priority": "string", // "low", "normal", "high"
  "quantity": "integer", // Default: 1
  "notes": "string", // Default: ""
  "purchased": "boolean",
  "created_at": "timestamp",
  "last_updated": "timestamp"
}
```

## API Changes

### Updated Functions

#### `addShoppingItem`
```typescript
// Old
addShoppingItem(name: string, userId: string): Promise<void>

// New  
addShoppingItem(
  name: string, 
  userId: string, 
  priority?: 'low' | 'normal' | 'high',
  quantity?: number,
  notes?: string
): Promise<void>
```

#### New Function: `updateShoppingItem`
```typescript
updateShoppingItem(
  itemId: string, 
  updates: {
    priority?: 'low' | 'normal' | 'high';
    quantity?: number;
    notes?: string;
    name?: string;
  }
): Promise<void>
```

## UI Changes

### New Components Added
- **Priority Filter**: Buttons to filter by priority level
- **Priority Badges**: Visual indicators for item priority
- **Quantity Display**: Shows quantity when > 1
- **Notes Display**: Shows notes when available
- **Enhanced Modal**: Add item form with all new fields

### Priority Colors
- **High Priority**: Red (#ef4444) with up arrow
- **Normal Priority**: Blue (#3b82f6) with dash
- **Low Priority**: Green (#10b981) with down arrow

## Migration Checklist

- [ ] Deploy new Firestore indexes
- [ ] Update existing shopping items (optional)
- [ ] Test new item creation
- [ ] Test priority filtering
- [ ] Test priority sorting
- [ ] Verify UI displays correctly
- [ ] Test on different devices/screens

## Troubleshooting

### Common Issues

#### 1. Index Build Errors
**Problem**: Firestore queries fail with index errors
**Solution**: Wait for indexes to finish building (can take several minutes)

#### 2. Missing Priority Field
**Problem**: Old items don't show priority
**Solution**: Run the update script or manually update items

#### 3. Filter Not Working
**Problem**: Priority filter doesn't change the list
**Solution**: Check that items have the `priority` field set

### Error Messages

```
❌ INDEX_ERROR: Shopping items query requires composite index:
   Collection: shoppingItems
   Fields: apartment_id (Ascending), purchased (Ascending), priority (Descending), created_at (Descending)
```

**Solution**: Create the required index in Firebase Console

## Performance Considerations

### Index Impact
- New composite index may take time to build
- Queries will be slightly slower initially
- Performance improves after index is built

### Data Size
- New fields add minimal storage overhead
- `priority` and `notes` are strings (small)
- `quantity` is integer (minimal)
- `last_updated` is timestamp (minimal)

## Rollback Plan

If you need to rollback:

1. **Revert code changes** to previous version
2. **Keep Firestore indexes** (they won't hurt)
3. **Old items will continue working** (missing fields will use defaults)

## Support

For issues or questions:
1. Check this guide first
2. Review Firebase Console logs
3. Check browser console for errors
4. Verify Firestore rules allow the new fields

## Future Enhancements

Potential improvements for next versions:
- Priority-based notifications
- Bulk priority updates
- Priority templates
- Advanced filtering options
- Priority analytics
