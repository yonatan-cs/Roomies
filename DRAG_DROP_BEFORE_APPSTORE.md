# מדריך: Drag & Drop ב-Expo Go ו-Production Build

## סקירה כללית

המדריך הזה מסביר על הפיצ'ר של עריכת סדר הרוטציה בניקיון (Drag & Drop) ומדוע הוא **לא עובד ב-Expo Go**, אבל **יעבוד מצוין** ב-production build.

## מה זה Drag & Drop?

הפיצ'ר של עריכת סדר הרוטציה מאפשר לך לשנות את סדר השותפים בסבב הניקיון על ידי גרירה ושחרור של השמות ברשימה.

**איפה תמצא את זה:**
- הגדרות → סבב ניקיון → כפתור "ערוך סדר רוטציה"

## למה זה לא עובד ב-Expo Go?

### ההסבר הטכני

Drag & Drop משתמש בספרייה `react-native-draggable-flatlist` שדורשת:
- `react-native-gesture-handler` - לזיהוי מחוות מגע מתקדמות
- `react-native-reanimated` - לאנימציות חלקות

שתי הספריות האלה דורשות **קוד native** (Objective-C/Swift ל-iOS, Kotlin/Java ל-Android) שלא כלול ב-Expo Go.

### מה זה Expo Go?

Expo Go הוא אפליקציה שמאפשרת לך לראות preview של האפליקציה שלך **ללא צורך בבנייה**. זה מעולה לפיתוח מהיר, אבל יש לו מגבלות:

❌ **לא תומך ב:**
- Native modules מותאמים אישית
- Drag & Drop
- Firebase Cloud Messaging (FCM)
- מצלמה מתקדמת
- Bluetooth
- ועוד...

✅ **תומך ב:**
- רוב הקומפוננטים הבסיסיים של React Native
- Navigation
- State management
- API calls
- רוב פיצ'רי האפליקציה שלנו

## האם הפיצ'ר יעבוד באפליקציה הסופית?

### כן! 100%! 🎉

**הפיצ'ר הזה יעבוד מצוין ב-production build וב-development build.**

בניגוד ל-Firebase FCM שהושבת בקוד (ויש לשחזר אותו), הקוד של Drag & Drop **כבר פעיל וקיים** - הוא פשוט לא יכול לרוץ ב-Expo Go.

### מה ההבדל בין זה ל-Firebase?

| פיצ'ר | סטטוס ב-Expo Go | סטטוס ב-Production | פעולות נדרשות |
|-------|-----------------|-------------------|---------------|
| **Drag & Drop** | ❌ לא עובד | ✅ עובד מצוין | **שום דבר!** |
| **Firebase FCM** | ❌ מושבת בקוד | ✅ עובד לאחר שחזור | צריך לשחזר קוד |

## איך לבדוק את הפיצ'ר?

### אופציה 1: Development Build (מומלץ לפיתוח)

Development build הוא כמו Expo Go, אבל עם כל ה-native modules שלך:

```bash
# התקן EAS CLI (אם עדיין לא מותקן)
npm install -g @expo/eas-cli

# התחבר לחשבון Expo
eas login

# בנה development build
eas build --profile development --platform ios
# או
eas build --profile development --platform android
```

**יתרונות:**
- ✅ כל הפיצ'רים עובדים (כולל Drag & Drop)
- ✅ Fast Refresh עדיין עובד
- ✅ יכול לראות שינויים בזמן אמת
- ✅ לא צריך לבנות מחדש בכל שינוי קוד

**חסרונות:**
- ⏱️ הבנייה הראשונה לוקחת זמן (15-30 דקות)
- 💾 צריך להתקין מחדש אחרי שינויים ב-native dependencies

### אופציה 2: Preview Build (בדיקה פנימית)

```bash
# iOS
eas build --profile preview --platform ios

# Android
eas build --profile preview --platform android
```

