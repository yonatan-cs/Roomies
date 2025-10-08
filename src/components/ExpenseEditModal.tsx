import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Alert,
  Modal,
  TouchableWithoutFeedback,
  Keyboard,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../state/store';
import { Expense } from '../types';
import { cn } from '../utils/cn';
import { AsyncButton } from './AsyncButton';
import { NumericInput } from './NumericInput';
import { AppTextInput } from './AppTextInput';
import { useTranslation } from 'react-i18next';
import { ThemedCard } from '../theme/components/ThemedCard';
import { ThemedText } from '../theme/components/ThemedText';
import { ThemedView } from '../theme/components/ThemedView';
import { useThemedStyles } from '../theme/useThemedStyles';
import { useTheme } from '../theme/ThemeProvider';
import { useIsRTL } from '../hooks/useIsRTL';

type Props = {
  visible: boolean;
  expense: Expense | null;
  onClose: () => void;
  onSuccess: () => void;
};

export default function ExpenseEditModal({ visible, expense, onClose, onSuccess }: Props) {
  const { t } = useTranslation();
  const isRTL = useIsRTL();
  const { theme } = useTheme();
  const { currentUser, currentApartment, updateExpense } = useStore();
  const themed = useThemedStyles(tk => ({
    surfaceBg: { backgroundColor: tk.colors.surface },
    textSecondary: { color: tk.colors.text.secondary },
    borderColor: { borderColor: tk.colors.border.primary },
    backgroundBg: { backgroundColor: tk.colors.background },
    cardBg: { backgroundColor: tk.colors.card },
    textPrimary: { color: tk.colors.text.primary },
    primaryColor: { color: tk.colors.primary },
    primaryBg: { backgroundColor: tk.colors.primary },
    successBg: { backgroundColor: tk.colors.status.success },
    warningBg: { backgroundColor: tk.colors.status.warning },
    warningBorder: { borderColor: tk.colors.status.warning },
    warningText: { color: tk.colors.status.warning },
    errorText: { color: tk.colors.status.error },
    successText: { color: tk.colors.status.success },
  }));

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [showImpactPreview, setShowImpactPreview] = useState(false);

  useEffect(() => {
    if (expense) {
      setTitle(expense.title);
      setAmount(expense.amount.toString());
      setDescription(expense.description || '');
      setSelectedParticipants(expense.participants);
    }
  }, [expense]);

  const handleUpdateExpense = async () => {
    if (!title.trim()) {
      Alert.alert(t('common.error'), t('expenseEdit.alerts.enterTitle'));
      return;
    }

    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      Alert.alert(t('common.error'), t('expenseEdit.alerts.enterValidAmount'));
      return;
    }

    if (selectedParticipants.length === 0) {
      Alert.alert(t('common.error'), t('expenseEdit.alerts.selectParticipants'));
      return;
    }

    if (!currentUser || !expense) {
      Alert.alert(t('common.error'), t('expenseEdit.alerts.userNotLoggedIn'));
      return;
    }

    // Check if there are significant changes that might affect balances
    const originalAmount = expense.amount;
    const originalParticipants = expense.participants;
    const amountChanged = Math.abs(numAmount - originalAmount) > 0.01;
    const participantsChanged = 
      selectedParticipants.length !== originalParticipants.length ||
      !selectedParticipants.every(id => originalParticipants.includes(id));

    if (amountChanged || participantsChanged) {
      const changePercentage = originalAmount > 0 ? Math.abs((numAmount - originalAmount) / originalAmount) * 100 : 0;
      
      if (changePercentage > 50) {
        Alert.alert(
          t('expenseEdit.significantChange'),
          t('expenseEdit.changeMsg', { percent: changePercentage.toFixed(0) }),
          [
            { text: t('expenseEdit.cancel'), style: 'cancel' },
            { text: t('expenseEdit.confirm'), onPress: () => performUpdate() }
          ]
        );
        return;
      }
      
      // Show impact preview for any changes
      setShowImpactPreview(true);
      return;
    }

    await performUpdate();
  };

  const calculateImpact = () => {
    if (!expense || !currentApartment) return null;

    const numAmount = parseFloat(amount);
    const originalAmount = expense.amount;
    const originalParticipants = expense.participants;
    
    const originalShare = originalAmount / originalParticipants.length;
    const newShare = numAmount / selectedParticipants.length;
    
    const impact = currentApartment.members.map(member => {
      const wasParticipant = originalParticipants.includes(member.id);
      const isParticipant = selectedParticipants.includes(member.id);
      const isPayer = expense.paidBy === member.id;
      
      let change = 0;
      let description = '';
      
      if (isPayer) {
        // The payer's change is the difference in total amount
        change = numAmount - originalAmount;
        description = change > 0 ? t('expenseEdit.willPayMore', { amount: Math.abs(change).toFixed(2) }) : 
                     change < 0 ? t('expenseEdit.willPayLess', { amount: Math.abs(change).toFixed(2) }) : 
                     t('expenseEdit.noChange');
      } else if (wasParticipant && isParticipant) {
        // Participant in both - change in their share
        change = newShare - originalShare;
        description = change > 0 ? t('expenseEdit.willPayMore', { amount: Math.abs(change).toFixed(2) }) : 
                     change < 0 ? t('expenseEdit.willPayLess', { amount: Math.abs(change).toFixed(2) }) : 
                     t('expenseEdit.noChange');
      } else if (!wasParticipant && isParticipant) {
        // New participant
        change = newShare;
        description = t('expenseEdit.willPayNew', { amount: change.toFixed(2) });
      } else if (wasParticipant && !isParticipant) {
        // No longer participant
        change = -originalShare;
        description = t('expenseEdit.willNotPay');
      }
      
      return {
        member,
        change,
        description,
        wasParticipant,
        isParticipant,
        isPayer
      };
    }).filter(impact => impact.change !== 0 || impact.wasParticipant !== impact.isParticipant);
    
    return impact;
  };

  const performUpdate = async () => {
    if (!expense) return;
    
    const numAmount = parseFloat(amount);
    setLoading(true);
    try {
      await updateExpense(expense.id, {
        title: title.trim(),
        amount: numAmount,
        participants: selectedParticipants,
        description: description.trim() || undefined,
      });

      Alert.alert(t('common.success'), t('expenseEdit.alerts.updated'), [
        { text: t('common.ok'), onPress: () => {
          onSuccess();
          onClose();
        }}
      ]);
    } catch (error) {
      Alert.alert(t('common.error'), t('expenseEdit.alerts.updateFailed'));
      console.error('Error updating expense:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleParticipant = (userId: string) => {
    setSelectedParticipants(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const selectAllParticipants = () => {
    if (!currentApartment) return;
    setSelectedParticipants(currentApartment.members.map(m => m.id));
  };

  const clearAllParticipants = () => {
    setSelectedParticipants([]);
  };

  if (!currentUser || !currentApartment) {
    return null;
  }

  const amountPerPerson = selectedParticipants.length > 0 
    ? parseFloat(amount) / selectedParticipants.length 
    : 0;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ThemedView className="flex-1">
          {/* Header */}
          <View className="flex-row items-center justify-between px-6 py-4 border-b" style={themed.borderColor}>
            <Pressable onPress={onClose} className="p-2">
              <Ionicons name="close" size={24} color={theme.colors.text.primary} />
            </Pressable>
            <ThemedText className="text-lg font-semibold">{t('expenseEdit.title')}</ThemedText>
            <View className="w-8" />
          </View>

          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <ScrollView 
              className="flex-1 px-6 py-6"
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ flexGrow: 1 }}
            >
            {/* Title */}
            <View className="mb-6">
              <ThemedText className="text-base mb-2 font-medium" style={themed.textSecondary}>
                {t('expenseEdit.expenseName')}
              </ThemedText>
              <AppTextInput
                value={title}
                onChangeText={setTitle}
                placeholder={t('expenseEdit.examplePlaceholder')}
                className="border rounded-xl px-4 py-3 text-base"
                style={[themed.borderColor, themed.textPrimary, themed.cardBg]}
                returnKeyType="next"
                blurOnSubmit={false}
              />
            </View>

            {/* Amount */}
            <View className="mb-6">
              <ThemedText className="text-base mb-2 font-medium" style={themed.textSecondary}>
                {t('expenseEdit.amount')}
              </ThemedText>
              <NumericInput
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                className="border rounded-xl px-4 py-3 text-base"
                style={[themed.borderColor, themed.textPrimary, themed.cardBg]}
                textAlign="right"
              />
              {selectedParticipants.length > 0 && amount && (
                <ThemedText className="text-sm mt-2 text-right" style={themed.textSecondary}>
                  {t('expenseEdit.perPerson', { amount: amountPerPerson.toFixed(2) })}
                </ThemedText>
              )}
            </View>

            {/* Participants */}
            <View className="mb-6">
              <View className="flex-row items-center justify-between mb-3" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                <ThemedText className="text-base font-medium" style={themed.textSecondary}>
                  {t('expenseEdit.participants')}
                </ThemedText>
                <View className="flex-row" style={{ flexDirection: isRTL ? 'row-reverse' : 'row' }}>
                  <Pressable
                    onPress={selectAllParticipants}
                    className="py-1 px-3 rounded-lg"
                    style={[
                      { backgroundColor: theme.colors.primary + '20' },
                      isRTL ? { marginLeft: 8 } : { marginRight: 8 }
                    ]}
                  >
                    <Text style={{ color: theme.colors.primary }} className="text-sm">{t('expenseEdit.selectAll')}</Text>
                  </Pressable>
                  <Pressable
                    onPress={clearAllParticipants}
                    className="py-1 px-3 rounded-lg"
                    style={themed.surfaceBg}
                  >
                    <ThemedText className="text-sm" style={themed.textSecondary}>{t('expenseEdit.clearAll')}</ThemedText>
                  </Pressable>
                </View>
              </View>
              
              <View 
                style={{ 
                  alignItems: isRTL ? 'flex-end' : 'flex-start'
                }}
              >
                {currentApartment.members.map((member) => (
                  <Pressable
                    key={member.id}
                    onPress={() => toggleParticipant(member.id)}
                    className="items-center px-3 py-2 rounded-lg border mb-2"
                    style={[
                      selectedParticipants.includes(member.id) 
                        ? { backgroundColor: theme.colors.primary + '20', borderColor: theme.colors.primary }
                        : { backgroundColor: theme.colors.surface, ...themed.borderColor },
                      { 
                        flexDirection: isRTL ? 'row-reverse' : 'row',
                        alignItems: 'center',
                        alignSelf: isRTL ? 'flex-end' : 'flex-start'
                      }
                    ]}
                  >
                    <Ionicons 
                      name={selectedParticipants.includes(member.id) ? "checkmark-circle" : "ellipse-outline"} 
                      size={16} 
                      color={selectedParticipants.includes(member.id) ? theme.colors.primary : theme.colors.text.secondary} 
                    />
                    <ThemedText 
                      className="text-sm font-medium"
                      style={[
                        selectedParticipants.includes(member.id) 
                          ? { color: theme.colors.primary } 
                          : themed.textSecondary,
                        isRTL ? { marginLeft: 8 } : { marginRight: 8 }
                      ]}
                    >
                      {member.name}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Description */}
            <View className="mb-6">
              <ThemedText className="text-base mb-2 font-medium" style={themed.textSecondary}>
                {t('expenseEdit.description')}
              </ThemedText>
              <AppTextInput
                value={description}
                onChangeText={setDescription}
                placeholder={t('expenseEdit.additionalDetailsPlaceholder')}
                className="border rounded-xl px-4 py-3 text-base"
                style={[themed.borderColor, themed.textPrimary, themed.cardBg]}
                multiline
                numberOfLines={3}
                returnKeyType="done"
                blurOnSubmit={true}
                onSubmitEditing={() => Keyboard.dismiss()}
              />
            </View>

            {/* Impact Preview */}
            {showImpactPreview && (
              <View 
                className="mb-6 p-4 border rounded-xl"
                style={[
                  { backgroundColor: theme.colors.status.warning + '10' },
                  themed.warningBorder
                ]}
              >
                <ThemedText 
                  className="text-base font-semibold mb-3"
                  style={themed.warningText}
                >
                  {t('common.confirm')}
                </ThemedText>
                {calculateImpact()?.map((impact, index) => (
                  <View key={index} className="flex-row items-center justify-between mb-2">
                    <ThemedText 
                      className="text-sm flex-1"
                      style={themed.warningText}
                    >
                      {impact.member.name}:
                    </ThemedText>
                    <ThemedText 
                      className="text-sm font-medium"
                      style={impact.change > 0 ? themed.errorText : 
                             impact.change < 0 ? themed.successText : themed.textSecondary}
                    >
                      {impact.description}
                    </ThemedText>
                  </View>
                ))}
                <View className="flex-row mt-3">
                  <Pressable
                    onPress={() => setShowImpactPreview(false)}
                    className="flex-1 py-2 px-4 rounded-lg mr-2"
                    style={[themed.warningBg, { opacity: 0.3 }]}
                  >
                    <ThemedText 
                      className="text-center font-medium"
                      style={themed.warningText}
                    >
                      {t('expenseEdit.cancel')}
                    </ThemedText>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setShowImpactPreview(false);
                      performUpdate();
                    }}
                    className="flex-1 py-2 px-4 rounded-lg"
                    style={themed.successBg}
                  >
                    <Text className="text-white text-center font-medium">{t('expenseEdit.confirm')}</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* Update Button */}
            <AsyncButton
              title={t('expenseEdit.update')}
              onPress={handleUpdateExpense}
              loadingText={t('expenseEdit.updating')}
              disabled={showImpactPreview}
              className="mb-6"
            />

            {/* Cancel Button */}
            <Pressable
              onPress={onClose}
              disabled={loading}
              className="py-3"
            >
              <ThemedText className="text-center" style={themed.textSecondary}>
                {t('expenseEdit.cancel')}
              </ThemedText>
            </Pressable>
            </ScrollView>
          </TouchableWithoutFeedback>
        </ThemedView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
