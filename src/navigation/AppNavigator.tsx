import React, { useEffect, useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

// Screens
import DashboardScreen from '../screens/DashboardScreen';
import CleaningScreen from '../screens/CleaningScreen';
import BudgetScreen from '../screens/BudgetScreen';
import ShoppingScreen from '../screens/ShoppingScreen';
import SettingsScreen from '../screens/SettingsScreen';
import WelcomeScreen from '../screens/WelcomeScreen';
import AddExpenseScreen from '../screens/AddExpenseScreen';

import { useStore } from '../state/store';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          if (route.name === 'Dashboard') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Cleaning') {
            iconName = focused ? 'brush' : 'brush-outline';
          } else if (route.name === 'Budget') {
            iconName = focused ? 'wallet' : 'wallet-outline';
          } else if (route.name === 'Shopping') {
            iconName = focused ? 'basket' : 'basket-outline';
          } else if (route.name === 'Settings') {
            iconName = focused ? 'settings' : 'settings-outline';
          } else {
            iconName = 'home-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: 'gray',
        headerShown: false,
      })}
    >
      <Tab.Screen 
        name="Dashboard" 
        component={DashboardScreen}
        options={{ title: 'בית' }}
      />
      <Tab.Screen 
        name="Cleaning" 
        component={CleaningScreen}
        options={{ title: 'ניקיון' }}
      />
      <Tab.Screen 
        name="Budget" 
        component={BudgetScreen}
        options={{ title: 'תקציב' }}
      />
      <Tab.Screen 
        name="Shopping" 
        component={ShoppingScreen}
        options={{ title: 'קניות' }}
      />
      <Tab.Screen 
        name="Settings" 
        component={SettingsScreen}
        options={{ title: 'הגדרות' }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const [booted, setBooted] = useState(false);
  const [hasApartment, setHasApartment] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        // Use the new getApartmentContext to check if user has apartment
        const { getApartmentContext } = await import('../services/firestore-service');
        const { aptId } = await getApartmentContext(); // Will throw if no session/apartment
        
        console.log('✅ AppNavigator: User has apartment:', aptId);
        setHasApartment(true);
        
        // Initial data loading (optional but recommended)
        try {
          const s = useStore.getState();
          await Promise.all([
            s.refreshApartmentMembers?.(),
            s.loadShoppingItems?.(),
            s.refreshCleaningTask?.(),
            s.loadExpenses?.(),
          ]);
          console.log('✅ AppNavigator: Initial data loaded successfully');
        } catch (loadError) {
          console.log('⚠️ AppNavigator: Some data loading failed:', loadError);
          // Don't fail navigation if data loading fails
        }
      } catch (error) {
        console.log('📭 AppNavigator: No session/apartment, showing Welcome:', error);
        setHasApartment(false);
      } finally {
        setBooted(true);
      }
    })();
  }, []);

  if (!booted) return null; // Or Splash screen

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!hasApartment ? (
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
      ) : (
        <>
          <Stack.Screen name="MainTabs" component={MainTabs} />
          <Stack.Screen 
            name="AddExpense" 
            component={AddExpenseScreen}
            options={{ 
              presentation: 'modal',
              headerShown: true,
              title: 'הוספת הוצאה',
              headerTitleAlign: 'center'
            }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}