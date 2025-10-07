# RTL Implementation Guide

## Overview

This application now has comprehensive RTL (Right-to-Left) support for Hebrew using component-based RTL awareness without `I18nManager.forceRTL`, which prevents layout-breaking side effects.

## What Was Implemented

### 1. **RTL Utility Functions** (`src/utils/rtl.ts`)

A comprehensive set of helper functions for RTL-aware layouts:

- **`isRTL`**: Boolean indicating if current language direction is RTL
- **`rtlText(extraStyle?)`**: Returns proper text alignment with `textAlign` and `writingDirection`
- **`rtlTextInput(extraStyle?)`**: Same as rtlText but specifically for TextInput components
- **`rtlTextCenter(extraStyle?)`**: Center-aligned text that respects RTL writing direction
- **`rtlRow(extraStyle?)`**: Flips flexDirection for row layouts in RTL
- **`absStart(value)`**: RTL-aware positioning for "start" of layout (left in LTR, right in RTL)
- **`absEnd(value)`**: RTL-aware positioning for "end" of layout (right in LTR, left in RTL)
- **`flipIcon(shouldFlip?)`**: Flips icons horizontally in RTL (useful for arrows, chevrons)
- **`marginStart(value)`** / **`marginEnd(value)`**: RTL-aware margins
- **`paddingStart(value)`** / **`paddingEnd(value)`**: RTL-aware padding

### 2. **Dynamic RTL Hook** (`src/hooks/useIsRTL.ts`)

New hook that provides dynamic RTL detection:

```typescript
// Responds to language changes in real-time
const isRTL = useIsRTL(); // true when i18n.language === 'he'
```

This ensures RTL detection updates immediately when language changes, unlike static imports.

### 3. **Enhanced ThemedText Component** (`src/theme/components/ThemedText.tsx`)

Updated ThemedText to automatically apply RTL text alignment:

```typescript
// Automatically applied to all ThemedText components
{
  textAlign: isRTL ? 'right' : 'left',
  writingDirection: isRTL ? 'rtl' : 'ltr',
}
```

This ensures Hebrew text aligns right by default while preserving existing color theming logic and allowing style prop overrides.

### 4. **AppTextInput Component** (`src/components/AppTextInput.tsx`)

New RTL-aware TextInput wrapper that:

- Applies proper `textAlign` and `writingDirection` based on RTL
- Adds `textAlignVertical="top"` for Android multiline inputs
- Preserves TextInput selection on Android to prevent cursor jumps
- Preserves all TextInput props and forwards them
- Supports style prop override for special cases (centered inputs)

### 5. **Hebrew Formatting Utilities** (`src/utils/hebrewFormatting.ts`)

New utilities for proper Hebrew number and date formatting:

- `formatCurrency()` - Uses Intl.NumberFormat for proper RTL currency display
- `formatDate()` - Uses Intl.DateTimeFormat for proper RTL date display
- `formatNumber()` - Uses Intl.NumberFormat for proper RTL number display
- Hook versions (`useFormatCurrency()`, etc.) that automatically detect RTL

### 4. **Screen Migration Completed**

All screens have been migrated to use RTL-aware components:

- **Auth Flow**: AuthScreen, WelcomeScreen, ForgotPasswordScreen
- **Settings Screen**: All TextInput and Text components
- **Shopping Screen**: All modals, forms, and display components
- **Cleaning Screen**: Already using ThemedText
- **Dashboard & Budget Screens**: Already using ThemedText
- **AddExpense & GroupDebts Screens**: Already using ThemedText

### 5. **Component Updates**

- **AsyncButton**: Updated to use ThemedText for RTL button labels
- **All other components**: Already using ThemedText or AppTextInput

### 6. **Removed Ineffective Code**

- Removed global `defaultProps` approach from `App.tsx` (lines 67-86)
- This approach was unreliable and has been replaced by component-based RTL support

## How to Use RTL Components

### For Text Components

