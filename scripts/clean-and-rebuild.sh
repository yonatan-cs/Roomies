#!/bin/bash

echo "🧹 מנקה הכל ומתחיל מחדש..."

# Clean everything
echo "🗑️ מנקה קבצים ישנים..."
rm -rf node_modules
rm -rf ios
rm -rf android
rm -rf .expo
rm -rf .expo-shared

# Clean npm cache
echo "🗑️ מנקה npm cache..."
npm cache clean --force

# Reinstall dependencies
echo "📦 מתקין dependencies מחדש..."
npm install

# Prebuild with clean
echo "🔨 יוצר קבצי iOS/Android מחדש..."
npx expo prebuild --clean

# Install pods for iOS (if on macOS)
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "🍎 מתקין פודים עבור iOS..."
    cd ios && pod install --repo-update && cd ..
fi

echo "✅ ניקוי והכנה מחדש הושלמו!"
echo ""
echo "📱 עכשיו תוכל להריץ:"
echo "   Development: eas build -p ios --profile development"
echo "   Production: eas build -p ios --profile production"
