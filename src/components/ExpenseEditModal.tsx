import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
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
import { useTranslation } from 'react-i18next';

type Props = {
  visible: boolean;
  expense: Expense | null;
  onClose: () => void;
  onSuccess: () => void;
};

export default function ExpenseEditModal({ visible, expense, onClose, onSuccess }: Props) {
  const { t } = useTranslation();
  const { currentUser, currentApartment, updateExpense } = useStore();

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
        <View className="flex-1 bg-white">
          {/* Header */}
          <View className="flex-row items-center justify-between px-6 py-4 border-b border-gray-200">
            <Pressable onPress={onClose} className="p-2">
              <Ionicons name="close" size={24} color="#374151" />
            </Pressable>
            <Text className="text-lg font-semibold text-gray-900">{t('expenseEdit.title')}</Text>
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
              <Text className="text-gray-700 text-base mb-2 font-medium">
                {t('expenseEdit.expenseName')}
              </Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder={t('expenseEdit.examplePlaceholder')}
                className="border border-gray-300 rounded-xl px-4 py-3 text-base"
                textAlign="right"
                returnKeyType="next"
                blurOnSubmit={false}
              />
            </View>

            {/* Amount */}
            <View className="mb-6">
              <Text className="text-gray-700 text-base mb-2 font-medium">
                {t('expenseEdit.amount')}
              </Text>
              <NumericInput
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                className="border border-gray-300 rounded-xl px-4 py-3 text-base"
                textAlign="right"
              />
              {selectedParticipants.length > 0 && amount && (
                <Text className="text-sm text-gray-500 mt-2 text-right">
                  {t('expenseEdit.perPerson', { amount: amountPerPerson.toFixed(2) })}
                </Text>
              )}
            </View>

            {/* Participants */}
            <View className="mb-6">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-gray-700 text-base font-medium">
                  {t('expenseEdit.participants')}
                </Text>
                <View className="flex-row">
                  <Pressable
                    onPress={selectAllParticipants}
                    className="bg-blue-100 py-1 px-3 rounded-lg mr-2"
                  >
                    <Text className="text-blue-700 text-sm">{t('expenseEdit.selectAll')}</Text>
                  </Pressable>
                  <Pressable
                    onPress={clearAllParticipants}
                    className="bg-gray-100 py-1 px-3 rounded-lg"
                  >
                    <Text className="text-gray-700 text-sm">{t('expenseEdit.clearAll')}</Text>
                  </Pressable>
                </View>
              </View>
              
              <View className="flex-row flex-wrap gap-2">
                {currentApartment.members.map((member) => (
                  <Pressable
                    key={member.id}
                    onPress={() => toggleParticipant(member.id)}
                    className={cn(
                      "flex-row items-center px-3 py-2 rounded-lg border",
                      selectedParticipants.includes(member.id)
                        ? "bg-blue-100 border-blue-300"
                        : "bg-gray-50 border-gray-200"
                    )}
                  >
                    <Ionicons 
                      name={selectedParticipants.includes(member.id) ? "checkmark-circle" : "ellipse-outline"} 
                      size={16} 
                      color={selectedParticipants.includes(member.id) ? "#3b82f6" : "#6b7280"} 
                    />
                    <Text className={cn(
                      "mr-2 text-sm font-medium",
                      selectedParticipants.includes(member.id) ? "text-blue-700" : "text-gray-700"
                    )}>
                      {member.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Description */}
            <View className="mb-6">
              <Text className="text-gray-700 text-base mb-2 font-medium">
                {t('expenseEdit.description')}
              </Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder={t('expenseEdit.additionalDetailsPlaceholder')}
                className="border border-gray-300 rounded-xl px-4 py-3 text-base"
                textAlign="right"
                multiline
                numberOfLines={3}
                returnKeyType="done"
                blurOnSubmit={true}
                onSubmitEditing={() => Keyboard.dismiss()}
              />
            </View>

            {/* Impact Preview */}
            {showImpactPreview && (
              <View className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
                <Text className="text-yellow-800 text-base font-semibold mb-3">
                  {t('common.confirm')}
                </Text>
                {calculateImpact()?.map((impact, index) => (
                  <View key={index} className="flex-row items-center justify-between mb-2">
                    <Text className="text-yellow-700 text-sm flex-1">
                      {impact.member.name}:
                    </Text>
                    <Text className={cn(
                      "text-sm font-medium",
                      impact.change > 0 ? "text-red-600" : 
                      impact.change < 0 ? "text-green-600" : "text-gray-600"
                    )}>
                      {impact.description}
                    </Text>
                  </View>
                ))}
                <View className="flex-row mt-3">
                  <Pressable
                    onPress={() => setShowImpactPreview(false)}
                    className="flex-1 bg-yellow-200 py-2 px-4 rounded-lg mr-2"
                  >
                    <Text className="text-yellow-800 text-center font-medium">{t('expenseEdit.cancel')}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setShowImpactPreview(false);
                      performUpdate();
                    }}
                    className="flex-1 bg-green-500 py-2 px-4 rounded-lg"
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
              <Text className="text-gray-500 text-center">
                {t('expenseEdit.cancel')}
              </Text>
            </Pressable>
            </ScrollView>
          </TouchableWithoutFeedback>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
