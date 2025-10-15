#!/bin/bash

# סקריפט להכנת Development Build
echo "🚀 מתחיל הכנת Development Build..."

# בדיקת dependencies
echo "📦 בודק dependencies..."
if ! command -v expo &> /dev/null; then
    echo "❌ Expo CLI לא מותקן. התקן עם: npm install -g @expo/cli"
    exit 1
fi

# יצירת קבצי iOS/Android
echo "🔨 יוצר קבצי iOS/Android..."
npx expo prebuild --clean

# התקנת פודים עבור iOS
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "🍎 מתקין פודים עבור iOS..."
    cd ios && pod install && cd ..
fi

# בדיקת קונפיגורציה
echo "⚙️ בודק קונפיגורציה..."
if [ ! -f "GoogleService-Info.plist" ]; then
    echo "⚠️  GoogleService-Info.plist לא נמצא. ודא שהוא נמצא בתיקיית הפרויקט"
fi

if [ ! -f "google-services.json" ]; then
    echo "⚠️  google-services.json לא נמצא. ודא שהוא נמצא בתיקיית הפרויקט"
fi

echo "✅ הכנה הושלמה!"
echo ""
echo "📱 להרצה על מכשיר:"
echo "   iOS: npx expo run:ios"
echo "   Android: npx expo run:android"
echo ""
echo "🏗️ ל-EAS Build:"
echo "   Development: eas build -p ios --profile development"
echo "   Production: eas build -p ios --profile production"
echo ""
echo "📚 קרא את MIGRATION_GUIDE.md לפרטים נוספים"
