# שיפורי מקלדת וטעינה - מדריך שימוש

## קומפוננטים חדשים שנוספו

### 1. `useAsyncAction` Hook
Hook חכם לפעולות אסינכרוניות עם loading state מהיר יותר.

```tsx
import { useAsyncAction } from '../hooks/useAsyncAction';

const { run, loading } = useAsyncAction(async () => {
  // פעולה אסינכרונית
  await someAsyncOperation();
}, {
  spinnerDelayMs: 180,        // דיליי לפני הצגת ספינר
  minSpinnerVisibleMs: 250,   // זמן מינימום להצגת ספינר
});
```

### 2. `AsyncButton` Component
כפתור משופר עם loading state אוטומטי.

```tsx
import { AsyncButton } from '../components/AsyncButton';

<AsyncButton
  title="שמור"
  onPress={async () => {
    await saveData();
  }}
  loadingText="שומר..."
  variant="primary"  // primary | secondary | danger
  size="medium"      // small | medium | large
/>
```

### 3. `Screen` Component
מסך בסיסי עם טיפול אוטומטי במקלדת.

```tsx
import { Screen } from '../components/Screen';

<Screen 
  withPadding={true}
  scroll={true}
  keyboardVerticalOffset={0}
>
  {/* תוכן המסך */}
</Screen>
```

### 4. `NumericInput` Component
TextInput מיוחד למקלדת מספרית עם InputAccessoryView ב-iOS.

```tsx
import { NumericInput } from '../components/NumericInput';

<NumericInput
  value={amount}
  onChangeText={setAmount}
  placeholder="0"
  className="border border-gray-300 rounded-xl px-4 py-3"
  textAlign="center"
/>
```

## שיפורי מקלדת

### TextInput משופר
```tsx
<TextInput
  // ... props רגילים
  returnKeyType="done"           // כפתור "Done" במקלדת
  onSubmitEditing={() => Keyboard.dismiss()}  // סגירת מקלדת
  blurOnSubmit={true}            // חשוב ל-multiline
/>
```

### Android Configuration
הוספנו `softwareKeyboardLayoutMode: "resize"` ל-`app.json` לשיפור התנהגות המקלדת באנדרואיד.

### iOS Numeric Keyboard
עבור מקלדת מספרית ב-iOS, השתמש ב-`NumericInput` שמציג InputAccessoryView עם כפתור "Done".

## מסכים שעודכנו

✅ **AddExpenseScreen** - יישום מלא
✅ **ExpenseEditModal** - יישום מלא  
✅ **LoginScreen** - יישום מלא
✅ **RegisterScreen** - יישום מלא
✅ **ForgotPasswordScreen** - יישום מלא
✅ **SettingsScreen** - יישום מלא
✅ **ShoppingScreen** - יישום מלא
✅ **CleaningScreen** - יישום מלא
✅ **GroupDebtsScreen** - יישום מלא

## מסכים שנותרו לעדכון

כל המסכים העיקריים עודכנו! 🎉

## יתרונות השיפורים

### Loading State מהיר יותר:
- דיליי חכם לספינר (180ms) - מונע הבזקים קצרים
- זמן מינימום להצגה (250ms) - חוויה נעימה יותר
- חסימה רק של הכפתור הרלוונטי
- התחלה בפריים הבא - מרכך סטטרים
- הגנה מפני double-tap מהיר

### מקלדת משופרת:
- לחיצה מחוץ למקלדת סוגרת אותה
- כפתור "Done" סוגר את המקלדת (כולל InputAccessoryView ב-iOS)
- התאמה אוטומטית לגובה המקלדת
- תמיכה ב-RTL
- מניעת בליעת לחיצות עם `pointerEvents="box-none"`
- Modal עם KeyboardAvoidingView מובנה

## איך להמשיך

1. **למסכים חדשים**: השתמש ב-`Screen` ו-`AsyncButton` מההתחלה
2. **למסכים קיימים**: החלף בהדרגה את ה-KeyboardAvoidingView ב-`Screen`
3. **לכפתורים**: החלף Pressable רגיל ב-`AsyncButton` לפעולות אסינכרוניות
4. **ל-TextInput**: הוסף `returnKeyType` ו-`onSubmitEditing` לפי הצורך
