# Themed Alert Migration Guide

## Overview
The app now includes a **ThemedAlert** component that automatically adapts to:
- ✅ **Dark Mode** - Matches the current theme (light/dark)
- ✅ **Language Changes** - Works seamlessly with i18n (Hebrew/English)
- ✅ **RTL Support** - Proper text alignment for Hebrew

## Migration from Alert.alert()

### Before (Old Code)
```typescript
import { Alert } from 'react-native';

// Basic alert
Alert.alert('Error', 'Something went wrong');

// Alert with buttons
Alert.alert(
  'Confirm',
  'Are you sure?',
  [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', onPress: () => handleDelete(), style: 'destructive' }
  ]
);
```

### After (New Code)
```typescript
import { showThemedAlert } from '../components/ThemedAlert';

// Basic alert
showThemedAlert('Error', 'Something went wrong');

// Alert with buttons
showThemedAlert(
  'Confirm',
  'Are you sure?',
  [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', onPress: () => handleDelete(), style: 'destructive' }
  ]
);
```

## Button Styles
- `default` - Primary blue color (default)
- `cancel` - Gray color for cancel actions
- `destructive` - Red color for dangerous actions

## Usage with Translations
```typescript
import { useTranslation } from 'react-i18next';
import { showThemedAlert } from '../components/ThemedAlert';

function MyComponent() {
  const { t } = useTranslation();
  
  const handleError = () => {
    showThemedAlert(
      t('common.error'),
      t('myScreen.errorMessage'),
      [{ text: t('common.ok') }]
    );
  };
}
```

## Files Already Migrated
- ✅ `src/screens/AuthScreen.tsx`
- ✅ `src/screens/SettingsScreen.tsx`
- ✅ `src/screens/GroupDebtsScreen.tsx`
- ✅ `src/components/AddExpenseModal.tsx`

## Files That Need Migration
Run this command to find remaining Alert.alert() usage:
```bash
grep -r "Alert\.alert" src/ --include="*.tsx" --include="*.ts"
```

### Remaining Files:
- `src/screens/ForgotPasswordScreen.tsx`
- `src/screens/ShoppingScreen.tsx`
- `src/screens/DashboardScreen.tsx`
- `src/components/ExpenseRow.tsx`
- `src/components/ExpenseEditModal.tsx`
- `src/services/firebase-notification-service.ts`

## Step-by-Step Migration

1. **Import the function**
   ```typescript
   import { showThemedAlert } from '../components/ThemedAlert';
   // or for services:
   import { showThemedAlert } from './components/ThemedAlert';
   ```

2. **Remove Alert import**
   ```typescript
   // Remove this:
   import { Alert } from 'react-native';
   ```

3. **Replace Alert.alert() calls**
   - Simply replace `Alert.alert` with `showThemedAlert`
   - Keep all parameters the same

4. **Test in both themes**
   - Open Settings → Theme → Switch between Light/Dark
   - Trigger the alert to verify it looks good

## Implementation Details

### ThemedAlertProvider
The `ThemedAlertProvider` is already added to `App.tsx`:
```typescript
<ThemeProvider>
  <ThemedAlertProvider>
    <ThemedRoot />
  </ThemedAlertProvider>
</ThemeProvider>
```

### Dark Mode Colors
- **Background**: Adapts to card color from theme
- **Text**: Uses primary/secondary text colors from theme
- **Borders**: Uses theme border colors
- **Buttons**: Blue (default), Gray (cancel), Red (destructive)

### Alert Queue
The alert system includes a queue to handle multiple alerts:
- Shows one alert at a time
- Automatically shows next alert when dismissed
- Non-blocking - returns a Promise

## Translation Keys Used
Make sure your i18n files include:
- `common.ok` - OK button text
- `common.error` - Error title
- `common.success` - Success title
- `common.cancel` - Cancel button text

## Example: Complete Component
```typescript
import React from 'react';
import { Pressable, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { showThemedAlert } from '../components/ThemedAlert';

export function MyScreen() {
  const { t } = useTranslation();
  
  const handleDelete = async () => {
    try {
      // Show confirmation
      await new Promise((resolve) => {
        showThemedAlert(
          t('common.confirm'),
          t('myScreen.deleteConfirm'),
          [
            { text: t('common.cancel'), style: 'cancel', onPress: () => resolve(false) },
            { text: t('common.delete'), style: 'destructive', onPress: () => resolve(true) }
          ]
        );
      });
      
      // Perform delete...
      
      // Show success
      showThemedAlert(
        t('common.success'),
        t('myScreen.deleteSuccess')
      );
    } catch (error) {
      showThemedAlert(
        t('common.error'),
        t('myScreen.deleteError')
      );
    }
  };
  
  return (
    <Pressable onPress={handleDelete}>
      <Text>Delete Item</Text>
    </Pressable>
  );
}
```

## Notes
- All alerts are now themed automatically
- No need to worry about dark mode styling
- Translations work out of the box
- Alert queue prevents overlapping alerts
- Component is fully typed with TypeScript

