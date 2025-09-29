import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
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
import GroupDebtsScreen from '../screens/GroupDebtsScreen';

import { useStore } from '../state/store';
import { getApartmentContext } from '../services/firestore-service';
import { useTranslation } from 'react-i18next';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function MainTabs() {
  const { t } = useTranslation();
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
        options={{ title: t('tabs.dashboard') }}
      />
      <Tab.Screen 
        name="Cleaning" 
        component={CleaningScreen}
        options={{ title: t('tabs.cleaning') }}
      />
      <Tab.Screen 
        name="Budget" 
        component={BudgetScreen}
        options={{ title: t('tabs.budget') }}
      />
      <Tab.Screen 
        name="Shopping" 
        component={ShoppingScreen}
        options={{ title: t('tabs.shopping') }}
      />
      <Tab.Screen 
        name="Settings" 
        component={SettingsScreen}
        options={{ title: t('tabs.settings') }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { i18n, t } = useTranslation();
  const currentUser = useStore(state => state.currentUser);
  const currentApartment = useStore(state => state.currentApartment);
  const [isCheckingApartment, setIsCheckingApartment] = useState(true);
  const [hasApartment, setHasApartment] = useState(false);

  // Check if user has an apartment on mount and when apartment state changes
  useEffect(() => {
    const checkApartmentAccess = async () => {
      console.log('🚪 AppNavigator: Starting apartment check...');
      setIsCheckingApartment(true);
      try {
        if (currentUser?.id) {
          console.log('🔍 AppNavigator: Checking apartment access for user:', currentUser.id);
          console.log('🔍 AppNavigator: Current apartment state:', {
            currentApartmentId: currentUser.current_apartment_id,
            localApartmentId: currentApartment?.id,
            localApartmentName: currentApartment?.name
          });
          
          // If user has no apartment yet, don't call getApartmentContext; show Welcome
          if (!currentUser.current_apartment_id && !currentApartment?.id) {
            console.log('📭 AppNavigator: No apartment detected for user – routing to Welcome');
            setHasApartment(false);
            setIsCheckingApartment(false);
            console.log('✅ AppNavigator: Early return - no apartment, routing to Welcome immediately');
            return;
          }
          
          // User has apartment - handle normally
          try {
            const apartmentContext = await getApartmentContext();
            console.log('✅ AppNavigator: User has apartment:', apartmentContext.aptId);
            setHasApartment(true);

            // Load apartment-dependent data only when we have a real apartment
            try {
              await Promise.all([
                useStore.getState().refreshApartmentMembers?.(),
                useStore.getState().loadShoppingItems?.(),
                useStore.getState().loadCleaningTask?.(),
              ]);
            } catch (refreshError) {
              console.log('⚠️ AppNavigator: Some data refresh failed:', refreshError);
            }
          } catch (apartmentError) {
            console.log('📭 AppNavigator: Error getting apartment context:', apartmentError);
            setHasApartment(false);
          }
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
  }, [currentUser?.id, currentUser?.current_apartment_id, currentApartment?.id]); // Listen to apartment changes

  // Show loading while checking apartment access
  if (isCheckingApartment) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' }}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={{ marginTop: 16, color: '#666' }}>טוען...</Text>
      </View>
    );
  }

  // Show welcome screen if no user or no apartment (require valid apartment id explicitly)
  const hasValidApartmentId = !!currentApartment?.id || !!currentUser?.current_apartment_id;
  const showWelcome = !currentUser || !hasValidApartmentId || !hasApartment;
  
  console.log('🚪 AppNavigator: Navigation decision:', {
    showWelcome,
    hasUser: !!currentUser,
    hasApartment,
    hasCurrentApartment: !!currentApartment,
    hasValidApartmentId,
    userId: currentUser?.id,
    apartmentId: currentApartment?.id
  });

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
              title: t('budget.addExpense'),
              headerTitleAlign: 'center'
            }}
          />
          <Stack.Screen 
            name="GroupDebts" 
            component={GroupDebtsScreen}
            options={{ 
              headerShown: false
            }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}