```typescript
import { ThemedText } from '../theme/components/ThemedText';

// Automatically RTL-aware - right-aligned in Hebrew, left-aligned in English
<ThemedText>שלום / Hello</ThemedText>

// With additional styles (RTL alignment is preserved)
<ThemedText style={{ fontSize: 16, fontWeight: 'bold' }}>
  Styled Text
</ThemedText>

// Override alignment when needed (e.g., centered text)
<ThemedText style={{ textAlign: 'center' }}>
  Centered Text
</ThemedText>
```

### For TextInput Components

```typescript
import { AppTextInput } from '../components/AppTextInput';

// Automatically RTL-aware with proper cursor positioning
<AppTextInput
  placeholder="Enter text..."
  style={{ fontSize: 16 }}
/>

// Override alignment when needed (e.g., centered inputs)
<AppTextInput
  placeholder="Join code"
  style={{ textAlign: 'center' }}
/>

// Multiline inputs with proper Android support
<AppTextInput
  placeholder="Enter notes..."
  multiline
  numberOfLines={3}
/>
```

### For Number and Date Formatting

```typescript
import { useFormatCurrency, useFormatDate, useFormatNumber } from '../utils/hebrewFormatting';

function MyComponent() {
  const formatCurrency = useFormatCurrency();
  const formatDate = useFormatDate();
  const formatNumber = useFormatNumber();

  return (
    <View>
      <ThemedText>{formatCurrency(1234.56)}</ThemedText>
      <ThemedText>{formatDate(new Date())}</ThemedText>
      <ThemedText>{formatNumber(1234567)}</ThemedText>
    </View>
  );
}
```

### For Row Layouts

```typescript
import { rtlRow } from '../utils/rtl';

// Automatically reverses in RTL
<View style={rtlRow({ gap: 8 })}>
  <Icon name="star" />
  <Text>Star Rating</Text>
</View>
```

### For Absolute Positioning

```typescript
import { absStart, absEnd } from '../utils/rtl';

// Close button at end of card (right in LTR, left in RTL)
<Pressable style={{ position: 'absolute', ...absEnd(16), top: 16 }}>
  <Icon name="close" />
</Pressable>

// Back button at start of header (left in LTR, right in RTL)
<Pressable style={{ position: 'absolute', ...absStart(16), top: 16 }}>
  <Icon name="arrow-back" />
</Pressable>
```

### For Directional Icons

```typescript
import { flipIcon } from '../utils/rtl';

// Arrow/chevron that should point in opposite direction for RTL
<Icon name="chevron-forward" style={flipIcon()} />

// Icon that should NOT flip (like a star or heart)
<Icon name="star" style={flipIcon(false)} />
```

### For Margins and Padding

```typescript
import { marginStart, marginEnd, paddingStart, paddingEnd } from '../utils/rtl';

<View style={[marginStart(16), paddingEnd(8)]}>
  <Text>Content</Text>
</View>
```

## Best Practices

### ✅ DO

1. **Use ThemedText for all user-facing text**
   ```typescript
   // Good - automatically RTL-aware
   <ThemedText>שלום עולם</ThemedText>
   
   // Bad - not RTL-aware
   <Text>שלום עולם</Text>
   ```

2. **Use AppTextInput for all text inputs**
   ```typescript
   // Good - automatically RTL-aware with proper cursor positioning
   <AppTextInput placeholder="הכנס טקסט" />
   
   // Bad - not RTL-aware
   <TextInput placeholder="הכנס טקסט" />
   ```

3. **Use `marginStart`/`marginEnd` instead of `marginLeft`/`marginRight`**
   ```typescript
   // Good
   style={{ marginStart: 12 }}
   
   // Bad
   style={{ marginLeft: 12 }}
   ```

4. **Use `absStart()`/`absEnd()` for absolute positioning**
   ```typescript
   // Good
   style={{ position: 'absolute', ...absEnd(16) }}
   
   // Bad
   style={{ position: 'absolute', right: 16 }}
   ```

5. **Flip directional icons in RTL**
   ```typescript
   // Good
   <Ionicons name="arrow-forward" style={flipIcon()} />
   
   // Bad (arrow points wrong direction in Hebrew)
   <Ionicons name="arrow-forward" />
   ```

