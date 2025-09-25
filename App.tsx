import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { View, Text, TextInput } from "react-native";
import AppNavigator from "./src/navigation/AppNavigator";
import { ThemeProvider } from "./src/theme/ThemeProvider";
import "./src/i18n";
import { useEffect } from "react";
import { useStore } from "./src/state/store";
import i18n from "./src/i18n";

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

  useEffect(() => {
    if (i18n.language !== appLanguage) {
      i18n.changeLanguage(appLanguage).catch(() => {});
    }
  }, [appLanguage]);

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

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <View style={{ flex: 1 }}>
            <NavigationContainer>
              <AppNavigator />
              <StatusBar style="auto" />
            </NavigationContainer>
          </View>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
