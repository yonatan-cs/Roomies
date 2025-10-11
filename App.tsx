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
// FCM disabled for Expo Go compatibility - restore before App Store deployment
// import { fcmNotificationService } from './src/services/fcm-notification-service';
import { isRTL } from './src/utils/rtl';
import Animated from 'react-native-reanimated';
import { ThemedAlertProvider } from './src/components/ThemedAlert';
import { Asset } from 'expo-asset';
import { LoadingScreen } from './src/components/LoadingScreen';

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
  const [hasRequestedPermissions, setHasRequestedPermissions] = useState(false);

  useEffect(() => {
    if (i18n.language !== appLanguage) {
      i18n.changeLanguage(appLanguage).catch(() => {});
    }
  }, [appLanguage]);

  // FCM notifications disabled for Expo Go compatibility
  // Restore this useEffect before App Store deployment
  useEffect(() => {
    console.log('⚠️ FCM notifications disabled for Expo Go compatibility');
    setHasRequestedPermissions(true);
    
    /* FCM RESTORE: Uncomment this block before App Store deployment
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
    */
  }, []);

  // FCM notifications disabled for Expo Go compatibility
  // Restore this useEffect before App Store deployment
  useEffect(() => {
    /* FCM RESTORE: Uncomment this block before App Store deployment
    const initializeNotifications = async () => {
      if (currentUser?.id && hasRequestedPermissions) {
        console.log('🚀 Initializing FCM notifications for user:', currentUser.id);
        // Fire-and-forget to avoid blocking app startup
        void fcmNotificationService.initialize(currentUser.id);
      }
    };

    initializeNotifications();
    */
  }, [currentUser?.id, hasRequestedPermissions]);

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

    // Handle loading and fade-in animation
    useEffect(() => {
      const prepare = async () => {
        try {
          // Preload logo image to ensure it's cached
          await Asset.loadAsync(require('./assets/splash-logo.png'));
          
          // Minimal delay - just enough for smooth transition
          await new Promise(resolve => setTimeout(resolve, 500));
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
        // Start fade-in animation - quick transition
        opacity.value = withTiming(1, { duration: 300 });
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

    // Show loading screen while app is not ready
    if (!appIsReady) {
      return <LoadingScreen />;
    }

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
          <ThemedAlertProvider>
            <ThemedRoot />
          </ThemedAlertProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
