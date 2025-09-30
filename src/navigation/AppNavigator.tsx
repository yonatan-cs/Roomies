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
import { isValidApartmentId, validateApartmentIdWithLogging, safeNavigate } from '../utils/navigation-helpers';

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
    let cancelled = false;

    const checkApartmentAccess = async () => {
      // אין משתמש? אל תעשה כלום
      if (!currentUser) {
        console.log('📭 AppNavigator: No current user');
        setHasApartment(false);
        setIsCheckingApartment(false);
        return;
      }

      // אם המשתמש חדש / אין apartment_id -> דלג על הבדיקה
      if (!currentUser.current_apartment_id) {
        console.log('👤 AppNavigator: No apartment_id on user — skipping apartment check (will show Create/Join).', {
          uid: currentUser.id,
          hasLocalApartment: !!currentApartment?.id
        });

        // ודא שהסטייט הרלוונטי מתעדכן נכון:
        setHasApartment(false);
        setIsCheckingApartment(false);
        return;
      }

      // יש apartment_id — המשך בבדיקה הרגילה
      try {
        setIsCheckingApartment(true);
        console.log('🚪 AppNavigator: Starting apartment check for', currentUser.current_apartment_id);
        
        console.log('🔍 AppNavigator: Current apartment state:', {
          currentApartmentId: currentUser.current_apartment_id,
          localApartmentId: currentApartment?.id,
          localApartmentName: currentApartment?.name
        });
        
        // Check if user has valid apartment ID using enhanced validation
        const apartmentIdValidation = validateApartmentIdWithLogging(
          currentUser.current_apartment_id, 
          'AppNavigator'
        );
        
        // If user has no valid apartment ID, route to Welcome immediately
        if (!apartmentIdValidation.isValid && !currentApartment?.id) {
          console.log('📭 AppNavigator: No valid apartment ID detected for user – routing to Welcome');
          console.log('📭 AppNavigator: Validation reason:', apartmentIdValidation.reason);
          setHasApartment(false);
          if (!cancelled) setIsCheckingApartment(false);
          return;
        }
        
        // User has apartment - handle normally
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
      } finally {
        if (!cancelled) setIsCheckingApartment(false);
      }
    };

    checkApartmentAccess();

    return () => { cancelled = true; };
  }, [currentUser?.id, currentUser?.current_apartment_id, currentApartment?.id]); // Listen to apartment changes

  // Determine routing based on presence of a valid apartment id
  const hasValidApartmentId = !!currentApartment?.id || isValidApartmentId(currentUser?.current_apartment_id);
  const showWelcome = !currentUser || !hasValidApartmentId;

  // If we already know there's no apartment, route to Welcome immediately (avoid indefinite spinner)
  if (!currentUser || !hasValidApartmentId) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
      </Stack.Navigator>
    );
  }

  // Optional loading while verifying apartment access for users who do have an apartment id
  if (isCheckingApartment) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' }}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={{ marginTop: 16, color: '#666' }}>טוען...</Text>
      </View>
    );
  }
  
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