### ❌ DON'T

1. **Don't use `I18nManager.forceRTL()` or `I18nManager.allowRTL()`**
   - These require native reloads and break layouts globally

2. **Don't use raw `Text` or `TextInput` components**
   - Always use `ThemedText` and `AppTextInput` for RTL support

3. **Don't hardcode left/right values**
   - Use start/end or RTL utilities instead

4. **Don't ignore writing direction for mixed content**
   - ThemedText and AppTextInput automatically handle this

## Testing RTL

### Manual Testing Checklist

1. **Switch language to Hebrew in Settings**
2. **Check all screens:**
   - Text should align to the right
   - Icons should be at correct positions
   - Rows should flow right-to-left
   - Absolute positioned elements should be on correct side
   - Directional icons should point correct direction

3. **Check edge cases:**
   - Mixed Hebrew + English text
   - Numbers in Hebrew sentences
   - Long text wrapping
   - Text inputs (cursor should start on right)
   - Search fields
   - Lists with icons

### Common Issues and Fixes

#### Issue: Text aligns left in Hebrew
**Fix:** Ensure component imports and uses `rtlText()` or check that App.tsx defaults are applied

#### Issue: Icon on wrong side
**Fix:** Replace hardcoded left/right with `absStart()` or `absEnd()`

#### Issue: Row elements in wrong order
**Fix:** Use `rtlRow()` instead of `flexDirection: 'row'`

#### Issue: Margins/padding incorrect
**Fix:** Replace `marginLeft/Right` with `marginStart/End`

## Future Improvements

### Optional Enhancements (Not Critical)

1. **Create wrapped components** (if many manual changes needed):
   ```typescript
   // components/RTLText.tsx
   export const RTLText = ({ style, ...props }) => (
     <Text style={[rtlText(), style]} {...props} />
   );
   ```

2. **Add ESLint rules** to prevent left/right usage:
   ```javascript
   // .eslintrc.js
   rules: {
     'no-restricted-syntax': [
       'error',
       {
         selector: "Property[key.name='marginLeft']",
         message: 'Use marginStart instead of marginLeft for RTL support'
       }
     ]
   }
   ```

3. **Automated testing**:
   - Detox tests with both `he` and `en` locales
   - Screenshot comparisons

## Technical Notes

### Why Not forceRTL?

`I18nManager.forceRTL(true)` causes:
- **Global layout mirroring** that breaks many components
- **Requires native reload** (bad UX)
- **Conflicts with third-party components** not designed for RTL
- **Breaks absolute positioning** across entire app

### Why This Approach Works

- **Granular control**: Each component handles RTL explicitly
- **No native reload required**: Works immediately on language change
- **Compatible with all libraries**: Doesn't force global mirroring
- **Maintainable**: Clear, explicit RTL handling in code
- **Flexible**: Can mix LTR and RTL elements as needed

## Summary

The app now has comprehensive RTL support using a component-based approach that:
- ✅ Aligns Hebrew text to the right automatically via ThemedText
- ✅ Positions TextInput cursors correctly via AppTextInput
- ✅ Handles mixed content (Hebrew + English + numbers) with writingDirection
- ✅ Works without native reloads or forceRTL
- ✅ Doesn't break existing layouts or icon positions
- ✅ Is maintainable and extensible
- ✅ Provides consistent RTL behavior across all screens

### Implementation Status

- ✅ **Foundation**: Enhanced ThemedText and created AppTextInput
- ✅ **Auth Flow**: AuthScreen, WelcomeScreen, ForgotPasswordScreen migrated
- ✅ **Settings**: All TextInput and Text components migrated
- ✅ **Shopping**: All modals, forms, and display components migrated
- ✅ **Other Screens**: Already using ThemedText (Cleaning, Dashboard, Budget, etc.)
- ✅ **Components**: AsyncButton and all other components updated
- ✅ **Documentation**: Updated with new component-based approach

All critical RTL issues have been resolved. The app is now fully usable in Hebrew with proper text alignment and maintains all existing functionality.
