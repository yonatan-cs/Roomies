import React, { useState } from 'react';
import { View, Text, Pressable, Alert, StyleSheet } from 'react-native';
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
  const [isDeleting, setIsDeleting] = useState(false);

  const confirmDelete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(()=>{});
    Alert.alert(
      'למחוק הוצאה?',
      `האם למחוק את "${item.title}"?`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'מחק',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              await onConfirmDelete(item.id);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(()=>{});
            } catch (e) {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(()=>{});
            } finally {
              setIsDeleting(false);
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
  };

  const personalShare = item.amount / item.participants.length;
  const isParticipant = currentUserId && item.participants.includes(currentUserId);
  const isPayer = currentUserId && item.paidBy === currentUserId;
  const isDebtSettlementMessage = item.isDebtSettlementMessage;

  // Special rendering for debt settlement messages
  if (isDebtSettlementMessage) {
    return (
      <View style={styles.debtSettlementRow}>
        <View style={styles.debtSettlementContent}>
          <View style={styles.debtSettlementIcon}>
            <Ionicons name="checkmark-circle" size={20} color="#10b981" />
          </View>
          <View style={styles.debtSettlementTextContainer}>
            <Text style={styles.debtSettlementTitle}>{item.title}</Text>
            <Text style={styles.debtSettlementMessage}>{item.description}</Text>
            <Text style={styles.debtSettlementDate}>{formatDate(item.date)}</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
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
      
      {/* Action buttons at the bottom */}
      <View style={styles.actionButtonsContainer}>
        <Pressable 
          onPress={handleEdit} 
          style={styles.editButton} 
          accessibilityLabel="ערוך הוצאה"
        >
          <Ionicons name="pencil-outline" size={12} color="#2563eb" />
          <Text style={styles.editButtonText}>ערוך</Text>
        </Pressable>
        <Pressable 
          onPress={confirmDelete} 
          style={[styles.deleteButton, isDeleting && styles.deleteButtonDisabled]} 
          accessibilityLabel="מחק הוצאה"
          disabled={isDeleting}
        >
          {isDeleting ? (
            <Ionicons name="hourglass-outline" size={12} color="#9ca3af" />
          ) : (
            <Ionicons name="trash-outline" size={12} color="#dc2626" />
          )}
          <Text style={[styles.deleteButtonText, isDeleting && styles.deleteButtonTextDisabled]}>
            {isDeleting ? 'מוחק...' : 'מחק'}
          </Text>
        </Pressable>
      </View>
    </View>
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
    paddingBottom: 8,
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
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 0,
    gap: 8,
    marginTop: -8,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    gap: 4,
  },
  editButtonText: {
    color: '#2563eb',
    fontSize: 12,
    fontWeight: '400',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    gap: 4,
  },
  deleteButtonDisabled: {
    backgroundColor: '#f9fafb',
    borderColor: '#e5e7eb',
  },
  deleteButtonText: {
    color: '#dc2626',
    fontSize: 12,
    fontWeight: '400',
  },
  deleteButtonTextDisabled: {
    color: '#9ca3af',
  },
  // Debt settlement message styles
  debtSettlementRow: {
    backgroundColor: '#f0fdf4',
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  debtSettlementContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  debtSettlementIcon: {
    marginRight: 12,
  },
  debtSettlementTextContainer: {
    flex: 1,
  },
  debtSettlementTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#166534',
    marginBottom: 2,
  },
  debtSettlementMessage: {
    fontSize: 14,
    color: '#15803d',
    marginBottom: 2,
  },
  debtSettlementDate: {
    fontSize: 12,
    color: '#16a34a',
  },
});
