import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Share, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../state/store';
import { getUserDisplayInfo } from '../utils/userDisplay';
import Clipboard from '@react-native-clipboard/clipboard';
import ConfirmModal from '../components/ConfirmModal';
import { firebaseAuth } from '../services/firebase-auth';
import { firestoreService } from '../services/firestore-service';

const HEBREW_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

export default function SettingsScreen() {
  const {
    currentUser,
    currentApartment,
    setCurrentUser,
    cleaningSettings,
    setCleaningIntervalDays,
    setCleaningAnchorDow,
    checklistItems,
    addChecklistItem,
    refreshApartmentMembers,
  } = useStore();

  // Refresh apartment members when component mounts
  useEffect(() => {
    if (currentApartment) {
      console.log('🔄 Settings: Refreshing apartment members on mount');
      refreshApartmentMembers();
    }
  }, [currentApartment?.id]); // Only refresh when apartment ID changes

  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState(currentUser?.name || '');
  const [copied, setCopied] = useState(false);
  const [confirmLeaveVisible, setConfirmLeaveVisible] = useState(false);

  const [newChore, setNewChore] = useState('');
  const [editingChoreId, setEditingChoreId] = useState<string | null>(null);
  const [editingChoreName, setEditingChoreName] = useState('');

  const handleSaveName = async () => {
    if (!newName.trim() || !currentUser) return;
    
    try {
      // Update user name in Firestore
      await firestoreService.updateUser(currentUser.id, {
        full_name: newName.trim(),
      });
      
      // Update local state
      setCurrentUser({ ...currentUser, name: newName.trim() });
      setEditingName(false);
    } catch (error: any) {
      console.error('Update name error:', error);
      Alert.alert('שגיאה', 'לא ניתן לעדכן את השם');
    }
  };

  const handleCopyCode = async () => {
    if (!currentApartment?.invite_code) return;
    try {
      Clipboard.setString(currentApartment.invite_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      setCopied(false);
    }
  };

  const handleShareCode = async () => {
    if (!currentApartment) return;
    try {
      await Share.share({
        message: `הצטרף לדירת השותפים שלנו!\nשם הדירה: ${currentApartment.name}\nקוד הצטרפות: ${currentApartment.invite_code}`,
        title: 'הצטרפות לדירת שותפים',
      });
    } catch (error) {}
  };

  const handleLeaveApartment = () => {
    setConfirmLeaveVisible(true);
  };

  if (!currentUser || !currentApartment) {
    return (
      <View className="flex-1 bg-white justify-center items-center">
        <Text className="text-gray-500">טוען...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-white px-6 pt-16 pb-6 shadow-sm">
        <Text className="text-2xl font-bold text-gray-900 text-center">הגדרות</Text>
      </View>

      <ScrollView className="flex-1 px-6 py-6">
        {/* Apartment Details */}
        <View className="bg-white rounded-2xl p-6 mb-6 shadow-sm">
          <Text className="text-lg font-semibold text-gray-900 mb-4">פרטי הדירה</Text>

          <View className="mb-4">
            <Text className="text-gray-600 text-sm mb-1">שם הדירה</Text>
            <Text className="text-gray-900 text-lg font-medium">{currentApartment.name}</Text>
          </View>

          <View className="mb-1">
            <Text className="text-gray-600 text-sm mb-1">קוד הצטרפות</Text>
            <View className="flex-row items-center justify-between bg-gray-50 p-3 rounded-xl">
              <Text className="text-gray-900 text-lg font-mono font-bold">{currentApartment.invite_code}</Text>
              <View className="flex-row">
                <Pressable onPress={handleCopyCode} className="bg-blue-100 p-2 rounded-lg ml-2">
                  <Ionicons name="copy-outline" size={20} color="#007AFF" />
                </Pressable>
                <Pressable onPress={handleShareCode} className="bg-green-100 p-2 rounded-lg">
                  <Ionicons name="share-outline" size={20} color="#10b981" />
                </Pressable>
              </View>
            </View>
          </View>
          {copied && <Text className="text-xs text-green-600 mt-1">הקוד הועתק ללוח</Text>}

          <Text className="text-xs text-gray-500 mt-2">שתף את הקוד עם שותפים חדשים כדי שיוכלו להצטרף לדירה</Text>
        </View>

        {/* Roommates */}
        <View className="bg-white rounded-2xl p-6 mb-6 shadow-sm">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-lg font-semibold text-gray-900">
              שותפים בדירה ({currentApartment.members.length})
            </Text>
            <Pressable 
              onPress={refreshApartmentMembers}
              className="bg-blue-100 p-2 rounded-lg"
            >
              <Ionicons name="refresh" size={20} color="#007AFF" />
            </Pressable>
          </View>
          {currentApartment.members.map((member) => (
            <View key={member.id} className="mb-4">
              <View className="flex-row items-center">
                <View className="w-12 h-12 bg-blue-100 rounded-full items-center justify-center">
                  <Text className="text-blue-700 font-semibold text-lg">
                    {getUserDisplayInfo(member).initial}
                  </Text>
                </View>
                <View className="mr-3 flex-1">
                  <Text className="text-gray-900 font-medium">
                    {getUserDisplayInfo(member).displayName} {member.id === currentUser.id && '(אתה)'}
                  </Text>
                  <Text className="text-gray-500 text-sm">{member.email || 'אין אימייל'}</Text>
                </View>
              </View>


            </View>
          ))}
        </View>

        {/* My Profile */}
        <View className="bg-white rounded-2xl p-6 mb-6 shadow-sm">
          <Text className="text-lg font-semibold text-gray-900 mb-4">הפרופיל שלי</Text>
          <View className="mb-4">
            <Text className="text-gray-600 text-sm mb-2">שם מלא</Text>
            {editingName ? (
              <View className="flex-row items-center">
                <TextInput
                  value={newName}
                  onChangeText={setNewName}
                  className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-base"
                  textAlign="right"
                  autoFocus
                />
                <View className="flex-row mr-3">
                  <Pressable onPress={handleSaveName} className={"p-2 rounded-lg ml-2 " + (newName.trim() ? 'bg-green-100' : 'bg-gray-100')}>
                    <Ionicons name="checkmark" size={20} color={newName.trim() ? '#10b981' : '#9ca3af'} />
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setEditingName(false);
                      setNewName(currentUser.name || '');
                    }}
                    className="bg-red-100 p-2 rounded-lg"
                  >
                    <Ionicons name="close" size={20} color="#ef4444" />
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable onPress={() => setEditingName(true)} className="flex-row items-center justify-between bg-gray-50 p-3 rounded-xl">
                <Text className="text-gray-900 text-base">{currentUser.name}</Text>
                <Ionicons name="pencil-outline" size={20} color="#6b7280" />
              </Pressable>
            )}
          </View>

          <View className="mb-4">
            <Text className="text-gray-600 text-sm mb-1">אימייל</Text>
            <Text className="text-gray-500">{currentUser.email || 'לא מוגדר'}</Text>
          </View>
        </View>

        {/* Cleaning Schedule */}
        <View className="bg-white rounded-2xl p-6 mb-6 shadow-sm">
          <Text className="text-lg font-semibold text-gray-900 mb-4">סבב ניקיון</Text>

          <Text className="text-gray-700 mb-2">תדירות</Text>
          <View className="flex-row mb-4">
            {[7, 14, 30].map((days) => {
              const selected = cleaningSettings.intervalDays === days;
              const label = days === 7 ? 'שבועי' : days === 14 ? 'דו שבועי' : 'חודשי';
              return (
                <Pressable
                  key={days}
                  onPress={() => setCleaningIntervalDays(days)}
                  className={"px-3 py-2 rounded-xl mr-2 " + (selected ? 'bg-blue-500' : 'bg-gray-100')}
                >
                  <Text className={selected ? 'text-white' : 'text-gray-700'}>{label}</Text>
                </Pressable>
              );
            })}
            {/* Custom days input could be added later */}
          </View>

          <Text className="text-gray-700 mb-2">יום התחלפות (ברירת מחדל ראשון)</Text>
          <View className="flex-row flex-wrap">
            {HEBREW_DAYS.map((d, idx) => {
              const selected = cleaningSettings.anchorDow === idx;
              return (
                <Pressable
                  key={idx}
                  onPress={() => setCleaningAnchorDow(idx)}
                  className={"px-2 py-1 rounded-lg mr-2 mb-2 " + (selected ? 'bg-blue-500' : 'bg-gray-100')}
                >
                  <Text className={selected ? 'text-white' : 'text-gray-700'}>{d}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Cleaning Chores */}
        <View className="bg-white rounded-2xl p-6 mb-6 shadow-sm">
          <Text className="text-lg font-semibold text-gray-900 mb-4">משימות ניקיון</Text>
          {checklistItems.map((item) => {
            const isEditing = editingChoreId === item.id;
            return (
              <View key={item.id} className="flex-row items-center py-2">
                {isEditing ? (
                  <TextInput
                    value={editingChoreName}
                    onChangeText={setEditingChoreName}
                    className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-base"
                    textAlign="right"
                    onSubmitEditing={() => {
                      if (editingChoreName.trim()) {
                        // TODO: Implement rename functionality for checklist items
                        setEditingChoreId(null);
                        setEditingChoreName('');
                      } else {
                        setEditingChoreId(null);
                      }
                    }}
                  />
                ) : (
                  <Text className="flex-1 text-base text-gray-900">{item.title}</Text>
                )}
                {!isEditing ? (
                  <View className="flex-row ml-2">
                    <Pressable
                      onPress={() => {
                        setEditingChoreId(item.id);
                        setEditingChoreName(item.title);
                      }}
                      className="p-2"
                    >
                      <Ionicons name="pencil" size={18} color="#6b7280" />
                    </Pressable>
                    <Pressable onPress={() => {
                      // TODO: Implement remove functionality for checklist items
                      console.log('Remove item:', item.id);
                    }} className="p-2">
                      <Ionicons name="trash" size={18} color="#ef4444" />
                    </Pressable>
                  </View>
                ) : (
                  <Pressable
                    onPress={() => {
                      setEditingChoreId(null);
                      setEditingChoreName('');
                    }}
                    className="p-2 ml-2"
                  >
                    <Ionicons name="close" size={18} color="#ef4444" />
                  </Pressable>
                )}
              </View>
            );
          })}

          <View className="flex-row items-center mt-4">
            <TextInput
              value={newChore}
              onChangeText={setNewChore}
              placeholder="הוסף משימה חדשה..."
              className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-base"
              textAlign="right"
              onSubmitEditing={async () => {
                if (!newChore.trim()) return;
                try {
                  await addChecklistItem(newChore.trim());
                  setNewChore('');
                } catch (error) {
                  console.error('Error adding checklist item:', error);
                }
              }}
              returnKeyType="done"
            />
            <Pressable
              onPress={async () => {
                if (!newChore.trim()) return;
                try {
                  await addChecklistItem(newChore.trim());
                  setNewChore('');
                } catch (error) {
                  console.error('Error adding checklist item:', error);
                }
              }}
              className="bg-blue-500 w-12 h-12 rounded-xl items-center justify-center mr-3"
            >
              <Ionicons name="add" size={24} color="white" />
            </Pressable>
          </View>
        </View>

        {/* Danger Zone */}
        <View className="bg-white rounded-2xl p-6 shadow-sm border-2 border-red-100">
          <Text className="text-lg font-semibold text-red-600 mb-4">אזור סכנה</Text>
          
          <Pressable 
            onPress={async () => {
              try {
                await firebaseAuth.signOut();
                // Clear local state
                useStore.setState({
                  currentUser: undefined,
                  currentApartment: undefined,
                  cleaningTask: undefined,
                  expenses: [],
                  shoppingItems: [],
                  checklistItems: [],
                });
              } catch (error) {
                console.error('Sign out error:', error);
                Alert.alert('שגיאה', 'לא ניתן להתנתק');
              }
            }}
            className="bg-orange-500 py-3 px-6 rounded-xl mb-3"
          >
            <Text className="text-white font-semibold text-center">התנתקות מהחשבון</Text>
          </Pressable>
          
          <Pressable onPress={handleLeaveApartment} className="bg-red-500 py-3 px-6 rounded-xl">
            <Text className="text-white font-semibold text-center">עזיבת הדירה</Text>
          </Pressable>
          <Text className="text-xs text-gray-500 text-center mt-2">פעולה זו תסיר אותך מהדירה ותמחק את כל הנתונים המקומיים</Text>
        </View>
      </ScrollView>

      <ConfirmModal
        visible={confirmLeaveVisible}
        title="עזיבת דירה"
        message="האם אתה בטוח שברצונך לעזוב את הדירה? פעולה זו אינה ניתנת לביטול."
        confirmText="כן, עזוב דירה"
        cancelText="ביטול"
        onConfirm={async () => {
          try {
            if (currentUser && currentApartment) {
              // Leave apartment in Firestore
              await firestoreService.leaveApartment(currentApartment.id, currentUser.id);
              
              // current_apartment_id is managed automatically through apartmentMembers
            }
            
            // Reset local state for apartment-scope data
            useStore.setState({
              currentApartment: undefined,
              cleaningTask: undefined,
              expenses: [],
              shoppingItems: [],
              checklistItems: [],
            });
            
            // Update current user to remove apartment reference
            if (currentUser) {
              setCurrentUser({ 
                ...currentUser, 
                current_apartment_id: undefined 
              });
            }
            
            setConfirmLeaveVisible(false);
          } catch (error: any) {
            console.error('Leave apartment error:', error);
            Alert.alert('שגיאה', 'לא ניתן לעזוב את הדירה');
            setConfirmLeaveVisible(false);
          }
        }}
        onCancel={() => setConfirmLeaveVisible(false)}
      />
    </View>
  );
}
