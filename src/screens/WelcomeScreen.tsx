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
import { isValidApartmentId, fetchWithRetry, validateUserSession, safeNavigate } from '../utils/navigation-helpers';
import { changeAppLanguage } from '../utils/changeLanguage';

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
  const [timedOut, setTimedOut] = useState(false);

  const { setCurrentUser, createApartment, joinApartment, appLanguage, setAppLanguage } = useStore();

  // Enhanced polling utility with backoff and limits
  const startUserPoll = (uid: string, onFound: (userDoc: any) => void, opts = { intervalMs: 2500, maxAttempts: 40 }) => {
    let stopped = false;
    let attempts = 0;
    let timeoutId: any;
    let consecutiveNoToken = 0;
    const MAX_NO_TOKEN = 3;
    
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
      } catch (e: any) {
        const code = e?.code || e?.message;
        if (code === 'NO_ID_TOKEN') {
          consecutiveNoToken++;
          console.warn(`WelcomeScreen: NO_ID_TOKEN (attempt ${consecutiveNoToken})`);
          if (consecutiveNoToken >= MAX_NO_TOKEN) {
            stopped = true;
            setInitializing(false);
            // Route to Auth by resetting the selection screen (AuthScreen is rendered when no current user)
            setCurrentUser(undefined as any);
            setMode('select');
            return;
          }
          const base = Math.pow(consecutiveNoToken, 2) * 500;
          const jitter = Math.floor(Math.random() * 300);
          const backoff = Math.min(base + jitter, 5000);
          timeoutId = setTimeout(tick, backoff);
          return;
        }
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

  // fallback timeout — if initialization takes too long, fall back to Auth
  useEffect(() => {
    if (!initializing) {
      setTimedOut(false);
      return;
    }

    const TIMEOUT_MS = 2000; // 2s
    const timer = setTimeout(() => {
      console.warn('WelcomeScreen: initialization timeout (>10s). Falling back to Auth screen.');
      setTimedOut(true);
      setInitializing(false);
      setCurrentUser(undefined as any);
      setMode('select');
    }, TIMEOUT_MS);

    return () => clearTimeout(timer);
  }, [initializing]);

  const checkUserSession = async (): Promise<(() => void) | undefined> => {
    console.log('🔐 WelcomeScreen: Checking user session...');
    
    try {
      // Enhanced user session validation with retry logic
      const sessionValidation = await validateUserSession(
        () => firebaseAuth.getCurrentUser(),
        () => firebaseAuth.getCurrentIdToken()
      );

      if (!sessionValidation.isValid) {
        console.log('🔐 WelcomeScreen: No valid session, showing Auth screen');
        console.log('🔐 WelcomeScreen: Validation error:', sessionValidation.error);
        setInitializing(false);
        return;
      }

      const authUser = sessionValidation.user;
      console.log('✅ WelcomeScreen: Valid session found, creating user session...');

      // Enhanced user data fetching with retry
      let userData = null;
      try {
        console.log('📋 WelcomeScreen: Fetching user data with retry...');
        userData = await fetchWithRetry(
          () => firestoreService.getUser(authUser.localId),
          3,
          300
        );
      } catch (e) {
        console.warn('⚠️ WelcomeScreen: getUser failed (will continue with minimal user):', e);
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
      setInitializing(false);
      console.log('✅ WelcomeScreen: User session created, showing select mode');
      setMode('select');

      // Background: resolve apartment without blocking UI
      (async () => {
        try {
          console.log('🏠 WelcomeScreen: Resolving current apartment for user...');
          const currentApartment = await fetchWithRetry(
            () => firestoreService.getUserCurrentApartment(authUser.localId),
            3,
            500
          );
          console.log('🏠 WelcomeScreen: Apartment lookup result:', currentApartment);

          if (currentApartment && isValidApartmentId(currentApartment.id)) {
            console.log('✅ WelcomeScreen: Valid apartment found, updating user state...');
            
            // Update user with apartment id
            useStore.setState(state => ({
              currentUser: state.currentUser ? { 
                ...state.currentUser, 
                current_apartment_id: currentApartment.id 
              } : state.currentUser,
            }));

            console.log('🏠 WelcomeScreen: Setting apartment in local state:', {
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
            console.log('📭 WelcomeScreen: No valid apartment found — user stays on Join/Create');
            setMode('select');
          }
        } catch (bgErr) {
          console.warn('⚠️ WelcomeScreen: Background apartment resolution failed:', bgErr);
          console.log('📭 WelcomeScreen: Keeping user on select mode due to error');
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
      console.log('WelcomeScreen: setInitializing(false)');
      setMode('select');
    }
  };

  const handleAuthSuccess = async (user: any) => {
    console.log('🎉 WelcomeScreen: Auth success, setting user and checking apartment...');
    setCurrentUser(user);
    
    // For new users, we still need to check if they have an apartment
    // This handles the case where a user might have been added to an apartment
    // between registration and login
    try {
      console.log('🔍 WelcomeScreen: Checking for existing apartment after auth success...');
      const currentApartment = await fetchWithRetry(
        () => firestoreService.getUserCurrentApartment(user.id),
        2, // Fewer retries for new users
        300
      );
      
      if (currentApartment && isValidApartmentId(currentApartment.id)) {
        console.log('✅ WelcomeScreen: Found existing apartment after auth success:', currentApartment.id);
        
        // Update user with apartment id
        useStore.setState(state => ({
          currentUser: state.currentUser ? { 
            ...state.currentUser, 
            current_apartment_id: currentApartment.id 
          } : state.currentUser,
        }));

        // Set apartment in local state
        useStore.setState({
          currentApartment: {
            id: currentApartment.id,
            name: currentApartment.name,
            invite_code: currentApartment.invite_code,
            members: [],
            createdAt: new Date(),
          }
        });
        
        console.log('🏠 WelcomeScreen: User has apartment, will navigate to apartment screen');
        // The AppNavigator will handle navigation to apartment screen
        setInitializing(false);
        return;
      }
    } catch (error) {
      console.log('📭 WelcomeScreen: No apartment found or error checking apartment:', error);
    }
    
    // No apartment found - show join/create options
    console.log('📭 WelcomeScreen: No apartment found, showing join/create options');
    setInitializing(false);
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

  // Show loading spinner while initializing (with timeout fallback UI)
  if (initializing) {
    return (
      <View className="flex-1 justify-center items-center" style={themed.surfaceBg}>
        <ActivityIndicator size="large" color="#007AFF" />
        <ThemedText style={[themed.textSecondary, { marginTop: 16 }]}>{t('welcome.loading')}</ThemedText>
        {timedOut && (
          <View className="mt-6 items-center">
            <ThemedText style={[themed.textSecondary, { marginBottom: 12 }]}>
              טעינת הפרופיל לקחה יותר מדי זמן — נסה להתחבר שוב או חזור למסך ההרשמה.
            </ThemedText>

            <Pressable
              onPress={async () => {
                setTimedOut(false);
                setInitializing(true);
                try {
                  await checkUserSession();
                } catch (e) {
                  console.warn('Retry checkUserSession failed', e);
                  setInitializing(false);
                }
              }}
              className="py-3 px-6 rounded-xl bg-blue-500 mb-3"
            >
              <Text className="text-white font-medium">נסה שוב</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                setTimedOut(false);
                setInitializing(false);
                setCurrentUser(undefined as any);
                setMode('select');
              }}
              className="py-3 px-6 rounded-xl bg-gray-200"
            >
              <Text className="text-black font-medium">חזור למסך התחברות</Text>
            </Pressable>
          </View>
        )}
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
        {/* Language toggle */}
        <Pressable
          onPress={() => {
            const newLang = appLanguage === 'he' ? 'en' : 'he';
            setAppLanguage(newLang);
            changeAppLanguage(newLang);
          }}
          className="absolute p-2 rounded-full"
          style={{ right: 16, top: 60, ...themed.surfaceBg }}
          accessibilityRole="button"
          accessibilityLabel={t('settings.language')}
        >
          <Ionicons name="language" size={22} color="#111827" />
        </Pressable>

        <View className="flex-1 justify-center">
          <View className="items-center mb-12">
            <Ionicons name="home" size={80} color="#007AFF" />
            <ThemedText className="text-3xl font-bold mt-4 text-center">
              {t('welcome.hello')}
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
