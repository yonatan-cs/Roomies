# מדריך: שילוב AdMob לפני העלאה ל-App Store

## סקירה כללית

המדריך הזה מסביר איך לשחזר את הפונקציונליות של Google AdMob (פרסומות Native Advanced) לפני העלאה ל-App Store. כרגע האפליקציה משתמשת ב-**Mock Ads** (פרסומות דמה) שעובדות מצוין ב-Expo Go, והקוד האמיתי של AdMob מוכן אבל מוער.

## מה זה Mock Ads?

**Mock Ads** הן פרסומות דמה שנראות ומתנהגות בדיוק כמו פרסומות אמיתיות, אבל הן **לא דורשות native code** ולכן עובדות ב-Expo Go!

### היתרונות:
- ✅ **עובד ב-Expo Go** - ניתן לראות את החוויה המלאה בפיתוח
- ✅ **נראה זהה** - עיצוב ומיקום זהים לפרסומות אמיתיות
- ✅ **אין צורך ב-build** - Fast Refresh עובד כרגיל
- ✅ **קל להחלפה** - מעבר פשוט ל-AdMob אמיתי לפני שחרור

### איפה רואים את Mock Ads עכשיו:
- **רשימת קניות**: פרסומת מוטמעת כל 3 פריטים
- **מאזן הוצאות**: פרסומת מוטמעת כל 3 הוצאות

## מה צריך לשחזר לפני העלאה

### 1. שחזור קוד AdMob Service

**קובץ: `src/services/admob-service.ts`**

הסר את הסימון `/* */` מהבלוק המוער (שורות 47-88):

```typescript
/* ADMOB RESTORE: Uncomment this block before App Store deployment

/**
 * Initialize AdMob
 * Call this once when the app starts
 */
export const initializeAdMob = async () => {
  // ... הקוד כולו
};

*/
```

**איך לעשות:**
1. פתח את `src/services/admob-service.ts`
2. חפש `/* ADMOB RESTORE:`
3. מחק את `/*` בתחילת הבלוק ואת `*/` בסוף
4. מחק או הער את פונקציית ה-mock בתחתית הקובץ (שורות 91-96)

### 2. שחזור קומפוננטת הפרסומת האמיתית

**קובץ: `src/components/ads/RealNativeAdItem.tsx`**

הסר את הסימון `/* */` מכל הקוד האמיתי (שורות 11-129):

```typescript
/* ADMOB RESTORE: Uncomment all imports before App Store deployment

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
// ... שאר ה-imports

export default function RealNativeAdItem({ variant = 'shopping' }: RealNativeAdItemProps) {
  // ... הקוד כולו
}

*/
```

**ואז מחק את ה-mock export** בתחתית הקובץ (שורות 132-143):

```typescript
// Temporary export for Expo Go compatibility
// ADMOB RESTORE: Delete this mock export and uncomment the real component above
import MockAdItem from './MockAdItem';

interface RealNativeAdItemProps {
  variant?: 'shopping' | 'expense';
}

export default function RealNativeAdItem({ variant = 'shopping' }: RealNativeAdItemProps) {
  return <MockAdItem variant={variant} />;
}
```

### 3. החלפה ל-RealNativeAdItem במסכים

**קובץ: `src/components/ads/ShoppingListAd.tsx`**

```typescript
// Before:
import MockAdItem from './MockAdItem';

export default function ShoppingListAd() {
  return <MockAdItem variant="shopping" />;
}

// After:
import RealNativeAdItem from './RealNativeAdItem';

export default function ShoppingListAd() {
  return <RealNativeAdItem variant="shopping" />;
}
```

**קובץ: `src/components/ads/ExpenseListAd.tsx`**

```typescript
// Before:
import MockAdItem from './MockAdItem';

export default function ExpenseListAd() {
  return <MockAdItem variant="expense" />;
}

// After:
import RealNativeAdItem from './RealNativeAdItem';

export default function ExpenseListAd() {
  return <RealNativeAdItem variant="expense" />;
}
```

### 4. הוספת plugin ל-app.json

**קובץ: `app.json`**

הוסף את ה-plugin לסוף מערך ה-plugins. ההגדרות נמצאות גם בקובץ `app.json.admob-plugin`:

```json
"plugins": [
  "expo-asset",
  "expo-build-properties",
  // ... שאר ה-plugins
  "expo-web-browser",
  [
    "react-native-google-mobile-ads",
    {
      "androidAppId": "ca-app-pub-4539954746841772~6975731872",
      "iosAppId": "ca-app-pub-4539954746841772~9470743711"
    }
  ]
]
```

**שים לב:**
- הוסף פסיק (`,`) אחרי `"expo-web-browser"`
- העתק את ההגדרות מקובץ `app.json.admob-plugin`

