import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer, DefaultTheme, DarkTheme, Theme as NavTheme } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { View, Text, TextInput } from "react-native";
import AppNavigator from "./src/navigation/AppNavigator";
import { ThemeProvider, useTheme } from "./src/theme/ThemeProvider";
import { navigationRef } from "./src/navigation/navigationRef";
import AsyncStorage from '@react-native-async-storage/async-storage';
import "./src/i18n";
import { useEffect } from "react";
import { useStore } from "./src/state/store";
import i18n from "./src/i18n";
import { configureReanimatedLogger } from 'react-native-reanimated';
import { firebaseNotificationService } from './src/services/firebase-notification-service';

// Configure Reanimated logger to disable strict mode warnings
configureReanimatedLogger({
  strict: false, // Disable strict mode to stop the "Reading from value during render" warnings
});

/*
IMPORTANT NOTICE: DO NOT REMOVE
There are already environment keys in the project. 
Before telling the user to add them, check if you already have access to the required keys through bash.
Directly access them with process.env.${key}

Correct usage:
process.env.EXPO_PUBLIC_VIBECODE_{key}
//directly access the key

Incorrect usage:
import { OPENAI_API_KEY } from '@env';
//don't use @env, its depreicated

Incorrect usage:
import Constants from 'expo-constants';
const openai_api_key = Constants.expoConfig.extra.apikey;
//don't use expo-constants, its depreicated

*/

export default function App() {
  const appLanguage = useStore(s => s.appLanguage);
  const currentUser = useStore(s => s.currentUser);

  useEffect(() => {
    if (i18n.language !== appLanguage) {
      i18n.changeLanguage(appLanguage).catch(() => {});
    }
  }, [appLanguage]);

  // Initialize Firebase notifications when user is logged in
  useEffect(() => {
    const initializeFirebaseNotifications = async () => {
      if (currentUser?.id) {
        console.log('🚀 Initializing Firebase notifications for user:', currentUser.id);
        const success = await firebaseNotificationService.initialize(currentUser.id);
        if (success) {
          console.log('✅ Firebase notifications initialized successfully');
        } else {
          console.log('❌ Failed to initialize Firebase notifications');
        }
      }
    };

    initializeFirebaseNotifications();
  }, [currentUser?.id]);

  // ברירת מחדל ליישור טקסטים לפי השפה (עברית → ימין), מבלי לפגוע ב־text-center מקומי
  useEffect(() => {
    const isRTL = appLanguage === 'he';

    // הגדרת ברירת מחדל ל־Text
    (Text as any).defaultProps = {
      ...((Text as any).defaultProps || {}),
      style: [{ textAlign: isRTL ? 'right' : 'left' }],
    };

    // הגדרת ברירת מחדל ל־TextInput
    (TextInput as any).defaultProps = {
      ...((TextInput as any).defaultProps || {}),
      style: [{ textAlign: isRTL ? 'right' : 'left' }],
    };
  }, [appLanguage]);

  function ThemedRoot() {
    const { activeScheme, theme } = useTheme();
    useEffect(() => {
      (async () => {
        try {
          const raw = await AsyncStorage.getItem('__pendingRoute__');
          if (!raw) return;
          const data = JSON.parse(raw);
          const fresh = Date.now() - (data.ts ?? 0) < 60000;
          if (fresh && navigationRef.isReady()) {
            navigationRef.navigate(data.name, data.params);
          }
        } catch {}
        finally {
          await AsyncStorage.removeItem('__pendingRoute__');
        }
      })();
    }, []);

    const navTheme: NavTheme =
      activeScheme === 'dark'
        ? {
            ...DarkTheme,
            colors: {
              ...DarkTheme.colors,
              background: theme.colors.background,
              card: theme.colors.card,
              text: theme.colors.text.primary,
              border: theme.colors.border.primary,
              primary: theme.colors.primary,
            },
          }
        : {
            ...DefaultTheme,
            colors: {
              ...DefaultTheme.colors,
              background: theme.colors.background,
              card: theme.colors.card,
              text: theme.colors.text.primary,
              border: theme.colors.border.primary,
              primary: theme.colors.primary,
            },
          };

    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <NavigationContainer ref={navigationRef} theme={navTheme}>
          <AppNavigator />
        </NavigationContainer>
        <StatusBar style={activeScheme === 'dark' ? 'light' : 'dark'} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <ThemedRoot />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
