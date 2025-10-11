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

### 2. שחזור `App.tsx`

#### א. הסר את ההערה מה-import (שורה 15-16):
```typescript
// הסר את ההערה מהשורה הזו:
import { fcmNotificationService } from './src/services/fcm-notification-service';
```

#### ב. הסר את ההערות מה-useEffect הראשון (שורות 60-97):
```typescript
// החלף את ה-useEffect הנוכחי בקוד הזה:
useEffect(() => {
  const requestFirstTimePermissions = async () => {
    try {
      // Check if we've already requested permissions
      const hasAsked = await AsyncStorage.getItem('notification_permissions_requested');
      
      if (!hasAsked) {
        console.log('🔔 First time app launch - requesting FCM notification permissions');
        // Request permissions immediately on first launch
        const granted = await fcmNotificationService.requestPermissions();
        
        if (granted) {
          console.log('✅ User granted FCM notification permissions');
        } else {
          console.log('⚠️ User denied FCM notification permissions');
        }
        
        // Mark that we've asked (whether granted or denied)
        await AsyncStorage.setItem('notification_permissions_requested', 'true');
        setHasRequestedPermissions(true);
      } else {
        setHasRequestedPermissions(true);
      }
    } catch (error) {
      console.error('❌ Error requesting first-time FCM permissions:', error);
      setHasRequestedPermissions(true);
    }
  };

  requestFirstTimePermissions();
}, []);
```

#### ג. הסר את ההערות מה-useEffect השני (שורות 99-113):
```typescript
// החלף את ה-useEffect הנוכחי בקוד הזה:
useEffect(() => {
  const initializeNotifications = async () => {
    if (currentUser?.id && hasRequestedPermissions) {
      console.log('🚀 Initializing FCM notifications for user:', currentUser.id);
      // Fire-and-forget to avoid blocking app startup
      void fcmNotificationService.initialize(currentUser.id);
    }
  };

  initializeNotifications();
}, [currentUser?.id, hasRequestedPermissions]);
```

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

---

**הערה**: המדריך הזה נכתב עבור Expo SDK 53 ו-React Native Firebase v23. אם אתה משתמש בגרסאות אחרות, ייתכן שיהיו הבדלים קלים בתהליך.
