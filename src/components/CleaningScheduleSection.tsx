import React, { useState } from 'react';
import { View, Pressable, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../state/store';
import { useTranslation } from 'react-i18next';
import { useIsRTL } from '../hooks/useIsRTL';
import { useFocusEffect } from '@react-navigation/native';
import { selection, success, impactMedium, impactLight, warning } from '../utils/haptics';
import { ThemedText } from '../theme/components/ThemedText';
import { ThemedCard } from '../theme/components/ThemedCard';
import { useThemedStyles } from '../theme/useThemedStyles';
import { Accordion } from './Accordion';
import { DayPicker } from './DayPicker';
import { IntervalPicker } from './IntervalPicker';
import { AppTextInput } from './AppTextInput';
import { getTaskLabel } from '../utils/taskLabel';
import { showThemedAlert } from './ThemedAlert';
import CleaningRotationOrderModal from './CleaningRotationOrderModal';

export default function CleaningScheduleSection() {
  const { t } = useTranslation();
  const isRTL = useIsRTL();
  const {
    cleaningSettings,
    setCleaningIntervalDays,
    setCleaningAnchorDow,
    checklistItems,
    addChecklistItem,
    removeChecklistItem,
    startCleaningTaskListener,
    stopCleaningTaskListener,
  } = useStore();

  const [newChore, setNewChore] = useState('');
  const [editingChoreId, setEditingChoreId] = useState<string | null>(null);
  const [editingChoreName, setEditingChoreName] = useState('');
  const [isAddingChore, setIsAddingChore] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [deletingChoreId, setDeletingChoreId] = useState<string | null>(null);
  const [showRotationOrderModal, setShowRotationOrderModal] = useState(false);

  const themed = useThemedStyles(tk => ({
    textPrimary: { color: tk.colors.text.primary },
    textSecondary: { color: tk.colors.text.secondary },
    borderColor: { borderColor: tk.colors.border.primary },
    inputBg: { backgroundColor: tk.colors.card },
    inputText: { color: tk.colors.text.primary },
  }));

  // Set up real-time listener for cleaning task settings
  useFocusEffect(
    React.useCallback(() => {
      startCleaningTaskListener().catch(error => {
        console.error('Failed to start cleaning task listener:', error);
      });
      return () => stopCleaningTaskListener();
    }, [startCleaningTaskListener, stopCleaningTaskListener])
  );

  return (
    <ThemedCard className="rounded-2xl p-6 mb-6 shadow-sm">
      <Accordion
        title={t('settings.cleaningSchedule')}
        icon="calendar-outline"
        defaultExpanded={false}
      >
        {/* Cleaning Schedule Settings */}
        <View className="mb-6">
          <ThemedText className="mb-2" style={themed.textSecondary}>
            {t('settings.frequency')}
          </ThemedText>
          <IntervalPicker
            selectedInterval={cleaningSettings.intervalDays}
            onIntervalChange={async (interval) => {
              selection(); // Haptic feedback for schedule selection
              await setCleaningIntervalDays(interval);
            }}
            style={{ marginBottom: 16 }}
          />

          {/* Show rotation day picker only for weekly or longer intervals */}
          {cleaningSettings.intervalDays >= 7 && (
            <>
              <ThemedText className="mb-2" style={themed.textSecondary}>
                {t('settings.rotationDay')}
              </ThemedText>
              <DayPicker
                selectedDay={cleaningSettings.anchorDow}
                onDayChange={async (day) => {
                  selection(); // Haptic feedback for day selection
                  await setCleaningAnchorDow(day);
                }}
                style={{ marginBottom: 16 }}
              />
            </>
          )}

          {/* Edit Rotation Order Button */}
          <Pressable
            onPress={() => {
              impactLight(); // Haptic feedback
              setShowRotationOrderModal(true);
            }}
            style={[
              {
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 12,
                paddingHorizontal: 16,
                borderRadius: 12,
                backgroundColor: '#3b82f6',
                gap: 8,
              },
            ]}
          >
            <Ionicons name="swap-vertical" size={20} color="white" />
            <ThemedText className="text-base font-medium" style={{ color: 'white' }}>
              {t('cleaning.editRotationOrder')}
            </ThemedText>
          </Pressable>
        </View>

        {/* Cleaning Tasks Section */}
        <View className="mb-4">
          <ThemedText className="text-base font-medium mb-3" style={themed.textPrimary}>
            {t('settings.cleaningTasks')} ({checklistItems.length})
          </ThemedText>

          {checklistItems.map((item) => {
            const isEditing = editingChoreId === item.id;
            return (
              <View
                key={item.id}
                className="items-center py-2"
                style={{
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center'
                }}
              >
                {isEditing ? (
                  <AppTextInput
                    value={editingChoreName}
                    onChangeText={setEditingChoreName}
                    className="flex-1 border rounded-xl px-3 py-2 text-base"
                    style={[themed.borderColor, themed.inputBg, themed.inputText]}
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
                    placeholderTextColor={themed.textSecondary.color}
                  />
                ) : (
                  <ThemedText className="flex-1 text-base">{getTaskLabel(item)}</ThemedText>
                )}
                {!isEditing ? (
                  <View
                    className="flex-row"
                    style={{
                      flexDirection: isRTL ? 'row-reverse' : 'row',
                      alignItems: 'center',
                      marginStart: isRTL ? 0 : 8,
                      marginEnd: isRTL ? 8 : 0
                    }}
                  >
                    <Pressable
                      onPress={() => {
                        impactLight(); // Haptic feedback for edit task
                        setEditingChoreId(item.id);
                        setEditingChoreName(getTaskLabel(item));
                      }}
                      className="p-2"
                    >
                      <Ionicons name="pencil" size={18} color="#6b7280" />
                    </Pressable>
                    <Pressable
                      onPress={async () => {
                        if (deletingChoreId) return; // Prevent multiple clicks
                        warning(); // Haptic feedback for delete task
                        setDeletingChoreId(item.id);
                        try {
                          await removeChecklistItem(item.id);
                        } catch (error) {
                          console.error('Error removing checklist item:', error);
                          showThemedAlert(t('common.error'), t('settings.alerts.cannotDeleteTask'));
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
                      impactLight(); // Haptic feedback for cancel edit
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

          {/* Add New Task Input */}
          <View className="flex-row items-center mt-4">
            <AppTextInput
              value={newChore}
              onChangeText={setNewChore}
              placeholder={t('settings.addNewTaskPlaceholder')}
              className="flex-1 border rounded-xl px-4 py-3 text-base"
              style={[themed.borderColor, themed.inputBg, themed.inputText]}
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
                  showThemedAlert(t('common.error'), t('settings.alerts.cannotAddTask'));
                } finally {
                  setIsAddingChore(false);
                }
                Keyboard.dismiss();
              }}
              returnKeyType="done"
              editable={!isAddingChore}
              placeholderTextColor={themed.textSecondary.color}
            />
            <Pressable
              onPress={async () => {
                if (!newChore.trim()) return;
                impactMedium(); // Haptic feedback for add task action
                setIsAddingChore(true);
                try {
                  await addChecklistItem(newChore.trim());
                  setNewChore('');
                  setShowSuccessMessage(true);
                  setTimeout(() => setShowSuccessMessage(false), 3000);
                } catch (error) {
                  console.error('Error adding checklist item:', error);
                  showThemedAlert(t('common.error'), t('settings.alerts.cannotAddTask'));
                } finally {
                  setIsAddingChore(false);
                }
              }}
              disabled={isAddingChore}
              className={`w-12 h-12 rounded-xl items-center justify-center mr-3 ${isAddingChore ? 'bg-gray-400' : 'bg-blue-500'
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
              <ThemedText className="text-green-800 text-center font-medium">
                ✅ {t('settings.alerts.taskAddedSuccess')}
              </ThemedText>
            </View>
          )}
        </View>
      </Accordion>

      {/* Rotation Order Modal */}
      <CleaningRotationOrderModal
        visible={showRotationOrderModal}
        onClose={() => setShowRotationOrderModal(false)}
      />
    </ThemedCard>
  );
}

