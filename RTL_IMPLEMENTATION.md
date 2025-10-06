# RTL Implementation Guide

## Overview

This application now has comprehensive RTL (Right-to-Left) support for Hebrew without using `I18nManager.forceRTL`, which prevents layout-breaking side effects.

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

### 2. **App.tsx Global Configuration**

Updated to set default text alignment for all `Text` and `TextInput` components:

```typescript
// Automatically applied to all Text and TextInput
{
  textAlign: isRTL ? 'right' : 'left',
  writingDirection: isRTL ? 'rtl' : 'ltr',
}
```

This ensures Hebrew text aligns right by default without breaking layouts or requiring `forceRTL`.

### 3. **Fixed Components**

#### ExpenseRow.tsx
- Replaced `marginLeft: 12` → `marginStart: 12`
- Replaced `marginRight: 10` → `marginEnd: 10`

#### WelcomeScreen.tsx & AuthScreen.tsx
- Fixed absolute positioning of language toggle button
- Changed from `{ right: 16, top: 60 }` to `{ ...absEnd(16), top: 60 }`

### 4. **Verified Components**

Searched and verified no remaining `marginLeft`, `marginRight`, `paddingLeft`, or `paddingRight` hardcoded values that would break RTL layouts.

## How to Use RTL Utilities

### For Text Components

```typescript
import { rtlText, rtlTextCenter } from '../utils/rtl';

// Right-aligned in Hebrew, left-aligned in English
<Text style={rtlText()}>שלום / Hello</Text>

// Always centered, but respects writing direction
<Text style={rtlTextCenter()}>Centered Text</Text>

// With additional styles
<Text style={rtlText({ fontSize: 16, fontWeight: 'bold' })}>
  Styled Text
</Text>
```

### For TextInput Components

```typescript
import { rtlTextInput } from '../utils/rtl';

<TextInput
  style={rtlTextInput({ fontSize: 16 })}
  placeholder="Enter text..."
/>
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

1. **Use `marginStart`/`marginEnd` instead of `marginLeft`/`marginRight`**
   ```typescript
   // Good
   style={{ marginStart: 12 }}
   
   // Bad
   style={{ marginLeft: 12 }}
   ```

2. **Use RTL utility functions for text alignment**
   ```typescript
   // Good
   <Text style={rtlText()}>Hello</Text>
   
   // Bad (will default left in Hebrew)
   <Text>Hello</Text>
   ```

3. **Use `absStart()`/`absEnd()` for absolute positioning**
   ```typescript
   // Good
   style={{ position: 'absolute', ...absEnd(16) }}
   
   // Bad
   style={{ position: 'absolute', right: 16 }}
   ```

4. **Flip directional icons in RTL**
   ```typescript
   // Good
   <Ionicons name="arrow-forward" style={flipIcon()} />
   
   // Bad (arrow points wrong direction in Hebrew)
   <Ionicons name="arrow-forward" />
   ```

### ❌ DON'T

1. **Don't use `I18nManager.forceRTL()` or `I18nManager.allowRTL()`**
   - These require native reloads and break layouts globally

2. **Don't hardcode left/right values**
   - Use start/end or RTL utilities instead

3. **Don't ignore writing direction for mixed content**
   - Always include both `textAlign` and `writingDirection` for proper rendering of mixed Hebrew/English/numbers

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

The app now has comprehensive RTL support that:
- ✅ Aligns Hebrew text to the right
- ✅ Positions icons and buttons correctly
- ✅ Handles mixed content (Hebrew + English + numbers)
- ✅ Works without native reloads
- ✅ Doesn't break existing layouts
- ✅ Is maintainable and extensible

All critical RTL issues have been resolved. The app is now fully usable in Hebrew with proper text alignment and layout direction.
