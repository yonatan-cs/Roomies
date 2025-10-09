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
import { useEffect, useState, useCallback } from "react";
import { useStore } from "./src/state/store";
import i18n from "./src/i18n";
import { configureReanimatedLogger, useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { firebaseNotificationService } from './src/services/firebase-notification-service';
import { isRTL } from './src/utils/rtl';
import * as SplashScreen from 'expo-splash-screen';
import Animated from 'react-native-reanimated';

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
        // Fire-and-forget to avoid blocking app startup
        void firebaseNotificationService.initialize(currentUser.id);
      }
    };

    initializeFirebaseNotifications();
  }, [currentUser?.id]);

  // RTL text alignment is now handled by ThemedText and AppTextInput components
  // No need for global defaultProps which don't work reliably

  function ThemedRoot() {
    const { activeScheme, theme } = useTheme();
    const [appIsReady, setAppIsReady] = useState(false);
    const opacity = useSharedValue(0);

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

    // Handle splash screen and fade-in animation
    useEffect(() => {
      const prepare = async () => {
        try {
          // Wait a bit for theme and navigation to be ready
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (e) {
          console.warn('Error preparing app:', e);
        } finally {
          setAppIsReady(true);
        }
      };

      prepare();
    }, []);

    useEffect(() => {
      if (appIsReady) {
        // Start fade-in animation
        opacity.value = withTiming(1, { duration: 500 });
        
        // Hide splash screen after animation
        const hideSplash = async () => {
          try {
            await SplashScreen.hideAsync();
          } catch (e) {
            console.warn('Error hiding splash:', e);
          }
        };
        
        // Delay hiding splash to allow fade-in to complete
        setTimeout(hideSplash, 600);
      }
    }, [appIsReady]);

    // Handle language change without full app refresh
    useEffect(() => {
      // This effect runs when appLanguage changes, but we don't need to do anything
      // as the changeAppLanguage function handles navigation preservation
    }, [appLanguage]);

    const animatedStyle = useAnimatedStyle(() => ({
      opacity: opacity.value,
    }));

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
      <Animated.View style={[{ flex: 1, backgroundColor: theme.colors.background }, animatedStyle]}>
        <NavigationContainer ref={navigationRef} theme={navTheme}>
          <AppNavigator />
        </NavigationContainer>
        <StatusBar style={activeScheme === 'dark' ? 'light' : 'dark'} />
      </Animated.View>
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
