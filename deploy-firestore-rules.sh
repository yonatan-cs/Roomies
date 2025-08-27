#!/bin/bash

# Deploy Firestore Security Rules to Firebase
# This script deploys the firestore.rules file to your Firebase project

echo "🚀 Deploying Firestore Security Rules..."

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI is not installed. Please install it first:"
    echo "npm install -g firebase-tools"
    exit 1
fi

# Check if user is logged in
if ! firebase list &> /dev/null; then
    echo "❌ Not logged in to Firebase. Please login first:"
    echo "firebase login"
    exit 1
fi

# Deploy only Firestore rules and indexes
echo "📋 Deploying Firestore rules and indexes..."
firebase deploy --only firestore:rules,firestore:indexes

if [ $? -eq 0 ]; then
    echo "✅ Firestore rules deployed successfully!"
    echo ""
    echo "🔐 Your new security rules are now active:"
    echo "- Users can only access their own data"
    echo "- Apartment data is restricted to apartment members"
    echo "- Invite codes are publicly readable for join functionality"
    echo "- All collections require authentication"
    echo ""
    echo "🧪 Test your app now to ensure everything works correctly!"
else
    echo "❌ Deployment failed. Please check the error messages above."
    exit 1
fi
