# Cleaning Tasks Migration Guide

This guide explains how to migrate existing cleaning tasks to support the new default tasks system with proper internationalization.

## Problem

Previously, default cleaning tasks were stored in Firestore with translation keys like `cleaning.defaultTasks.kitchen` as their titles, but the UI was displaying these raw keys instead of the translated text.

## Solution

We've implemented a new system that:

1. **Identifies default tasks** using translation keys
2. **Translates them properly** using the i18n system
3. **Supports user modifications** without affecting the original templates
4. **Enables future template updates** for non-modified tasks

## Files Changed

### Core Files
- `src/utils/taskLabel.ts` - New helper function for task label translation
- `src/types/index.ts` - Updated ChecklistItem interface with new fields
- `src/screens/CleaningScreen.tsx` - Updated to use getTaskLabel function

### Migration Scripts
- `scripts/migrate-cleaning-tasks.js` - Main migration script
- `scripts/dry-run-migration.js` - Dry-run script to preview changes

### Utility Files
- `src/utils/createApartmentWithDefaults.ts` - Helper for creating new apartments with default tasks

## Migration Process

### 1. Dry Run (Recommended)
First, run the dry-run script to see what will be changed:

```bash
node scripts/dry-run-migration.js
```

This will show you:
- How many apartments will be affected
- Which tasks will be updated
- What changes will be made
- No actual changes will be made

### 2. Run Migration
If the dry-run looks good, run the actual migration:

```bash
node scripts/migrate-cleaning-tasks.js
```

### 3. Verify Results
Check that:
- Default tasks now show translated text instead of keys
- Custom tasks remain unchanged
- All tasks have the new fields populated

## New Schema

The updated ChecklistItem interface now includes:

```typescript
export interface ChecklistItem {
  id: string;
  title: string;
  completed: boolean;
  completed_by?: string | null;
  completed_at?: string | null;
  order?: number | null;
  created_at?: string | null;
  // New fields for default tasks support
  template_key?: string | null; // Translation key for default tasks
  is_default?: boolean; // Whether this is a default task
  user_modified?: boolean; // Whether user has modified this task
  created_from_default_version?: number; // Version of default template when created
}
```

## How It Works

### Default Tasks
- Tasks with titles starting with `cleaning.defaultTasks.` are identified as default tasks
- They get `is_default: true` and `template_key` set to their translation key
- The `getTaskLabel()` function translates them using i18n

### Custom Tasks
- Tasks with custom titles get `is_default: false`
- They are displayed as-is without translation

### User Modifications
- When a user edits a default task, `user_modified` is set to `true`
- This prevents future template updates from overwriting user changes

## Future Template Updates

To update default task templates in the future:

1. Update the translation keys in `src/i18n/index.ts`
2. Increment the `created_from_default_version` in the migration script
3. Run a new migration that only updates tasks where:
   - `is_default: true`
   - `user_modified: false`
   - `created_from_default_version < new_version`

## Testing

After migration, verify that:

1. **Default tasks show translated text** (not raw keys)
2. **Custom tasks show as entered**
3. **User modifications are preserved**
4. **Language switching works correctly**

## Rollback

If you need to rollback:

1. The old `title` field is preserved
2. You can remove the new fields if needed
3. The `getTaskLabel()` function has fallback logic

## Support

If you encounter issues:

1. Check the console for error messages
2. Verify Firebase permissions
3. Run the dry-run script first
4. Check that all required fields are populated

## Example Usage

```typescript
import { getTaskLabel } from '../utils/taskLabel';

// In your component
const taskLabel = getTaskLabel(task); // Works with ChecklistItem object
const taskLabel2 = getTaskLabel(task.title); // Works with string (legacy)
```

This system provides a robust foundation for managing cleaning tasks with proper internationalization and user customization support.