### 5. אתחול AdMob באפליקציה

**קובץ: `App.tsx`** (או `index.ts` - המקום שבו האפליקציה מתחילה)

הוסף את האתחול:

```typescript
import { initializeAdMob } from './src/services/admob-service';

// In your App component or initialization:
useEffect(() => {
  initializeAdMob();
}, []);
```

## סיכום הקבצים לעדכון

### קבצים שצריך לערוך:

1. ✅ **`src/services/admob-service.ts`**
   - הסר הערות מבלוק ה-ADMOB RESTORE
   - מחק את פונקציית ה-mock

2. ✅ **`src/components/ads/RealNativeAdItem.tsx`**
   - הסר הערות מכל הקוד
   - מחק את ה-mock export

3. ✅ **`src/components/ads/ShoppingListAd.tsx`**
   - החלף `MockAdItem` ב-`RealNativeAdItem`

4. ✅ **`src/components/ads/ExpenseListAd.tsx`**
   - החלף `MockAdItem` ב-`RealNativeAdItem`

5. ✅ **`app.json`**
   - הוסף plugin (ראה `app.json.admob-plugin` להגדרות מדויקות)

6. ✅ **`App.tsx` (או קובץ הכניסה הראשי)**
   - אתחל AdMob

### קבצים שלא צריך לגעת בהם:

- ❌ `src/components/ads/MockAdItem.tsx` - אפשר להשאיר לצורך testing
- ❌ `src/screens/ShoppingScreen.tsx` - כבר מוכן
- ❌ `src/screens/BudgetScreen.tsx` - כבר מוכן
- ❌ `src/i18n/index.ts` - התרגומים כבר קיימים

## תהליך הבנייה לייצור

### שלב 1: הכנת EAS Build

אם עדיין לא התקנת EAS CLI:

```bash
npm install -g @expo/eas-cli
eas login
```

### שלב 2: בנייה

#### בנייה לבדיקות פנימיות:
```bash
eas build --platform ios --profile preview
eas build --platform android --profile preview
```

#### בנייה לייצור:
```bash
eas build --platform ios --profile production
eas build --platform android --profile production
```

### שלב 3: בדיקת הפרסומות

1. **התקן את ה-build החדש** על מכשיר אמיתי
2. **בדוק שהפרסומות מופיעות**:
   - פתח רשימת קניות עם 4+ פריטים
   - גלול וראה פרסומת אחרי כל 3 פריטים
   - פתח מאזן הוצאות עם 4+ הוצאות
   - גלול וראה פרסומת אחרי כל 3 הוצאות
3. **בדוק שהפרסומות לחיצות**:
   - לחץ על פרסומת
   - ודא שנפתח דפדפן/אפליקציה חיצונית

## פתרון בעיות נפוצות

### שגיאה: "Native module RNGoogleMobileAdsModule not found"

**גורם:** Plugin לא מוגדר ב-`app.json` או Build לא עודכן

**פתרון:**
1. ודא שהפלאגין מוגדר ב-`app.json` ללא הערות
2. הרץ build חדש: `eas build --profile preview`
3. ודא שאתה לא משתמש ב-Expo Go (לא יעבוד שם!)

### שגיאה: "Ad failed to load"

**גורם:** Ad Unit ID לא נכון או חשבון AdMob לא מוכן

**פתרון:**
1. ודא שה-Ad Unit IDs נכונים ב-`admob-service.ts`
2. בדוק שהאפליקציה מאושרת ב-AdMob console
3. נסה להשתמש ב-Test Ads בשלב הפיתוח

### הפרסומות לא מופיעות

**בדיקה:**
- ודא שיש לפחות 4 פריטים/הוצאות (פרסומות מופיעות כל 3)
- ודא שאתה לא ב-Expo Go (צריך production/preview build)
- בדוק את הקונסול לשגיאות

### הפרסומות נראות אחרת ממה שציפיתי

**הסבר:**
- Native Advanced Ads מציגות תוכן דינמי מהמפרסם
- העיצוב עשוי להשתנות בהתאם לפרסומת
- ה-Mock Ads הראו רק דוגמה כללית

## השוואה למדריכים אחרים

### FIREBASE_BEFORE_APPSTORE.md

שני המדריכים דומים מאוד:

| תכונה | Firebase FCM | AdMob |
|-------|--------------|-------|
| **מושבת ב-Expo Go** | ✅ | ✅ |
| **שחזור הקוד** | הסר הערות | הסר הערות |
| **Plugin ב-app.json** | צריך להוסיף | צריך להוסיף |
| **בדיקה** | שלח התראה | ראה פרסומות |

### DRAG_DROP_BEFORE_APPSTORE.md

ההבדל העיקרי:

