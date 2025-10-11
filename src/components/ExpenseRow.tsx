import React, { useState } from 'react';
import { View, Text, Pressable, Alert, StyleSheet } from 'react-native';
import { useThemedStyles } from '../theme/useThemedStyles';
import { ThemedText } from '../theme/components/ThemedText';
import { ThemedCard } from '../theme/components/ThemedCard';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { Expense } from '../types';
import { useTranslation } from 'react-i18next';
import { useIsRTL } from '../hooks/useIsRTL';

type Props = {
  item: Expense;
  onConfirmDelete: (id: string) => Promise<void>;
  onEdit?: (id: string) => void;
  formatCurrency: (amount: number) => string;
  formatDate: (date: Date | string) => string;
  getUserName: (userId: string) => string;
  getActualUserName?: (userId: string) => string; // For debt settlement messages
  currentUserId?: string;
};

export default function ExpenseRow({ 
  item, 
  onConfirmDelete, 
  onEdit,
  formatCurrency, 
  formatDate, 
  getUserName,
  getActualUserName,
  currentUserId
}: Props) {
  const [isDeleting, setIsDeleting] = useState(false);
  const { t } = useTranslation();
  const isRTL = useIsRTL();
  const themed = useThemedStyles(tk => ({
    row: { backgroundColor: tk.colors.card },
    title: { color: tk.colors.text.primary },
    textSecondary: { color: tk.colors.text.secondary },
    borderColor: { borderColor: tk.colors.border.primary },
    amount: { color: tk.colors.text.primary },
    date: { color: tk.colors.text.secondary },
    description: { color: tk.colors.text.secondary },
  }));

  const confirmDelete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(()=>{});
    Alert.alert(
      t('expenseRow.deleteTitle'),
      t('expenseRow.deleteMessage', { title: item.title }),
      [
        { text: t('expenseRow.cancel'), style: 'cancel' },
        {
          text: t('expenseRow.delete'),
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
    // Parse the message to replace user IDs with names
    let displayMessage = item.description || '';
    if (displayMessage && getActualUserName) {
      // Replace user IDs with actual names
      const fromUserId = item.paidBy;
      const toUserId = item.participants.find(p => p !== fromUserId);
      if (fromUserId && toUserId) {
        const fromUserName = getActualUserName(fromUserId);
        const toUserName = getActualUserName(toUserId);
        displayMessage = displayMessage.replace(fromUserId, fromUserName).replace(toUserId, toUserName);
      }
    }

    return (
      <View style={styles.debtSettlementRow}>
        <View 
          style={[
            styles.debtSettlementContent,
            {
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'flex-start'
            }
          ]}
        >
          <View style={styles.debtSettlementIcon}>
            <Ionicons name="checkmark-circle" size={16} color="#6b7280" />
          </View>
          <View 
            style={[
              styles.debtSettlementTextContainer,
              {
                marginStart: isRTL ? 0 : 8,
                marginEnd: isRTL ? 8 : 0
              }
            ]}
          >
            <Text style={styles.debtSettlementTitle}>{item.title}</Text>
            <Text style={styles.debtSettlementMessage}>{displayMessage}</Text>
            <Text style={styles.debtSettlementDate}>{formatDate(item.date)}</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <ThemedCard style={[styles.row, { borderWidth: 1, ...themed.borderColor }]}>
      <View 
        style={[
          styles.content,
          {
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'flex-start'
          }
        ]}
      >
        <View 
          style={[
            styles.titleContainer,
            {
              marginStart: isRTL ? 0 : 12,
              marginEnd: isRTL ? 12 : 0
            }
          ]}
        >
          <ThemedText style={[styles.title, themed.title]}>{item.title}</ThemedText>
          <ThemedText style={[styles.date, themed.date]}>{formatDate(item.date)}</ThemedText>
          {item.description && (
            <ThemedText style={[styles.description, themed.description]}>{item.description}</ThemedText>
          )}
          {isParticipant && item.participants.length > 1 && (
            <View style={{ flexDirection: isRTL ? 'row-reverse' : 'row', alignItems: 'center', marginTop: 4 }}>
              <ThemedText style={[
                styles.personalInfo,
                styles.participantText
              ]}>
                {item.participants.length} {t('expenseRow.participantsLabel')} • 
              </ThemedText>
              <ThemedText style={[
                styles.personalInfo,
                styles.participantText,
                { marginStart: isRTL ? 0 : 4, marginEnd: isRTL ? 4 : 0 }
              ]}>
                {formatCurrency(personalShare)} {t('expenseRow.perPersonLabel')}
              </ThemedText>
            </View>
          )}
        </View>
        
        <View 
          style={[
            styles.amountContainer,
            {
              alignItems: isRTL ? 'flex-start' : 'flex-end'
            }
          ]}
        >
          <ThemedText style={[
            styles.amount, 
            isPayer ? styles.payerAmount : themed.amount
          ]}>
            {formatCurrency(item.amount)}
          </ThemedText>
          <ThemedText style={[styles.payer, themed.textSecondary]}>{t('expenseRow.paidBy', { name: getUserName(item.paidBy) })}</ThemedText>
          {!isParticipant && item.participants.length > 1 && (
            <ThemedText style={[styles.participants, themed.textSecondary]}>
              {t('expenseRow.participants', { count: item.participants.length, amount: formatCurrency(personalShare) })}
            </ThemedText>
          )}
        </View>
      </View>
      
      {/* Action buttons at the bottom */}
      <View 
        style={[
          styles.actionButtonsContainer,
          {
            flexDirection: isRTL ? 'row-reverse' : 'row'
          }
        ]}
      >
        <Pressable 
          onPress={handleEdit} 
          style={[
            styles.editButton,
            {
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center'
            }
          ]} 
          accessibilityLabel={t('expenseEdit.title')}
        >
          <Ionicons name="pencil-outline" size={12} color="#2563eb" />
          <Text style={styles.editButtonText}>{t('expenseRow.edit')}</Text>
        </Pressable>
        <Pressable 
          onPress={confirmDelete} 
          style={[
            styles.deleteButton, 
            isDeleting && styles.deleteButtonDisabled,
            {
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center'
            }
          ]} 
          accessibilityLabel={t('expenseRow.delete')}
          disabled={isDeleting}
        >
          {isDeleting ? (
            <Ionicons name="hourglass-outline" size={12} color="#9ca3af" />
          ) : (
            <Ionicons name="trash-outline" size={12} color="#dc2626" />
          )}
          <Text style={[styles.deleteButtonText, isDeleting && styles.deleteButtonTextDisabled]}>
            {isDeleting ? t('expenseRow.deleting') : t('expenseRow.delete')}
          </Text>
        </Pressable>
      </View>
    </ThemedCard>
  );
}

const styles = StyleSheet.create({
  row: {
    backgroundColor: 'transparent',
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
    marginStart: 12,
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
  payerAmount: {
    color: '#10b981',
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
    backgroundColor: '#374151',
    marginBottom: 8,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  debtSettlementContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  debtSettlementIcon: {
    marginEnd: 10,
  },
  debtSettlementTextContainer: {
    flex: 1,
  },
  debtSettlementTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f9fafb',
    marginBottom: 2,
  },
  debtSettlementMessage: {
    fontSize: 13,
    color: '#d1d5db',
    marginBottom: 2,
  },
  debtSettlementDate: {
    fontSize: 11,
    color: '#9ca3af',
  },
});