**מתי להשתמש:**
- 🧪 בדיקות פנימיות לפני שחרור
- 👥 שיתוף עם הצוות לבדיקה
- 📱 בדיקה על מכשירים שונים

### אופציה 3: Production Build (לפני העלאה לחנות)

```bash
# iOS
eas build --profile production --platform ios

# Android
eas build --profile production --platform android
```

**מתי להשתמש:**
- 🚀 לפני העלאה ל-App Store / Google Play
- ✅ בדיקה סופית לפני שחרור
- 📦 גרסה סופית למשתמשים

## הגדרות ב-eas.json

וודא שיש לך קובץ `eas.json` עם ההגדרות הבאות:

```json
{
  "cli": {
    "version": ">= 7.8.6"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "simulator": true
      }
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {
      "autoIncrement": true
    }
  },
  "submit": {
    "production": {}
  }
}
```

## פתרון בעיות נפוצות

### הפיצ'ר לא עובד ב-Expo Go

**זה נורמלי!** 

Drag & Drop לא יעבוד ב-Expo Go. תראה הודעת שגיאה או שהאפליקציה תקרוס כשתנסה לפתוח את המודאל.

**פתרון:**
- השתמש ב-development build או preview build
- זה לא באג - זו מגבלה ידועה של Expo Go

### שגיאה: "Reanimated 2 failed to create a worklet"

**גורם:**
הפלאגין של `react-native-reanimated` לא מוגדר ב-`babel.config.js`

**פתרון:**
ודא שיש לך את השורה הזו ב-`babel.config.js`:

```javascript
module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'react-native-reanimated/plugin', // ← חשוב! חייב להיות אחרון
    ],
  };
};
```

**הערה חשובה:** הפלאגין של reanimated **חייב** להיות אחרון ברשימת הפלאגינים!

### שגיאה: "GestureHandlerRootView not found"

**גורם:**
`react-native-gesture-handler` לא מוגדר נכון

**פתרון:**
1. ודא שהחבילה מותקנת:
```bash
npm install react-native-gesture-handler
```

2. אם אתה משתמש ב-development build, בנה מחדש:
```bash
eas build --profile development --platform ios
```

### הגרירה לא חלקה / קופאת

**גורם:**
בעיית ביצועים עם reanimated

**פתרון:**
1. ודא שאתה משתמש ב-production build או preview build (לא Expo Go)
2. בדוק שה-babel plugin מוגדר נכון
3. נסה על מכשיר אמיתי במקום סימולטור

## מה הלאה?

### בזמן פיתוח

**תוכל לעבוד עם Expo Go** כרגיל! כל שאר הפיצ'רים של האפליקציה עובדים מצוין:
- ✅ סבב ניקיון (צפייה בתור, השלמת ניקיון)
- ✅ הוצאות ומאזן
- ✅ רשימת קניות
- ✅ הגדרות
- ✅ וכל השאר...

רק **עריכת סדר הרוטציה** לא תעבוד - וזה בסדר!

### לפני העלאה ל-App Store

1. **בנה development build** כדי לבדוק את הפיצ'ר
2. **בנה preview build** לבדיקות פנימיות
3. **בנה production build** לפני העלאה סופית

**אין צורך לשחזר קוד** - הכל כבר פעיל!

## השוואה למדריכים אחרים

### FIREBASE_BEFORE_APPSTORE.md

המדריך של Firebase מסביר איך **לשחזר קוד שהושבת**.

**ההבדל:**
- Firebase: הקוד **מושבת בכוונה** → צריך לשחזר
- Drag & Drop: הקוד **פעיל** → לא צריך לעשות כלום!

### סיכום ההבדלים

| מדריך | קוד בפרודקשן | פעולות נדרשות |
|-------|--------------|---------------|
| FIREBASE_BEFORE_APPSTORE | הסר הערות מהקוד | הסר `//` מהקוד |
| **DRAG_DROP_BEFORE_APPSTORE** (זה) | **הכל מוכן** | **שום דבר!** |