| פיצ'ר | Drag & Drop | AdMob |
|-------|-------------|-------|
| **קוד בייצור** | **פעיל כבר** | **מוער - צריך שחזור** |
| **פעולות נדרשות** | שום דבר | הסר הערות |
| **Preview ב-Expo Go** | לא עובד | עובד (Mock Ads) |

## מידע על AdMob Account

### פרטי החשבון:

**App IDs:**
- iOS: `ca-app-pub-4539954746841772~9470743711`
- Android: `ca-app-pub-4539954746841772~6975731872`

**Ad Unit IDs (Native Advanced):**
- iOS: `ca-app-pub-4539954746841772/8114565480`
- Android: `ca-app-pub-4539954746841772/3516844926`

### חשוב לדעת:

1. **הפרסומות לא יופיעו מיד** - AdMob צריך זמן לאישור ולהתחיל להציג פרסומות
2. **בתחילה - Test Ads** - מומלץ להשתמש ב-Test Ad Units בפיתוח
3. **הכנסות** - ההכנסות יגיעו דרך AdMob console
4. **מדיניות** - ודא שהאפליקציה עומדת ב-AdMob policies

## שאלות נפוצות

### ש: האם אני צריך לעשות משהו מיוחד לפני העלאה ל-App Store?

**ת:** כן! עקוב אחר כל השלבים במדריך הזה:
1. הסר הערות מכל הקוד
2. החלף Mock Ads ב-Real Ads
3. הוסף plugin ל-app.json
4. בנה production build

### ש: איך אני יכול לבדוק את הפרסומות עכשיו?

**ת:** עכשיו ב-Expo Go אתה רואה Mock Ads שנראות כמו פרסומות אמיתיות! זה מספיק לבדיקת UI ו-UX.

### ש: למה זה לא עובד ב-Expo Go?

**ת:** כי AdMob דורש native modules שלא כלולים ב-Expo Go. לכן יצרנו Mock Ads שעובדות ב-Expo Go.

### ש: האם ה-Mock Ads יישארו באפליקציה?

**ת:** לא! אחרי שתעבור ל-Real AdMob, ה-Mock Ads לא ישמשו יותר. אפשר להשאיר את הקבצים לצורך testing.

### ש: מה ההבדל בין Mock ל-Real?

**ת:**
- **Mock Ads:** פרסומת דמה קבועה, לא מרוויחה כסף, עובדת ב-Expo Go
- **Real AdMob:** פרסומות אמיתיות, מרוויח כסף, צריך production build

### ש: האם הפרסומות מציקות למשתמש?

**ת:** לא! הפרסומות מוטמעות בצורה טבעית:
- מופיעות כל 4 פריטים בלבד
- נראות כמו חלק מהרשימה
- לא מכסות תוכן
- לא צצות או קופצות

## עצות מועילות

### 💡 עצה 1: בדוק עם Test Ads תחילה

לפני שחרור סופי, השתמש ב-Test Ad Units:

```typescript
import { TestIds } from 'react-native-google-mobile-ads';

// In development:
const adUnitId = __DEV__ ? TestIds.NATIVE_ADVANCED : getAdUnitId('nativeAdvanced');
```

### 💡 עצה 2: עקוב אחר הביצועים

ב-AdMob console תוכל לראות:
- כמה פרסומות הוצגו
- כמה לחיצות היו
- כמה הכנסות הרווחת

### 💡 עצה 3: התאם את התדירות

כרגע הפרסומות מופיעות כל 3 פריטים. אם תרצה לשנות, שנה את המספר `3` בפונקציה:

```typescript
// Insert ad after every 3 items
if ((index + 1) % 3 === 0 && index < items.length - 1) {
```

### 💡 עצה 4: שמור על Mock Ads

אל תמחק את `MockAdItem.tsx` - זה שימושי ל:
- בדיקות עתידיות
- פיתוח ללא AdMob
- Screenshots לחנות

## מסקנה

**Mock Ads עובדות מצוין ב-Expo Go - ניתן לראות את החוויה המלאה עכשיו!** 

הקוד של AdMob האמיתי מוכן ומוער. לפני העלאה ל-App Store:
1. ✅ הסר הערות מהקוד
2. ✅ החלף Mock ב-Real
3. ✅ הוסף plugin
4. ✅ בנה production build
5. ✅ בדוק שהפרסומות עובדות

**זהו! האפליקציה מוכנה להרוויח כסף מפרסומות! 🎉**

---

**הערה:** המדריך הזה נכתב עבור Expo SDK 53, React Native 0.79, ו-react-native-google-mobile-ads v15. אם אתה משתמש בגרסאות אחרות, ייתכן שיהיו הבדלים קלים בתהליך.

**עדכון אחרון:** אוקטובר 2025

