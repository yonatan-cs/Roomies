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
import { getApartmentContext } from '../services/firestore-service';

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
  const currentUser = useStore(state => state.currentUser);
  const currentApartment = useStore(state => state.currentApartment);
  const [isCheckingApartment, setIsCheckingApartment] = useState(true);
  const [hasApartment, setHasApartment] = useState(false);

  // Check if user has an apartment on mount
  useEffect(() => {
    const checkApartmentAccess = async () => {
      try {
        if (currentUser?.id) {
          console.log('🔍 AppNavigator: Checking apartment access for user:', currentUser.id);
          
          // Try to get apartment context
          const apartmentContext = await getApartmentContext();
          console.log('✅ AppNavigator: User has apartment:', apartmentContext.aptId);
          setHasApartment(true);
        } else {
          console.log('📭 AppNavigator: No current user');
          setHasApartment(false);
        }
      } catch (error) {
        console.log('📭 AppNavigator: User has no apartment or error:', error);
        setHasApartment(false);
      } finally {
        setIsCheckingApartment(false);
      }
    };

    checkApartmentAccess();
  }, [currentUser?.id]);

  // Show loading while checking apartment access
  if (isCheckingApartment) {
    return null; // Or a loading screen
  }

  // Show welcome screen if no user or no apartment
  const showWelcome = !currentUser || !hasApartment || !currentApartment;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {showWelcome ? (
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