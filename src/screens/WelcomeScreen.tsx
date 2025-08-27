import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Keyboard,
  TouchableWithoutFeedback,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../state/store';
import LoginScreen from './LoginScreen';
import RegisterScreen from './RegisterScreen';
import ForgotPasswordScreen from './ForgotPasswordScreen';
import { firebaseAuth } from '../services/firebase-auth';
import { firestoreService } from '../services/firestore-service';

export default function WelcomeScreen() {
  const [mode, setMode] = useState<'select' | 'auth' | 'login' | 'register' | 'forgot-password' | 'create' | 'join'>('select');
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'forgot-password'>('login');
  const [apartmentName, setApartmentName] = useState('');
  const [userName, setUserName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);

  const { setCurrentUser, createApartment, joinApartment } = useStore();

  // Check for existing user session on component mount
  useEffect(() => {
    checkUserSession();
  }, []);

  const checkUserSession = async () => {
    try {
      console.log('Checking user session...');
      const authUser = await firebaseAuth.restoreUserSession();
      if (authUser) {
        console.log('Auth user found, getting user data...');
        // Get user data from Firestore
        const userData = await firestoreService.getUser(authUser.localId);
        if (userData) {
          console.log('User data found, getting current apartment...');
          // Get user's current apartment based on membership
          const currentApartment = await firestoreService.getUserCurrentApartment(authUser.localId);
          console.log('Current apartment from Firestore:', currentApartment);
          
          const user = {
            id: authUser.localId,
            email: authUser.email,
            name: userData.full_name,
            phone: userData.phone,
            current_apartment_id: currentApartment?.id,
          };
          setCurrentUser(user);
          
          // If user has apartment, set it in local state
          if (currentApartment) {
            console.log('Setting apartment in local state:', {
              id: currentApartment.id,
              name: currentApartment.name,
              invite_code: currentApartment.invite_code,
            });
            
            // Update local apartment state
            useStore.setState({
              currentApartment: {
                id: currentApartment.id,
                name: currentApartment.name,
                invite_code: currentApartment.invite_code,
                members: [], // Will be loaded separately if needed
                createdAt: new Date(),
              }
            });
          }
        }
      }
    } catch (error) {
      console.error('Session restore error:', error);
    } finally {
      setInitializing(false);
    }
  };

  const handleLogin = async (user: any) => {
    setCurrentUser(user);
    setMode('select');
  };

  const handleRegister = async (user: any) => {
    setCurrentUser(user);
    setMode('select');
  };

  const handleCreateApartment = async () => {
    setError(null);
    if (!apartmentName.trim()) {
      setError('אנא הכנס שם דירה');
      return;
    }

    setLoading(true);
    try {
      console.log('Starting apartment creation...');
      
      // Create apartment in Firestore via Cloud Function
      const apartmentData = {
        name: apartmentName.trim(),
        description: '',
      };
      
      console.log('Creating apartment with data:', apartmentData);
      const apartment = await firestoreService.createApartment(apartmentData);
      console.log('Apartment created:', apartment);
      
      // Get current user
      const currentUser = useStore.getState().currentUser;
      if (!currentUser) {
        throw new Error('User not authenticated');
      }
      
      // Update local state - current_apartment_id is managed through apartmentMembers
      const updatedUser = { ...currentUser, current_apartment_id: apartment.id };
      setCurrentUser(updatedUser);
      
      // Create apartment object for local state
      const localApartment = {
        id: apartment.id,
        name: apartment.name,
        invite_code: apartment.invite_code,
        members: [updatedUser], // Add current user as member
        createdAt: new Date(),
      };
      
      console.log('Setting local apartment:', localApartment);
      useStore.setState({ currentApartment: localApartment });
      
      console.log('Apartment creation completed successfully');
      
    } catch (error: any) {
      console.error('Create apartment error:', error);
      console.error('Error stack:', error.stack);
      setError(error.message || 'שגיאה ביצירת הדירה');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinApartment = async () => {
    setError(null);
    if (!joinCode.trim()) {
      setError('אנא הכנס קוד דירה');
      return;
    }

    setLoading(true);
    try {
      // Join apartment using Cloud Function
      const apartment = await firestoreService.joinApartmentByInviteCode(joinCode.trim().toUpperCase());
      
      if (!apartment) {
        throw new Error('קוד דירה לא נמצא. וודא שהקוד נכון ושהדירה קיימת.');
      }

      // Get current user
      const currentUser = useStore.getState().currentUser;
      if (!currentUser) {
        throw new Error('User not authenticated');
      }
      
      // Update local state - current_apartment_id is managed through apartmentMembers
      const updatedUser = { ...currentUser, current_apartment_id: apartment.id };
      setCurrentUser(updatedUser);
      
      // Create apartment object for local state
      const localApartment = {
        id: apartment.id,
        name: apartment.name,
        invite_code: apartment.invite_code,
        members: [updatedUser], // Will be loaded properly later
        createdAt: new Date(),
      };
      
      console.log('Setting local apartment after join:', localApartment);
      useStore.setState({ currentApartment: localApartment });
      
    } catch (error: any) {
      console.error('Join apartment error:', error);
      setError(error.message || 'שגיאה בהצטרפות לדירה');
    } finally {
      setLoading(false);
    }
  };

  // Show loading spinner while initializing
  if (initializing) {
    return (
      <View className="flex-1 bg-white justify-center items-center">
        <ActivityIndicator size="large" color="#007AFF" />
        <Text className="text-gray-600 mt-4">טוען...</Text>
      </View>
    );
  }

  // Authentication screens
  if (mode === 'login') {
    return (
      <LoginScreen
        onLogin={handleLogin}
        onSwitchToRegister={() => setMode('register')}
        onSwitchToForgotPassword={() => setMode('forgot-password')}
      />
    );
  }

  if (mode === 'register') {
    return (
      <RegisterScreen
        onRegister={handleRegister}
        onSwitchToLogin={() => setMode('login')}
      />
    );
  }

  if (mode === 'forgot-password') {
    return (
      <ForgotPasswordScreen
        onBack={() => setMode('login')}
      />
    );
  }

  // Main selection screen
  if (mode === 'select') {
    const currentUser = useStore.getState().currentUser;
    
    // If no user is authenticated, show auth options
    if (!currentUser) {
      return (
        <View className="flex-1 bg-white px-6">
          <View className="flex-1 justify-center">
            <View className="items-center mb-12">
              <Ionicons name="home" size={80} color="#007AFF" />
              <Text className="text-3xl font-bold text-gray-900 mt-4 text-center">
                דירת שותפים
              </Text>
              <Text className="text-lg text-gray-600 mt-2 text-center">
                ניהול חכם לחיים משותפים
              </Text>
            </View>

            <View className="space-y-4">
              <Pressable
                onPress={() => setMode('login')}
                className="bg-blue-500 py-4 px-6 rounded-xl flex-row items-center justify-center"
              >
                <Ionicons name="log-in-outline" size={24} color="white" />
                <Text className="text-white text-lg font-semibold mr-2">התחבר</Text>
              </Pressable>

              <Pressable
                onPress={() => setMode('register')}
                className="bg-gray-100 py-4 px-6 rounded-xl flex-row items-center justify-center"
              >
                <Ionicons name="person-add-outline" size={24} color="#007AFF" />
                <Text className="text-blue-500 text-lg font-semibold mr-2">הרשם</Text>
              </Pressable>
            </View>
          </View>
        </View>
      );
    }

    // User is authenticated, show apartment options
    return (
      <View className="flex-1 bg-white px-6">
        <View className="flex-1 justify-center">
          <View className="items-center mb-12">
            <Ionicons name="home" size={80} color="#007AFF" />
            <Text className="text-3xl font-bold text-gray-900 mt-4 text-center">
              שלום {currentUser.name}!
            </Text>
            <Text className="text-lg text-gray-600 mt-2 text-center">
              ניהול חכם לחיים משותפים
            </Text>
          </View>

          <View className="space-y-4">
            <Pressable
              onPress={() => setMode('create')}
              className="bg-blue-500 py-4 px-6 rounded-xl flex-row items-center justify-center"
            >
              <Ionicons name="add-circle-outline" size={24} color="white" />
              <Text className="text-white text-lg font-semibold mr-2">יצירת דירה חדשה</Text>
            </Pressable>

            <Pressable
              onPress={() => setMode('join')}
              className="bg-gray-100 py-4 px-6 rounded-xl flex-row items-center justify-center"
            >
              <Ionicons name="people-outline" size={24} color="#007AFF" />
              <Text className="text-blue-500 text-lg font-semibold mr-2">הצטרפות לדירה קיימת</Text>
            </Pressable>

            <Pressable
              onPress={async () => {
                try {
                  await firebaseAuth.signOut();
                  setCurrentUser(undefined as any);
                } catch (error) {
                  console.error('Sign out error:', error);
                }
              }}
              className="bg-red-100 py-3 px-6 rounded-xl flex-row items-center justify-center mt-8"
            >
              <Ionicons name="log-out-outline" size={20} color="#EF4444" />
              <Text className="text-red-500 text-base font-medium mr-2">התנתק</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <ScrollView className="flex-1 px-6">
          <View className="pt-16 pb-8">
            <Pressable onPress={() => setMode('select')} className="flex-row items-center mb-6">
              <Ionicons name="arrow-back" size={24} color="#007AFF" />
              <Text className="text-blue-500 text-lg mr-2">חזור</Text>
            </Pressable>

            <Text className="text-2xl font-bold text-gray-900 text-center mb-8">
              {mode === 'create' ? 'יצירת דירה חדשה' : 'הצטרפות לדירה'}
            </Text>

            <View className="space-y-4">
              {mode === 'create' && (
                <View>
                  <Text className="text-gray-700 text-base mb-2">שם הדירה</Text>
                  <TextInput
                    value={apartmentName}
                    onChangeText={setApartmentName}
                    placeholder="דירת השותפים שלנו"
                    className="border border-gray-300 rounded-xl px-4 py-3 text-base"
                    textAlign="right"
                    editable={!loading}
                  />
                </View>
              )}

              {mode === 'join' && (
                <View>
                  <Text className="text-gray-700 text-base mb-2">קוד דירה</Text>
                  <TextInput
                    value={joinCode}
                    onChangeText={setJoinCode}
                    placeholder="הכנס קוד דירה"
                    className="border border-gray-300 rounded-xl px-4 py-3 text-base"
                    textAlign="center"
                    autoCapitalize="characters"
                    maxLength={6}
                    editable={!loading}
                  />
                </View>
              )}
            </View>

            {error && (
              <Text className="text-red-600 text-center mt-4">{error}</Text>
            )}

            <Pressable
              onPress={mode === 'create' ? handleCreateApartment : handleJoinApartment}
              className={`py-4 px-6 rounded-xl mt-8 ${
                loading ? 'bg-gray-400' : 'bg-blue-500'
              }`}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white text-lg font-semibold text-center">
                  {mode === 'create' ? 'יצירת הדירה' : 'הצטרפות'}
                </Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}
