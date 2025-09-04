import React, { useRef } from 'react';
import { View, Text, Pressable, Alert, StyleSheet } from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { Expense } from '../types';

type Props = {
  item: Expense;
  onConfirmDelete: (id: string) => Promise<void>;
  onEdit?: (id: string) => void;
  formatCurrency: (amount: number) => string;
  formatDate: (date: Date | string) => string;
  getUserName: (userId: string) => string;
  currentUserId?: string;
};

export default function ExpenseRow({ 
  item, 
  onConfirmDelete, 
  onEdit,
  formatCurrency, 
  formatDate, 
  getUserName,
  currentUserId
}: Props) {
  const ref = useRef<Swipeable>(null);

  const confirmDelete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(()=>{});
    Alert.alert(
      'למחוק הוצאה?',
      `האם למחוק את "${item.title}"?`,
      [
        { text: 'ביטול', style: 'cancel', onPress: () => ref.current?.close() },
        {
          text: 'מחק',
          style: 'destructive',
          onPress: async () => {
            try {
              await onConfirmDelete(item.id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(()=>{});
            } catch (e) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(()=>{});
            } finally {
              ref.current?.close();
            }
          },
        },
      ]
    );
  };

  const handleEdit = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(()=>{});
    if (onEdit) {
      onEdit(item.id);
    }
    ref.current?.close();
  };

  const RightActions = () => (
    <View style={styles.actionsContainer}>
      <Pressable onPress={handleEdit} style={styles.editButton} accessibilityLabel="ערוך הוצאה">
        <Ionicons name="pencil-outline" size={20} color="white" />
        <Text style={styles.actionText}>ערוך</Text>
      </Pressable>
      <Pressable onPress={confirmDelete} style={styles.trashButton} accessibilityLabel="מחק הוצאה">
        <Ionicons name="trash-outline" size={20} color="white" />
        <Text style={styles.actionText}>מחק</Text>
      </Pressable>
    </View>
  );

  const personalShare = item.amount / item.participants.length;
  const isParticipant = currentUserId && item.participants.includes(currentUserId);
  const isPayer = currentUserId && item.paidBy === currentUserId;

  return (
    <Swipeable
      ref={ref}
      friction={2}
      rightThreshold={40}
      overshootRight={false}
      renderRightActions={RightActions}
    >
      <View style={styles.row}>
        <View style={styles.content}>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.date}>{formatDate(item.date)}</Text>
            {item.description && (
              <Text style={styles.description}>{item.description}</Text>
            )}
            {isParticipant && (
              <Text style={[
                styles.personalInfo,
                isPayer ? styles.payerText : styles.participantText
              ]}>
                {isPayer ? `שילמת: ${formatCurrency(item.amount)}` : `החלק שלך: ${formatCurrency(personalShare)}`}
              </Text>
            )}
          </View>
          
          <View style={styles.amountContainer}>
            <Text style={styles.amount}>{formatCurrency(item.amount)}</Text>
            <Text style={styles.payer}>שילם: {getUserName(item.paidBy)}</Text>
            {item.participants.length > 1 && (
              <Text style={styles.participants}>
                {item.participants.length} משתתפים • {formatCurrency(personalShare)} לאחד
              </Text>
            )}
          </View>
        </View>
      </View>
    </Swipeable>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: 'white',
    marginBottom: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  content: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  titleContainer: {
    flex: 1,
    marginLeft: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  date: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    color: '#4b5563',
    marginBottom: 6,
    fontStyle: 'italic',
  },
  personalInfo: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 4,
  },
  payerText: {
    color: '#10b981',
  },
  participantText: {
    color: '#3b82f6',
  },
  amountContainer: {
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 4,
  },
  payer: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 2,
  },
  participants: {
    fontSize: 12,
    color: '#6b7280',
  },
  actionsContainer: {
    flexDirection: 'row',
    width: 160,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
    overflow: 'hidden',
  },
  editButton: {
    flex: 1,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 12,
  },
  trashButton: {
    flex: 1,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 12,
  },
  actionText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 11,
  },
});
