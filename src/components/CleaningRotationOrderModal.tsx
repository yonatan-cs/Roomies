import React, { useState, useCallback, useEffect } from 'react';
import { Modal, View, Pressable, Text, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DraggableFlatList, {
  ScaleDecorator,
  RenderItemParams,
} from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useStore } from '../state/store';
import { useTranslation } from 'react-i18next';
import { useIsRTL } from '../hooks/useIsRTL';
import { success, impactMedium } from '../utils/haptics';
import { ThemedCard } from '../theme/components/ThemedCard';
import { ThemedText } from '../theme/components/ThemedText';
import { useThemedStyles } from '../theme/useThemedStyles';
import { User } from '../types';
import { showThemedAlert } from './ThemedAlert';

interface CleaningRotationOrderModalProps {
  visible: boolean;
  onClose: () => void;
}

interface DraggableUser {
  id: string;
  user: User;
}

export default function CleaningRotationOrderModal({
  visible,
  onClose,
}: CleaningRotationOrderModalProps) {
  const { t } = useTranslation();
  const isRTL = useIsRTL();
  const { currentApartment, cleaningTask, updateCleaningRotationOrder } = useStore();
  
  const [orderedUsers, setOrderedUsers] = useState<DraggableUser[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Update ordered users when modal opens or data changes
  useEffect(() => {
    if (!visible) {
      return;
    }

    console.log('🔄 Modal opened, checking data:', {
      hasCurrentApartment: !!currentApartment,
      membersCount: currentApartment?.members?.length || 0,
      hasCleaningTask: !!cleaningTask,
      queueLength: cleaningTask?.queue?.length || 0
    });

    // If no apartment members, show empty state
    if (!currentApartment?.members || currentApartment.members.length === 0) {
      console.log('⚠️ No apartment members found');
      setOrderedUsers([]);
      return;
    }

    // Get queue from cleaningTask, or fallback to apartment members order
    const queue = cleaningTask?.queue && cleaningTask.queue.length > 0 
      ? cleaningTask.queue 
      : currentApartment.members.map(m => m.id);

    console.log('📋 Using queue:', queue);

    const newOrderedUsers: DraggableUser[] = queue
      .map((userId) => {
        const user = currentApartment.members.find((m) => m.id === userId);
        if (!user) {
          console.warn('⚠️ User not found in members:', userId);
          return null;
        }
        console.log('✅ Found user:', user.name);
        return { id: userId, user };
      })
      .filter((item): item is DraggableUser => item !== null);

    console.log('✅ Final ordered users:', newOrderedUsers.length, newOrderedUsers.map(u => u.user.name));
    setOrderedUsers(newOrderedUsers);
  }, [visible, currentApartment, cleaningTask]);

  const themed = useThemedStyles((tk) => ({
    textPrimary: { color: tk.colors.text.primary },
    textSecondary: { color: tk.colors.text.secondary },
    borderColor: { borderColor: tk.colors.border.primary },
    cardBg: { backgroundColor: tk.colors.card },
    surfaceBg: { backgroundColor: tk.colors.surface },
    // Dynamic colors for light/dark mode
    infoBg: { backgroundColor: tk.colors.surface },
    infoText: { color: tk.colors.text.primary },
    itemBg: { backgroundColor: tk.colors.surface },
    itemBorder: { borderColor: tk.colors.border.primary },
    cancelBg: { backgroundColor: tk.colors.border.primary },
    cancelText: { color: tk.colors.text.primary },
  }));

  const handleSave = async () => {
    if (!currentApartment || isSaving) return;
    
    setIsSaving(true);
    impactMedium(); // Haptic feedback
    
    try {
      const newQueue = orderedUsers.map((item) => item.id);
      await updateCleaningRotationOrder(newQueue);
      success(); // Success haptic feedback
      console.log('✅ Rotation order updated successfully:', newQueue);
      
      // Show success message
      showThemedAlert(
        t('cleaning.rotationOrderModal.title'),
        'סדר הרוטציה עודכן בהצלחה! השינויים יופיעו במסך הניקיון.'
      );
      
      onClose();
    } catch (error) {
      console.error('❌ Error updating rotation order:', error);
      showThemedAlert(
        'שגיאה',
        'לא ניתן לעדכן את סדר הרוטציה. נסה שוב.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const renderItem = useCallback(
    ({ item, drag, isActive }: RenderItemParams<DraggableUser>) => {
      return (
        <ScaleDecorator>
          <Pressable
            onLongPress={drag}
            disabled={isActive}
            style={[
              {
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                paddingVertical: 12,
                paddingHorizontal: 16,
                marginBottom: 8,
                borderRadius: 12,
                borderWidth: 1,
                opacity: isActive ? 0.8 : 1,
                transform: [{ scale: isActive ? 1.05 : 1 }],
              },
              themed.borderColor,
              themed.cardBg,
            ]}
          >
            <Ionicons
              name="menu"
              size={20}
              color={themed.textSecondary.color}
              style={{
                marginEnd: isRTL ? 0 : 12,
                marginStart: isRTL ? 12 : 0,
              }}
            />
            <ThemedText className="flex-1 text-base" style={themed.textPrimary}>
              {item.user.name}
            </ThemedText>
          </Pressable>
        </ScaleDecorator>
      );
    },
    [isRTL, themed]
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: 24,
          }}
        >
          <ThemedCard
            className="rounded-2xl w-full p-6"
            style={{ maxWidth: 500 }}
          >
            {/* Header */}
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 16,
              }}
            >
              <ThemedText className="text-xl font-semibold" style={themed.textPrimary}>
                {t('cleaning.rotationOrderModal.title')}
              </ThemedText>
              <Pressable onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="close" size={24} color={themed.textSecondary.color} />
              </Pressable>
            </View>

            {/* Description */}
            <ThemedText className="text-sm mb-4" style={themed.textSecondary}>
              {t('cleaning.rotationOrderModal.description')}
            </ThemedText>


            {/* Users List */}
            <View style={{ marginBottom: 16 }}>
              {orderedUsers.length === 0 ? (
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <ThemedText style={themed.textSecondary}>
                    {!currentApartment?.members ? 'טוען...' : 'אין שותפים להציג'}
                  </ThemedText>
                </View>
              ) : (
                <DraggableFlatList
                  data={orderedUsers}
                  onDragEnd={({ data }) => setOrderedUsers(data)}
                  keyExtractor={(item) => item.id}
                  renderItem={renderItem}
                  containerStyle={{ marginBottom: 16 }}
                />
              )}
            </View>

            {/* Action Buttons */}
            <View
              style={{
                flexDirection: isRTL ? 'row-reverse' : 'row',
                gap: 12,
              }}
            >
              <Pressable
                onPress={onClose}
                disabled={isSaving}
                style={[
                  {
                    flex: 1,
                    paddingVertical: 12,
                    borderRadius: 12,
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: isSaving ? 0.5 : 1,
                  },
                  themed.cancelBg,
                ]}
              >
                <ThemedText style={[{ fontSize: 16, fontWeight: '600' }, themed.cancelText]}>
                  {t('common.cancel')}
                </ThemedText>
              </Pressable>

              <Pressable
                onPress={handleSave}
                disabled={isSaving}
                style={[
                  {
                    flex: 1,
                    paddingVertical: 12,
                    borderRadius: 12,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#3b82f6',
                    opacity: isSaving ? 0.7 : 1,
                    flexDirection: 'row',
                  },
                ]}
              >
                {isSaving && (
                  <Ionicons
                    name="hourglass"
                    size={18}
                    color="white"
                    style={{ marginEnd: 8 }}
                  />
                )}
                <Text style={{ fontSize: 16, fontWeight: '600', color: 'white' }}>
                  {t('cleaning.rotationOrderModal.save')}
                </Text>
              </Pressable>
            </View>
          </ThemedCard>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

