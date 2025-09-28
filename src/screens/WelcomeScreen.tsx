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
import { ThemedCard } from '../theme/components/ThemedCard';
import { ThemedText } from '../theme/components/ThemedText';
import { useThemedStyles } from '../theme/useThemedStyles';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../state/store';
import AuthScreen from './AuthScreen';
import { firebaseAuth } from '../services/firebase-auth';
import { firestoreService } from '../services/firestore-service';
import { useTranslation } from 'react-i18next';
import { Screen } from '../components/Screen';
import { getDisplayName } from '../utils/userDisplay';

export default function WelcomeScreen() {
  const { t } = useTranslation();
  const themed = useThemedStyles(tk => ({
    surfaceBg: { backgroundColor: tk.colors.surface },
    textSecondary: { color: tk.colors.text.secondary },
    borderColor: { borderColor: tk.colors.border.primary },
  }));
  const [mode, setMode] = useState<'select' | 'create' | 'join'>('select');
  const [apartmentName, setApartmentName] = useState('');
  const [userName, setUserName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);

  const { setCurrentUser, createApartment, joinApartment } = useStore();

  // Enhanced polling utility with backoff and limits
  const startUserPoll = (uid: string, onFound: (userDoc: any) => void, opts = { intervalMs: 2500, maxAttempts: 40 }) => {
    let stopped = false;
    let attempts = 0;
    let timeoutId: any;
    
    const tick = async () => {
      if (stopped) return;
      attempts++;
      try {
        console.log(`poll: tick #${attempts} for user ${uid}`);
        const userDoc = await firestoreService.getUser(uid);
        console.log('poll: user doc:', userDoc && { 
          id: userDoc.id, 
          current_apartment_id: userDoc.current_apartment_id || userDoc.apartment?.id 
        });
        
        if (userDoc) {
          const aptId = userDoc.current_apartment_id || userDoc.apartment?.id;
          if (aptId) {
            onFound(userDoc);
            stopped = true;
            console.log('poll: apartment found, stopping poll', aptId);
            return;
          }
        }
      } catch (e) {
        console.warn('poll: fetch error', e);
      }
      
      if (attempts >= (opts.maxAttempts ?? 40)) {
        stopped = true;
        console.log('poll: max attempts reached, stopping');
        return;
      }
      
      // Exponential backoff with cap
      const wait = Math.min((opts.intervalMs ?? 2500) * Math.pow(1.5, attempts - 1), 15000);
      if (!stopped) {
        timeoutId = setTimeout(tick, wait);
      }
    };
    
    console.log('poll: start');
    tick();
    
    return () => { 
      stopped = true; 
      if (timeoutId) clearTimeout(timeoutId);
      console.log('poll: manual stop'); 
    };
  };

  // Check for existing user session on component mount
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    (async () => { cleanup = await checkUserSession(); })();
    return () => { cleanup?.(); };
  }, []);

  const checkUserSession = async (): Promise<(() => void) | undefined> => {
    console.log('Checking user session...');
    // small timeout wrapper so restoreUserSession לא תיתקע לנצח
    const withTimeout = <T,>(p: Promise<T>, ms = 5000) =>
      Promise.race([
        p,
        new Promise<T>((_, rej) => setTimeout(() => rej(new Error('restoreUserSession timeout')), ms))
      ]);

    try {
      const authUser = await withTimeout(firebaseAuth.restoreUserSession(), 7000);

      if (!authUser) {
        console.log('No authenticated user, showing Auth screen');
        setInitializing(false);
        return;
      }

      console.log('Auth user found, creating minimal local session...');
      // small stabilization pause
      await new Promise(resolve => setTimeout(resolve, 200));

      // try/catch around getUser so errors there לא יפסיקו המשך הזרימה
      let userData = null;
      try {
        console.log('Getting user data...');
        userData = await firestoreService.getUser(authUser.localId);
      } catch (e) {
        console.warn('getUser failed (will continue with minimal user):', e);
      }

      const baseUser = {
        id: authUser.localId,
        email: authUser.email,
        name: userData?.full_name,
        display_name: userData?.display_name || userData?.full_name,
        phone: userData?.phone,
        current_apartment_id: undefined as string | undefined,
      };

      // Set user immediately so UI can proceed to Join/Create if needed
      setCurrentUser(baseUser);
      // Make sure UI is not stuck on "initializing"
      setInitializing(false);
      // Ensure user sees choice screen
      setMode('select');

      // Background: resolve apartment without blocking UI
      (async () => {
        try {
          console.log('Background: resolving current apartment for user...');
          const currentApartment = await firestoreService.getUserCurrentApartment(authUser.localId);
          console.log('Background: apartment lookup result:', currentApartment);

          if (currentApartment) {
            // update user with apartment id
            useStore.setState(state => ({
              currentUser: state.currentUser ? { ...state.currentUser, current_apartment_id: currentApartment.id } : state.currentUser,
            }));

            console.log('Setting apartment in local state:', {
              id: currentApartment.id,
              name: currentApartment.name,
              invite_code: currentApartment.invite_code,
            });

            useStore.setState({
              currentApartment: {
                id: currentApartment.id,
                name: currentApartment.name,
                invite_code: currentApartment.invite_code,
                members: [], // will be loaded later
                createdAt: new Date(),
              }
            });
          } else {
            console.log('no apartment for profile — routing user to Join/Create');
            // Explicitly ensure UI shows join/create path
            // If you want to open the "join" tab directly: setMode('join')
            // but keep default 'select' so user can pick
            setMode('select');
          }
        } catch (bgErr) {
          console.warn('Background apartment resolution failed:', bgErr);
          // keep user on select so they can continue
          setMode('select');
        }
      })();

      // Attach enhanced polling listener to auto-advance when user gains apartment
      let stopPolling: (() => void) | undefined;
      try {
        stopPolling = startUserPoll(authUser.localId, async (userDoc) => {
          console.log('poll: found apartment in user doc:', userDoc);
          const aptId = userDoc.current_apartment_id || userDoc.apartment?.id;
          if (aptId) {
            try {
              const apartment = await firestoreService.getApartment(aptId);
              // Use functional updates for safer state management
              useStore.setState(state => ({
                currentUser: state.currentUser ? { ...state.currentUser, current_apartment_id: aptId } : state.currentUser,
                currentApartment: {
                  id: apartment.id,
                  name: apartment.name,
                  invite_code: apartment.invite_code,
                  members: [],
                  createdAt: new Date(),
                }
              }));
              console.log('poll: apartment assigned, updating store');
            } catch (e) {
              console.warn('poll: failed to load apartment', e);
            }
          }
        });
      } catch (e) {
        console.warn('Could not start user poll', e);
      }

      return stopPolling;

    } catch (error) {
      console.error('Session restore error:', error);
      // make sure UI is usable even on error
      setInitializing(false);
      setMode('select');
    }
  };

  const handleAuthSuccess = async (user: any) => {
    setCurrentUser(user);
    setMode('select');
  };

  const handleCreateApartment = async () => {
    setError(null);
    if (!apartmentName.trim()) {
      setError(t('welcome.errors.enterAptName'));
      return;
    }

    setLoading(true);
    try {
      console.log('Starting apartment creation...');
      
      // Create apartment in Firestore
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

      console.log('Joining apartment as admin...');
      // Join the apartment as admin
      await firestoreService.joinApartment(apartment.id, currentUser.id);
      
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
      
      // Give a moment for the AppNavigator to react to state changes
      await new Promise(resolve => setTimeout(resolve, 100));
      
      console.log('Apartment creation completed successfully');
      
    } catch (error: any) {
      console.error('Create apartment error:', error);
      console.error('Error stack:', error.stack);
      setError(error.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const handleJoinApartment = async () => {
    setError(null);
    if (!joinCode.trim()) {
      setError(t('welcome.errors.enterAptCode'));
      return;
    }

    setLoading(true);
    try {
      console.log('🚀 Starting apartment join process...');
      
      // Step 1: Check authentication first
      const currentUser = useStore.getState().currentUser;
      console.log('🧑‍💻 Current user check:', currentUser ? `${currentUser.id} (${currentUser.email})` : 'NULL');
      console.log('👤 Current user details:', {
        id: currentUser?.id,
        email: currentUser?.email,
        name: currentUser?.name
      });
      
      if (!currentUser) {
        throw new Error('NOT_AUTH');
      }

      // Step 2: Wait a moment for authentication to stabilize after login
      console.log('⏳ Waiting for authentication to stabilize...');
      await new Promise(resolve => setTimeout(resolve, 500));

      console.log(`🔍 Attempting to join apartment with code: "${joinCode.trim()}"`);
      
      // Step 3: Use the new joinApartmentByInviteCode function
      const apartment = await firestoreService.joinApartmentByInviteCode(joinCode.trim().toUpperCase());
      
      console.log(`🏠 Successfully joined apartment: ${apartment.name} (ID: ${apartment.id})`);
      
      // Step 5: Update local state - current_apartment_id is managed through apartmentMembers
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
      
      console.log('🏠 Setting local apartment after join:', {
        id: localApartment.id,
        name: localApartment.name,
        invite_code: localApartment.invite_code,
        memberCount: localApartment.members.length
      });
      useStore.setState({ currentApartment: localApartment });
      
      // Give a moment for the AppNavigator to react to state changes
      await new Promise(resolve => setTimeout(resolve, 100));
      
      console.log('🎉 Apartment join process completed successfully!');
      
    } catch (error: any) {
      console.error('❌ Join apartment error:', error);
      
      // Provide more specific error messages
      let errorMessage = t('common.error');
      
      if (error.message.includes('NOT_AUTH')) {
        errorMessage = t('welcome.errors.notAuthenticated');
      } else if (error.message.includes('Missing or insufficient permissions') || error.message.includes('PERMISSION_DENIED')) {
        errorMessage = t('welcome.errors.noPermission');
      } else if (error.message.includes('קוד דירה לא נמצא')) {
        errorMessage = t('welcome.errors.codeNotFound');
      } else if (error.message.includes('Network') || error.message.includes('בדיקת חיבור נכשלה')) {
        errorMessage = t('welcome.errors.networkIssue');
      } else if (error.message.includes('Token expired')) {
        errorMessage = t('welcome.errors.tokenExpired');
      } else if (error.message.includes('PERMISSION_DENIED_INVITE_READ')) {
        errorMessage = t('welcome.errors.noPermission');
      } else if (error.message.includes('PERMISSION_DENIED_MEMBER_CREATE')) {
        errorMessage = t('welcome.errors.noPermission');
      } else if (error.message.includes('PERMISSION_DENIED_SET_CURRENT_APT')) {
        errorMessage = t('welcome.errors.noPermission');
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Show loading spinner while initializing
  if (initializing) {
    return (
      <View className="flex-1 justify-center items-center" style={themed.surfaceBg}>
        <ActivityIndicator size="large" color="#007AFF" />
        <ThemedText style={[themed.textSecondary, { marginTop: 16 }]}>{t('welcome.loading')}</ThemedText>
      </View>
    );
  }


  // Main selection screen
  if (mode === 'select') {
    const currentUser = useStore.getState().currentUser;
    
    // If no user is authenticated, show auth screen
    if (!currentUser) {
      return (
        <AuthScreen onAuthSuccess={handleAuthSuccess} />
      );
    }

    // User is authenticated, show apartment options
    return (
      <Screen withPadding={true} scroll={false}>
        <View className="flex-1 justify-center">
          <View className="items-center mb-12">
            <Ionicons name="home" size={80} color="#007AFF" />
            <ThemedText className="text-3xl font-bold mt-4 text-center">
              {t('welcome.hello', { name: getDisplayName(currentUser) })}
            </ThemedText>
            <ThemedText className="text-lg mt-2 text-center" style={themed.textSecondary}>
              {t('welcome.subtitle')}
            </ThemedText>
          </View>

          <View className="space-y-4">
            <Pressable
              onPress={() => setMode('create')}
              className="bg-blue-500 py-4 px-6 rounded-xl flex-row items-center justify-center"
            >
              <Ionicons name="add-circle-outline" size={24} color="white" />
              <Text className="text-white text-lg font-semibold mr-2">{t('welcome.createApt')}</Text>
            </Pressable>

            <Pressable
              onPress={() => setMode('join')}
              className="py-4 px-6 rounded-xl flex-row items-center justify-center"
              style={themed.surfaceBg}
            >
              <Ionicons name="people-outline" size={24} color="#007AFF" />
              <Text className="text-blue-500 text-lg font-semibold mr-2">{t('welcome.joinApt')}</Text>
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
              <Text className="text-red-500 text-base font-medium mr-2">{t('welcome.signOut')}</Text>
            </Pressable>
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen withPadding={true} keyboardVerticalOffset={0}>
      <View className="pt-16 pb-8">
        <Pressable onPress={() => setMode('select')} className="flex-row items-center mb-6">
          <Ionicons name="arrow-back" size={24} color="#007AFF" />
          <Text className="text-blue-500 text-lg mr-2">{t('welcome.back')}</Text>
        </Pressable>

        <ThemedText className="text-2xl font-bold text-center mb-8">
          {mode === 'create' ? t('welcome.createTitle') : t('welcome.joinTitle')}
        </ThemedText>

        <View className="space-y-4">
          {mode === 'create' && (
            <View>
              <ThemedText className="text-base mb-2" style={themed.textSecondary}>{t('welcome.aptName')}</ThemedText>
              <TextInput
                value={apartmentName}
                onChangeText={setApartmentName}
                placeholder={t('welcome.aptNamePh')}
                className="border rounded-xl px-4 py-3 text-base"
                style={themed.borderColor}
                textAlign="right"
                editable={!loading}
              />
            </View>
          )}

          {mode === 'join' && (
            <View>
              <ThemedText className="text-base mb-2" style={themed.textSecondary}>{t('welcome.aptCode')}</ThemedText>
              <TextInput
                value={joinCode}
                onChangeText={setJoinCode}
                placeholder={t('welcome.aptCodePh')}
                className="border rounded-xl px-4 py-3 text-base"
                style={themed.borderColor}
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
              {mode === 'create' ? t('welcome.primaryCreate') : t('welcome.primaryJoin')}
            </Text>
          )}
        </Pressable>
      </View>
    </Screen>
  );
}
