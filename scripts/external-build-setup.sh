#!/bin/bash

# סקריפט להכנת build חיצוני (GitHub Actions, CI/CD, etc.)
echo "🚀 מתכונן ל-build חיצוני..."

# בדיקת dependencies
echo "📦 בודק dependencies..."
if ! command -v expo &> /dev/null; then
    echo "❌ Expo CLI לא מותקן. התקן עם: npm install -g @expo/cli"
    exit 1
fi

# Clean and reinstall
echo "🧹 מנקה ומתקין מחדש..."
rm -rf node_modules
npm install

# Clean build artifacts
echo "🗑️ מנקה build artifacts..."
rm -rf ios android .expo

# Prebuild
echo "🔨 יוצר קבצי iOS/Android..."
npx expo prebuild --clean

# Install pods for iOS (if on macOS)
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "🍎 מתקין פודים עבור iOS..."
    cd ios && pod install --repo-update && cd ..
fi

echo "✅ הכנה ל-build חיצוני הושלמה!"
echo ""
echo "📋 פקודות ל-build חיצוני:"
echo "   Development: eas build -p ios --profile development"
echo "   Production: eas build -p ios --profile production"
echo ""
echo "🔑 ודא שיש לך:"
echo "   - EAS CLI מותקן (npm install -g eas-cli)"
echo "   - התחברות ל-EAS (eas login)"
echo "   - Apple Developer Account"
echo "   - GoogleService-Info.plist ו-google-services.json"
