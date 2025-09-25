import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, Share, Alert, Linking, Platform, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../state/store';
import { getUserDisplayInfo, getDisplayName } from '../utils/userDisplay';
import Clipboard from '@react-native-clipboard/clipboard';
import ConfirmModal from '../components/ConfirmModal';
import AppSettingsSection from '../components/AppSettingsSection';
import { firebaseAuth } from '../services/firebase-auth';
import { firestoreService } from '../services/firestore-service';
import { Screen } from '../components/Screen';
import { useTranslation } from 'react-i18next';
import { selection, impactMedium, success } from '../utils/haptics';


export default function SettingsScreen() {
  const { t } = useTranslation();
  const appLanguage = useStore(s => s.appLanguage);
  const hapticsEnabled = useStore(s => s.hapticsEnabled);
  const setHapticsEnabled = useStore(s => s.setHapticsEnabled);
  const {
    currentUser,
    currentApartment,
    setCurrentUser,
    cleaningSettings,
    setCleaningIntervalDays,
    setCleaningAnchorDow,
    checklistItems,
    addChecklistItem,
    removeChecklistItem,
    refreshApartmentMembers,
    checkMemberCanBeRemoved,
    removeApartmentMember,
  } = useStore();

  // Refresh apartment members and load checklist when component mounts
  useEffect(() => {
    if (currentApartment) {
      console.log('🔄 Settings: Refreshing apartment members on mount');
      refreshApartmentMembers();
      
      // Also load checklist items to show in settings
      const { loadCleaningChecklist } = useStore.getState();
      loadCleaningChecklist();
    }
  }, [currentApartment?.id]); // Only refresh when apartment ID changes

  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState(currentUser?.name || '');
  const [copied, setCopied] = useState(false);
  const [confirmLeaveVisible, setConfirmLeaveVisible] = useState(false);

  const [newChore, setNewChore] = useState('');
  const [editingChoreId, setEditingChoreId] = useState<string | null>(null);
  const [editingChoreName, setEditingChoreName] = useState('');
  const [isAddingChore, setIsAddingChore] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [deletingChoreId, setDeletingChoreId] = useState<string | null>(null);
  
  // Member removal states
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [confirmRemoveVisible, setConfirmRemoveVisible] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<{id: string, name: string} | null>(null);
  const [showMemberOptions, setShowMemberOptions] = useState<string | null>(null);

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
      Alert.alert(t('common.error'), t('settings.alerts.cannotUpdateName'));
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
        title: t('settings.joinApartmentTitle'),
      });
    } catch (error) {}
  };

  const handleLeaveApartment = () => {
    setConfirmLeaveVisible(true);
  };

  const handleSendFeedback = () => {
    const to = 'yonatan.cs23@gmail.com';
    const subject = encodeURIComponent(t('settings.emailSubject'));
    const body = encodeURIComponent(`תיאור הבעיה / ההצעה:


Device: ${Platform.OS}
App version: 1.0.0
User: ${currentUser?.name || 'Unknown'}

`);
    
    const mailtoUrl = `mailto:${to}?subject=${subject}&body=${body}`;
    
    Linking.openURL(mailtoUrl).catch((err) => {
      console.error('Error opening mailto:', err);
      Alert.alert(t('common.error'), t('settings.alerts.cannotOpenEmail'));
    });
  };

  const handleMemberOptionsPress = (member: any) => {
    if (!currentUser || member.id === currentUser.id) {
      // Don't show remove option for current user (they should use "Leave Apartment")
      return;
    }
    
    setShowMemberOptions(member.id);
  };

  const handleRemoveMemberPress = async (member: any) => {
    setShowMemberOptions(null);
    
    try {
      // Check if member can be removed
      const canBeRemoved = await checkMemberCanBeRemoved(member.id);
      
      if (!canBeRemoved.canBeRemoved) {
        Alert.alert(
          t('settings.alerts.cannotRemoveMember'),
          `אי אפשר להסיר את ${getDisplayName(member)} כי ${canBeRemoved.reason}. סגרו חובות ואז נסו שוב.`,
          [{ text: t('common.ok') }]
        );
        return;
      }

      // Show confirmation dialog
      setMemberToRemove({
        id: member.id,
        name: getDisplayName(member)
      });
      setConfirmRemoveVisible(true);
    } catch (error) {
      console.error('Error checking if member can be removed:', error);
      Alert.alert(t('common.error'), t('settings.alerts.cannotCheckRemoval'));
    }
  };

  const handleConfirmRemoveMember = async () => {
    if (!memberToRemove) return;

    setRemovingMemberId(memberToRemove.id);
    try {
      await removeApartmentMember(memberToRemove.id);
      Alert.alert(t('common.success'), t('settings.alerts.memberRemovedSuccess', { name: memberToRemove.name }));
    } catch (error: any) {
      console.error('Error removing member:', error);
      Alert.alert(t('common.error'), error.message || t('settings.alerts.cannotRemoveMemberError'));
    } finally {
      setRemovingMemberId(null);
      setConfirmRemoveVisible(false);
      setMemberToRemove(null);
    }
  };

  if (!currentUser || !currentApartment) {
    return (
      <View className="flex-1 bg-white justify-center items-center">
        <Text className="text-gray-500">{t('common.loading')}</Text>
      </View>
    );
  }

  return (
    <Screen withPadding={false} keyboardVerticalOffset={0} scroll={false}>
      <View className="bg-white px-6 pt-16 pb-6 shadow-sm">
        <Text className="text-2xl font-bold text-gray-900 text-center">{t('settings.title')}</Text>
      </View>
      <ScrollView 
        className="flex-1 px-6 py-6"
        contentContainerStyle={{ alignItems: 'stretch' }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        {/* App Settings Section */}
        <AppSettingsSection />

        {/* Haptics Setting */}
        <View className="bg-white rounded-2xl p-6 mb-6 shadow-sm">
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="text-lg font-semibold text-gray-900" style={{ textAlign: appLanguage === 'he' ? 'right' : 'left' }}>{t('settings.haptics')}</Text>
              <Text className="text-sm text-gray-600 mt-1" style={{ textAlign: appLanguage === 'he' ? 'right' : 'left' }}>{t('settings.hapticsDescription')}</Text>
            </View>
            <Pressable
              onPress={() => {
                // Give haptic feedback before toggling (so user feels it if enabling)
                if (!hapticsEnabled) {
                  impactMedium();
                }
                setHapticsEnabled(!hapticsEnabled);
              }}
              className={`w-12 h-7 rounded-full p-1 ${hapticsEnabled ? 'bg-blue-500' : 'bg-gray-300'}`}
            >
              <View className={`w-5 h-5 rounded-full bg-white transition-transform ${hapticsEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
            </Pressable>
          </View>
        </View>
        {/* Apartment Details */}
        <View className="bg-white rounded-2xl p-6 mb-6 shadow-sm">
          <Text className="text-lg font-semibold text-gray-900 mb-4">{t('dashboard.apartmentFallback')}</Text>

          <View className="mb-4">
            <Text className="text-gray-600 text-sm mb-1">{t('welcome.aptName')}</Text>
            <Text className="text-gray-900 text-lg font-medium">{currentApartment.name}</Text>
          </View>

          <View className="mb-1">
            <Text className="text-gray-600 text-sm mb-1">{t('welcome.aptCode')}</Text>
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
          {copied && <Text className="text-xs text-green-600 mt-1">{t('common.success')}</Text>}

          <Text className="text-xs text-gray-500 mt-2">{t('settings.feedbackTitle')}</Text>
        </View>

        {/* Roommates */}
        <View className="bg-white rounded-2xl p-6 mb-6 shadow-sm">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-lg font-semibold text-gray-900">
              {t('dashboard.roommates')} ({currentApartment.members.length})
            </Text>
            <Pressable 
              onPress={refreshApartmentMembers}
              className="bg-blue-100 p-2 rounded-lg"
            >
              <Ionicons name="refresh" size={20} color="#007AFF" />
            </Pressable>
          </View>
          <Text className="text-xs text-gray-500 mb-4">{t('dashboard.showAll')}</Text>
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
                    {getDisplayName(member)} {member.id === currentUser.id && `(${t('common.you')})`}
                  </Text>
                  <Text className="text-gray-500 text-sm">{member.email || t('common.unknown')}</Text>
                </View>
                {removingMemberId === member.id ? (
                  <View className="ml-2">
                    <Ionicons name="hourglass" size={20} color="#6b7280" />
                  </View>
                ) : member.id !== currentUser.id ? (
                  <View className="relative">
                    <Pressable
                      onPress={() => handleMemberOptionsPress(member)}
                      className="p-2"
                    >
                      <Ionicons name="ellipsis-horizontal" size={20} color="#9ca3af" />
                    </Pressable>
                    
                    {/* Popup menu */}
                    {showMemberOptions === member.id && (
                      <View className="absolute top-10 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[120px]">
                        <Pressable
                          onPress={() => handleRemoveMemberPress(member)}
                          className="px-4 py-3 border-b border-gray-100"
                        >
                          <Text className="text-red-600 font-medium">{t('settings.removeMember')}</Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                ) : null}
              </View>
            </View>
          ))}
        </View>

        {/* My Profile */}
        <View className="bg-white rounded-2xl p-6 mb-6 shadow-sm">
          <Text className="text-lg font-semibold text-gray-900 mb-4">{t('settings.myProfile')}</Text>
          <View className="mb-4">
            <Text className="text-gray-600 text-sm mb-2">{t('settings.fullName')}</Text>
            {editingName ? (
              <View className="flex-row items-center">
                <TextInput
                  value={newName}
                  onChangeText={setNewName}
                  className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-base"
                  textAlign="right"
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={() => Keyboard.dismiss()}
                />
                <View className="flex-row mr-3">
                  <Pressable onPress={handleSaveName} className={"p-2 rounded-lg ml-2 " + (newName.trim() ? 'bg-green-100' : 'bg-gray-100')}>
                    <Ionicons name="checkmark" size={20} color={newName.trim() ? '#10b981' : '#9ca3af'} />
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setEditingName(false);
                      setNewName(getDisplayName(currentUser));
                    }}
                    className="bg-red-100 p-2 rounded-lg"
                  >
                    <Ionicons name="close" size={20} color="#ef4444" />
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable onPress={() => setEditingName(true)} className="flex-row items-center justify-between bg-gray-50 p-3 rounded-xl">
                <Text className="text-gray-900 text-base">{getDisplayName(currentUser)}</Text>
                <Ionicons name="pencil-outline" size={20} color="#6b7280" />
              </Pressable>
            )}
          </View>

          <View className="mb-4">
            <Text className="text-gray-600 text-sm mb-1">{t('settings.email')}</Text>
            <Text className="text-gray-500">{currentUser.email || t('settings.notDefined')}</Text>
          </View>
        </View>

        {/* Cleaning Schedule */}
        <View className="bg-white rounded-2xl p-6 mb-6 shadow-sm">
          <Text className="text-lg font-semibold text-gray-900 mb-4">{t('settings.cleaningSchedule')}</Text>

          <Text className="text-gray-700 mb-2">{t('settings.frequency')}</Text>
          <View className="flex-row mb-4">
            {[7, 14, 30].map((days) => {
              const selected = cleaningSettings.intervalDays === days;
              const label = days === 7 ? t('settings.scheduleLabels.weekly') : days === 14 ? t('settings.scheduleLabels.biweekly') : t('settings.scheduleLabels.monthly');
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

          <Text className="text-gray-700 mb-2">{t('settings.rotationDay')}</Text>
          <View className="flex-row flex-wrap">
            {[0, 1, 2, 3, 4, 5, 6].map((dayIndex) => {
              const selected = cleaningSettings.anchorDow === dayIndex;
              return (
                <Pressable
                  key={dayIndex}
                  onPress={() => setCleaningAnchorDow(dayIndex)}
                  className={"px-2 py-1 rounded-lg mr-2 mb-2 " + (selected ? 'bg-blue-500' : 'bg-gray-100')}
                >
                  <Text className={selected ? 'text-white' : 'text-gray-700'}>{t(`days.${dayIndex}`)}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Cleaning Chores */}
        <View className="bg-white rounded-2xl p-6 mb-6 shadow-sm">
          <Text className="text-lg font-semibold text-gray-900 mb-4">{t('settings.cleaningTasks')} ({checklistItems.length})</Text>
          

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
                    returnKeyType="done"
                    onSubmitEditing={() => {
                      if (editingChoreName.trim()) {
                        // TODO: Implement rename functionality for checklist items
                        setEditingChoreId(null);
                        setEditingChoreName('');
                      } else {
                        setEditingChoreId(null);
                      }
                      Keyboard.dismiss();
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
                    <Pressable 
                      onPress={async () => {
                        if (deletingChoreId) return; // Prevent multiple clicks
                        setDeletingChoreId(item.id);
                        try {
                          await removeChecklistItem(item.id);
                        } catch (error) {
                          console.error('Error removing checklist item:', error);
                          Alert.alert(t('common.error'), t('settings.alerts.cannotDeleteTask'));
                        } finally {
                          setDeletingChoreId(null);
                        }
                      }} 
                      disabled={deletingChoreId === item.id}
                      className="p-2"
                    >
                      {deletingChoreId === item.id ? (
                        <Ionicons name="hourglass" size={18} color="#6b7280" />
                      ) : (
                        <Ionicons name="trash" size={18} color="#ef4444" />
                      )}
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
              placeholder={t('settings.addNewTaskPlaceholder')}
              className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-base"
              textAlign="right"
              onSubmitEditing={async () => {
                if (!newChore.trim()) return;
                setIsAddingChore(true);
                try {
                  await addChecklistItem(newChore.trim());
                  setNewChore('');
                  success(); // Haptic feedback for successful task addition
                  setShowSuccessMessage(true);
                  setTimeout(() => setShowSuccessMessage(false), 3000);
                } catch (error) {
                  console.error('Error adding checklist item:', error);
                  Alert.alert(t('common.error'), t('settings.alerts.cannotAddTask'));
                } finally {
                  setIsAddingChore(false);
                }
                Keyboard.dismiss();
              }}
              returnKeyType="done"
              editable={!isAddingChore}
            />
            <Pressable
              onPress={async () => {
                if (!newChore.trim()) return;
                setIsAddingChore(true);
                try {
                  await addChecklistItem(newChore.trim());
                  setNewChore('');
                  setShowSuccessMessage(true);
                  setTimeout(() => setShowSuccessMessage(false), 3000);
                } catch (error) {
                  console.error('Error adding checklist item:', error);
                  Alert.alert(t('common.error'), t('settings.alerts.cannotAddTask'));
                } finally {
                  setIsAddingChore(false);
                }
              }}
              disabled={isAddingChore}
              className={`w-12 h-12 rounded-xl items-center justify-center mr-3 ${
                isAddingChore ? 'bg-gray-400' : 'bg-blue-500'
              }`}
            >
              {isAddingChore ? (
                <Ionicons name="hourglass" size={24} color="white" />
              ) : (
                <Ionicons name="add" size={24} color="white" />
              )}
            </Pressable>
          </View>
          
          {/* Success Message */}
          {showSuccessMessage && (
            <View className="bg-green-100 border border-green-300 rounded-xl p-4 mt-4">
              <Text className="text-green-800 text-center font-medium">
                ✅ המשימה נוספה בהצלחה!
              </Text>
            </View>
          )}
        </View>

        {/* Feedback Section */}
        <View className="bg-white rounded-2xl p-6 mb-6 shadow-sm">
          <Text className="text-lg font-semibold text-gray-900 mb-4">{t('settings.feedbackTitle')}</Text>
          <Text className="text-gray-600 text-sm mb-4">
            {t('settings.feedbackDescription')}
          </Text>
          <Pressable 
            onPress={handleSendFeedback}
            className="bg-blue-500 py-3 px-6 rounded-xl"
          >
            <View className="flex-row items-center justify-center">
              <Ionicons name="mail-outline" size={20} color="white" className="ml-2" />
              <Text className="text-white font-semibold text-center"> {t('settings.feedbackCta')} </Text>
            </View>
          </Pressable>
        </View>

        {/* Danger Zone */}
        <View className="bg-white rounded-2xl p-6 shadow-sm border-2 border-red-100">
          <Text className="text-lg font-semibold text-red-600 mb-4">{t('settings.dangerZone')}</Text>
          
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
                Alert.alert(t('common.error'), t('settings.alerts.cannotSignOut'));
              }
            }}
            className="bg-orange-500 py-3 px-6 rounded-xl mb-3"
          >
            <Text className="text-white font-semibold text-center">{t('settings.signOut')}</Text>
          </Pressable>
          
          <Pressable onPress={handleLeaveApartment} className="bg-red-500 py-3 px-6 rounded-xl">
            <Text className="text-white font-semibold text-center">{t('settings.leaveApartment')}</Text>
          </Pressable>
          <Text className="text-xs text-gray-500 text-center mt-2">{t('settings.actionWillRemove')}</Text>
        </View>

      <ConfirmModal
        visible={confirmLeaveVisible}
        title={t('settings.leaveApartmentTitle')}
        message={t('settings.leaveApartmentMessage')}
        confirmText={t('settings.confirmLeaveText')}
        cancelText={t('settings.cancelText')}
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
            Alert.alert(t('common.error'), t('settings.alerts.cannotLeaveApartment'));
            setConfirmLeaveVisible(false);
          }
        }}
        onCancel={() => setConfirmLeaveVisible(false)}
      />

      <ConfirmModal
        visible={confirmRemoveVisible}
        title={t('settings.removeMemberTitle')}
        message={t('settings.confirmRemoveMember', { name: memberToRemove?.name || '' })}
        confirmText={t('settings.confirmRemoveText')}
        cancelText={t('settings.cancelText')}
        onConfirm={handleConfirmRemoveMember}
        onCancel={() => {
          setConfirmRemoveVisible(false);
          setMemberToRemove(null);
        }}
      />
      </ScrollView>
    </Screen>
  );
}
