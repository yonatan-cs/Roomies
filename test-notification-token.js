// Quick test to check token type
import { Notifications } from 'expo-notifications';

async function checkTokenType() {
  try {
    const token = await Notifications.getExpoPushTokenAsync({
      projectId: 'roomies-hub', // Your project ID
    });
    
    console.log('Token:', token.data);
    console.log('Token type:', token.data.startsWith('ExponentPushToken') ? 'EXPO PUSH' : 'FIREBASE FCM');
  } catch (error) {
    console.error('Error:', error);
  }
}

checkTokenType();
