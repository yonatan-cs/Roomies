#!/bin/bash

echo "🔧 מתקן בעיות build..."

# Clean everything
echo "🧹 מנקה קבצים ישנים..."
rm -rf node_modules
rm -rf ios
rm -rf android
rm -rf .expo

# Reinstall dependencies
echo "📦 מתקין dependencies מחדש..."
npm install

# Clean npm cache
echo "🗑️ מנקה npm cache..."
npm cache clean --force

# Prebuild with clean
echo "🔨 יוצר קבצי iOS/Android מחדש..."
npx expo prebuild --clean

# Install pods for iOS
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "🍎 מתקין פודים עבור iOS..."
    cd ios && pod install --repo-update && cd ..
fi

echo "✅ תיקון הושלם!"
echo ""
echo "📱 עכשיו תוכל להריץ:"
echo "   Development: npm run build:dev:ios"
echo "   Production: npm run build:prod:ios"
