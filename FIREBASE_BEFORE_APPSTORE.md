# מדריך השחזור של Firebase לפני העלאה ל-App Store

## סקירה כללית

המדריך הזה מסביר איך לשחזר את הפונקציונליות של Firebase Cloud Messaging (FCM) לפני העלאה ל-App Store. כרגע הקוד מושבת כדי שהאפליקציה תעבוד עם Expo Go.

## מה צריך לשחזר

### 1. שחזור `app.json`

הוסף חזרה את הפלאגינים של Firebase:

```json
{
  "expo": {
    "plugins": [
      "expo-asset",
      "expo-build-properties",
      "expo-dev-client",
      "expo-font",
      "expo-mail-composer",
      [
        "expo-notifications",
        {
          "icon": "./logo.png",
          "color": "#ffffff",
          "sounds": ["./assets/notification.wav"],
          "mode": "production"
        }
      ],
      "@react-native-firebase/app",
      "@react-native-firebase/messaging",
      "expo-secure-store",
      "expo-sqlite",
      "expo-video",
      "expo-web-browser"
    ]
  }
}
```

### 2. שחזור הקוד - פשוט הסר את ההערות!

#### 🔍 איך לעשות את זה:
1. **פתח כל קובץ ברשימה למטה**
2. **חפש את התגית `FCM RESTORE`**
3. **הסר את הסלאשים `//` מתחילת השורות המוערות**

#### 📁 הקבצים שצריך לערוך:

**1. `App.tsx`**
- שורה 15-16: הסר `//` מה-import
- שורות 66-96: הסר `//` מהקוד המוער
- שורות 102-112: הסר `//` מהקוד המוער

**2. `SettingsScreen.tsx`**
- שורה 22-23: הסר `//` מה-import
- שורות 70-80: הסר `//` מהקוד המוער
- שורות 263-317: הסר `//` מהקוד המוער
- שורות 328-364: הסר `//` מהקוד המוער

**3. `firebase-init.ts`**
- שורה 6-7: הסר `//` מה-import
- שורות 23-31: הסר `//` מהקוד המוער

#### ⚡ טיפים מהירים:
**Find & Replace** בעורך הקוד:
- חפש: `// import { fcmNotificationService`
- החלף: `import { fcmNotificationService`
- חזור על זה לכל השורות שמוערות!

**או השתמש ב-Ctrl+H (Windows) / Cmd+H (Mac):**
- חפש: `// import`
- החלף: `import`
- זה יחליף את כל השורות בבת אחת!

**בדיקה מהירה:** אחרי השחזור, ודא שאין יותר שורות שמתחילות ב-`// import` או `/* FCM RESTORE`

## תהליך הבנייה לייצור

### שלב 1: הכנת EAS Build

1. **התקן EAS CLI** (אם עדיין לא מותקן):
```bash
npm install -g @expo/eas-cli
```

2. **התחבר לחשבון Expo**:
```bash
eas login
```

3. **הגדר את הפרויקט ל-EAS Build**:
```bash
eas build:configure
```

### שלב 2: הגדרת Build Profiles

ערוך את `eas.json` (אם הוא לא קיים, הוא ייווצר אוטומטית):

```json
{
  "cli": {
    "version": ">= 7.8.6"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
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

### שלב 3: בנייה

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

### שלב 4: בדיקת התראות

1. **התקן את ה-build החדש** על מכשיר אמיתי
2. **בדוק שההתראות עובדות**:
   - התחבר למשתמש
   - שלח התראה מהקונסול של Firebase
   - בדוק שההתראה מגיעה

## פתרון בעיות נפוצות

### שגיאה: "Native module RNFBAppModule not found"
- **פתרון**: ודא שהרצת `eas build` ולא רק `expo start`
- **בדיקה**: ודא שהוספת את הפלאגינים ל-`app.json`

### שגיאה: "Firebase configuration not found"
- **פתרון**: ודא שקובץ `google-services.json` (Android) ו-`GoogleService-Info.plist` (iOS) נמצאים בתיקיית הפרויקט
- **בדיקה**: ודא שהוספת אותם ל-`app.json` תחת `googleServicesFile`

### התראות לא מגיעות
- **בדיקה**: ודא שיש הרשאות התראות במכשיר
- **בדיקה**: בדוק שהמכשיר מחובר לאינטרנט
- **בדיקה**: בדוק את הקונסול של Firebase לשליחת התראות

### שגיאות ב-build
- **פתרון**: בדוק את הלוגים של EAS Build באתר Expo
- **פתרון**: ודא שכל התלויות מותקנות ב-`package.json`

## קבצים שחשוב לשמור

✅ **אל תמחק את הקבצים האלה**:
- `google-services.json` (Android)
- `GoogleService-Info.plist` (iOS)
- `src/services/fcm-notification-service.ts`
- `package.json` (כולל התלויות של Firebase)
- `functions/` (Cloud Functions)

## תזכורת חשובה

- **לפני העלאה ל-App Store**: ודא שכל הקוד של FCM פעיל
- **בדיקה מקיפה**: בדוק התראות על מכשירים אמיתיים
- **גיבוי**: שמור עותק של הקוד הנוכחי לפני השינויים

## 🚀 שימוש עם Native Modules אחרים

### AdMob, Camera, וכו'

המדריך הזה עובד **בדיוק אותו דבר** עם כל native module אחר:

**AdMob לדוגמה:**
1. במהלך פיתוח: הסר `@react-native-google-mobile-ads/app` מ-`plugins` ב-`app.json`
2. הער את הקוד עם הערות `/* ADMOB RESTORE */`
3. לפני העלאה: השתמש באותו מדריך - חפש `ADMOB RESTORE` והסר הערות

**העיקרון:** כל package שדורש native code לא יעבוד ב-Expo Go!

### 📝 תבנית לקבצים חדשים

כשתוסיף native module חדש, השתמש בתבנית הזו:

```typescript
// NATIVE_MODULE disabled for Expo Go compatibility - restore before App Store deployment
// import { nativeModule } from '@react-native-native-module';

// NATIVE_MODULE initialization disabled for Expo Go compatibility
console.log('⚠️ NATIVE_MODULE disabled for Expo Go compatibility');

/* NATIVE_MODULE RESTORE: Uncomment this block before App Store deployment
// Your native module code here
*/
```

---

**הערה**: המדריך הזה נכתב עבור Expo SDK 53 ו-React Native Firebase v23. אם אתה משתמש בגרסאות אחרות, ייתכן שיהיו הבדלים קלים בתהליך.
