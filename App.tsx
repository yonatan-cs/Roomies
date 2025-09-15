import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { NavigationContainer } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { View } from "react-native";
import AppNavigator from "./src/navigation/AppNavigator";
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

  const writingDirection = appLanguage === 'he' ? 'rtl' : 'ltr';

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <View style={{ flex: 1, direction: writingDirection as any }}>
          <NavigationContainer>
            <AppNavigator />
            <StatusBar style="auto" />
          </NavigationContainer>
        </View>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