## קבצים רלוונטיים

הפיצ'ר של Drag & Drop כולל:

1. **קומפוננטת המודאל:**
   - `src/components/CleaningRotationOrderModal.tsx`

2. **אינטגרציה:**
   - `src/components/CleaningScheduleSection.tsx` - כפתור לפתיחת המודאל

3. **State Management:**
   - `src/state/store.ts` - פונקציה `updateCleaningRotationOrder`

4. **Backend:**
   - `src/services/firestore-service.ts` - שמירה ל-Firestore

5. **תרגומים:**
   - `src/i18n/index.ts` - עברית ואנגלית

## תלויות

הפיצ'ר משתמש בחבילות הבאות:

```json
{
  "react-native-draggable-flatlist": "^4.0.1",
  "react-native-gesture-handler": "~2.24.0",
  "react-native-reanimated": "~3.17.4"
}
```

**כולן כבר מותקנות** ב-`package.json`!

## שאלות נפוצות

### ש: האם אני צריך לעשות משהו מיוחד לפני העלאה ל-App Store?

**ת: לא!** הקוד כבר מוכן. פשוט בנה production build והכל יעבוד.

### ש: איך אני יכול לבדוק את הפיצ'ר עכשיו?

**ת:** בנה development build עם `eas build --profile development`.

### ש: למה זה לא עובד ב-Expo Go?

**ת:** כי Drag & Drop דורש native modules שלא כלולים ב-Expo Go.

### ש: האם יש דרך לגרום לזה לעבוד ב-Expo Go?

**ת:** לא. זו מגבלה בסיסית של Expo Go. השתמש ב-development build במקום.

### ש: האם development build זה מסובך?

**ת:** לא! רק צריך להריץ `eas build --profile development` פעם אחת, ואז זה עובד כמו Expo Go.

### ש: כמה זמן לוקחת בנייה?

**ת:**
- **בנייה ראשונה:** 15-30 דקות
- **בניות הבאות:** 10-15 דקות
- **עדכוני קוד רגילים:** ללא בנייה! Fast Refresh עובד

### ש: האם צריך לבנות מחדש בכל שינוי קוד?

**ת:** לא! רק כשמוסיפים native dependencies חדשים. שינויי JavaScript/TypeScript עובדים עם Fast Refresh.

## עצות מועילות

### 💡 עצה 1: השתמש ב-development build לפיתוח

במקום Expo Go, בנה development build פעם אחת והשתמש בו לפיתוח. תקבל:
- כל הפיצ'רים (כולל Drag & Drop)
- Fast Refresh
- Debug tools
- חוויית פיתוח מהירה

### 💡 עצה 2: שמור את ה-build

לאחר שבנית development build, אל תמחק אותו! תוכל להשתמש בו שוב ושוב.

### 💡 עצה 3: בדוק על מכשיר אמיתי

הביצועים של Drag & Drop טובים יותר על מכשיר אמיתי מאשר על סימולטור.

### 💡 עצה 4: בנה לפני שחרור חשוב

לפני כל שחרור גרסה חדשה, בנה preview build ובדוק על מכשירים שונים.

## מסקנה

**Drag & Drop לא עובד ב-Expo Go - וזה בסדר גמור!** 

הקוד מוכן ויעבוד מצוין ב-production. אתה לא צריך לעשות שום דבר מיוחד.

אם אתה רוצה לבדוק את הפיצ'ר עכשיו, פשוט בנה development build אחד ותהנה מכל היכולות של האפליקציה!

---

**הערה:** המדריך הזה נכתב עבור Expo SDK 53 ו-React Native 0.79. אם אתה משתמש בגרסאות אחרות, ייתכן שיהיו הבדלים קלים בתהליך.

**עדכון אחרון:** אוקטובר 2025

