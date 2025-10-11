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
import { getApartmentContext, firestoreService } from '../services/firestore-service';
import { useTranslation } from 'react-i18next';
import { isValidApartmentId, validateApartmentIdWithLogging, safeNavigate } from '../utils/navigation-helpers';
import { useTheme } from '../theme/ThemeProvider';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function MainTabs() {
  const { t } = useTranslation();
  const { activeScheme, theme } = useTheme();
  const currentUser = useStore(state => state.currentUser);
  const currentApartment = useStore(state => state.currentApartment);

  // Load apartment-dependent data when MainTabs mounts
  useEffect(() => {
    if (currentUser && currentApartment?.id) {
      console.log('🏠 MainTabs: Loading apartment data for', currentApartment.id);
      
      // Load apartment-dependent data
      const loadApartmentData = async () => {
        try {
          await Promise.all([
            useStore.getState().refreshApartmentMembers?.(),
            useStore.getState().loadShoppingItems?.(),
            useStore.getState().loadCleaningTask?.(),
            useStore.getState().loadExpenses?.(),
            useStore.getState().loadDebtSettlements?.(),
            useStore.getState().loadCleaningChecklist?.(),
          ]);
          console.log('✅ MainTabs: Apartment data loaded successfully');
        } catch (error) {
          console.log('⚠️ MainTabs: Some apartment data failed to load:', error);
        }
      };

      loadApartmentData();
    }
  }, [currentUser?.id, currentApartment?.id]);

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
        tabBarInactiveTintColor: activeScheme === 'dark' ? '#ffffff' : '#6b7280',
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
  // Subscribe only to the fields needed for routing to prevent unnecessary re-renders
  const currentUserId = useStore(state => state.currentUser?.id);
  const currentUserApartmentId = useStore(state => state.currentUser?.current_apartment_id);
  const currentApartment = useStore(state => state.currentApartment);

  // Listen for user removal from apartment (when current_apartment_id becomes null in Firestore)
  useEffect(() => {
    // Only set up listener if user has an apartment
    if (!currentUserId || !currentUserApartmentId) {
      return;
    }

    console.log('👂 Setting up user removal listener for user:', currentUserId);

    let isMounted = true;
    let timeoutId: NodeJS.Timeout | null = null;

    // Poll user profile to check if they were removed
    const checkUserProfile = async () => {
      try {
        const userDoc = await firestoreService.getUser(currentUserId);
        
        if (!isMounted) return;

        // Check if user was removed (apartment_id became null in Firestore)
        const firestoreApartmentId = userDoc?.current_apartment_id;
        const localApartmentId = useStore.getState().currentUser?.current_apartment_id;

        console.log('🔍 User removal check:', {
          firestoreApartmentId,
          localApartmentId,
          userWasRemoved: firestoreApartmentId === null && localApartmentId !== null
        });

        // If Firestore says null but we still have apartment_id locally, user was removed
        if (firestoreApartmentId === null && localApartmentId) {
          console.log('🚨 User was removed from apartment, clearing local state');
          
          // Clear apartment-related state
          useStore.setState({
            currentUser: {
              ...useStore.getState().currentUser!,
              current_apartment_id: null
            },
            currentApartment: undefined,
            cleaningTask: undefined,
            expenses: [],
            shoppingItems: [],
            checklistItems: [],
          });
        }

        // Schedule next check
        if (isMounted) {
          timeoutId = setTimeout(checkUserProfile, 10000); // Check every 10 seconds
        }
      } catch (error) {
        console.error('❌ Error checking user profile:', error);
        // Don't clear state on error - might just be network issue
        
        // Retry after a longer delay on error
        if (isMounted) {
          timeoutId = setTimeout(checkUserProfile, 30000);
        }
      }
    };

    // Start checking
    checkUserProfile();

    // Cleanup
    return () => {
      console.log('🧹 Cleaning up user removal listener');
      isMounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [currentUserId, currentUserApartmentId]);

  // Determine routing based on presence of a valid apartment id
  // Check for null/undefined apartment_id (new users) or invalid apartment_id
  const hasValidApartmentId = !!currentApartment?.id || 
    (typeof currentUserApartmentId === 'string' && currentUserApartmentId.trim().length > 0 && isValidApartmentId(currentUserApartmentId));
  const showWelcome = !currentUserId || !hasValidApartmentId;

  // If we already know there's no apartment, route to Welcome immediately
  if (!currentUserId || !hasValidApartmentId) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
      </Stack.Navigator>
    );
  }
  
  console.log('🚪 AppNavigator: Navigation decision:', {
    showWelcome,
    hasUser: !!currentUserId,
    hasCurrentApartment: !!currentApartment,
    hasValidApartmentId,
    userId: currentUserId,
    apartmentId: currentApartment?.id
  });

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
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
    </Stack.Navigator>
  );
}