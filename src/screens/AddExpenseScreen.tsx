import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useStore } from '../state/store';
import { ExpenseCategory } from '../types';
import { cn } from '../utils/cn';
import { getUserDisplayInfo, getDisplayName } from '../utils/userDisplay';
import { Screen } from '../components/Screen';
import { AsyncButton } from '../components/AsyncButton';
import { NumericInput } from '../components/NumericInput';
import { useTranslation } from 'react-i18next';
import { ThemedCard } from '../theme/components/ThemedCard';
import { ThemedText } from '../theme/components/ThemedText';
import { ThemedView } from '../theme/components/ThemedView';
import { useThemedStyles } from '../theme/useThemedStyles';
import { impactMedium, impactLight, success, warning } from '../utils/haptics';

export default function AddExpenseScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { currentUser, currentApartment, addExpense } = useStore();
  const themed = useThemedStyles(tk => ({
    surfaceBg: { backgroundColor: tk.colors.surface },
    textSecondary: { color: tk.colors.text.secondary },
    borderColor: { borderColor: tk.colors.border.primary },
  }));

  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>(
    currentApartment?.members.map(m => m.id) || []
  );

  const handleAddExpense = async () => {
    if (!title.trim()) {
      Alert.alert(t('common.error'), t('budget.addExpenseModal.expenseName'));
      return;
    }

    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      Alert.alert(t('common.error'), t('budget.addExpenseModal.amount'));
      return;
    }

    if (selectedParticipants.length === 0) {
      Alert.alert(t('common.error'), t('shopping.alerts.needParticipants'));
      return;
    }

    if (!currentUser) {
      Alert.alert(t('common.error'), t('auth.login'));
      return;
    }

    await addExpense({
      title: title.trim(),
      amount: numAmount,
      paidBy: currentUser.id,
      participants: selectedParticipants,
      category: 'other', // Default category since we removed category selection
      description: description.trim() || undefined,
    });

    navigation.goBack();
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
    return (
      <ThemedView className="flex-1 justify-center items-center">
        <ThemedText style={themed.textSecondary}>{t('common.loading')}</ThemedText>
      </ThemedView>
    );
  }

  const amountPerPerson = selectedParticipants.length > 0 
    ? parseFloat(amount) / selectedParticipants.length 
    : 0;

  return (
    <Screen withPadding={true} keyboardVerticalOffset={0}>
          {/* Title */}
          <View className="mb-6">
            <ThemedText className="text-base mb-2 font-medium" style={themed.textSecondary}>{t('addExpense.expenseName')}</ThemedText>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder={t('addExpense.expenseNamePh')}
              className="border rounded-xl px-4 py-3 text-base"
              style={themed.borderColor}
              textAlign="right"
              returnKeyType="next"
              blurOnSubmit={false}
            />
          </View>

          {/* Amount */}
          <View className="mb-6">
            <ThemedText className="text-base mb-2 font-medium" style={themed.textSecondary}>{t('addExpense.amount')}</ThemedText>
            <View className="flex-row items-center">
              <NumericInput
                value={amount}
                onChangeText={setAmount}
                placeholder="0"
                className="flex-1 border rounded-xl px-4 py-3 text-base"
                style={themed.borderColor}
                textAlign="center"
              />
              <ThemedText className="text-lg mr-3" style={themed.textSecondary}>{t('shopping.shekel')}</ThemedText>
            </View>
            {selectedParticipants.length > 0 && parseFloat(amount) > 0 && (
              <ThemedText className="text-sm mt-2 text-center" style={themed.textSecondary}>{t('addExpense.perPerson', { amount: `${amountPerPerson.toFixed(2)}${t('shopping.shekel')}` })}</ThemedText>
            )}
          </View>

          {/* Participants */}
          <View className="mb-6">
            <View className="flex-row items-center justify-between mb-3">
              <ThemedText className="text-base font-medium" style={themed.textSecondary}>{t('addExpense.participants')}</ThemedText>
              <View className="flex-row">
                <Pressable
                  onPress={selectAllParticipants}
                  className="bg-blue-100 py-1 px-3 rounded-lg ml-2"
                >
                  <Text className="text-blue-700 text-sm">{t('addExpense.all')}</Text>
                </Pressable>
                <Pressable
                  onPress={clearAllParticipants}
                  className="py-1 px-3 rounded-lg"
                  style={themed.surfaceBg}
                >
                  <ThemedText className="text-sm" style={themed.textSecondary}>{t('addExpense.clear')}</ThemedText>
                </Pressable>
              </View>
            </View>

            {currentApartment.members.map((member) => (
              <Pressable
                key={member.id}
                onPress={() => toggleParticipant(member.id)}
                className="flex-row items-center py-3 px-4 rounded-xl mb-2"
                style={themed.surfaceBg}
              >
                <View className={cn(
                  "w-6 h-6 rounded border-2 items-center justify-center ml-3",
                  selectedParticipants.includes(member.id) 
                    ? "bg-blue-500 border-blue-500" 
                    : ""
                )} style={!selectedParticipants.includes(member.id) ? themed.borderColor : undefined}>
                  {selectedParticipants.includes(member.id) && (
                    <Ionicons name="checkmark" size={16} color="white" />
                  )}
                </View>
                <ThemedText className="flex-1">
                  {getDisplayName(member)} {member.id === currentUser.id && `(${t('common.you')})`}
                </ThemedText>
              </Pressable>
            ))}
          </View>

          {/* Description */}
          <View className="mb-8">
            <ThemedText className="text-base mb-2 font-medium" style={themed.textSecondary}>{t('addExpense.description')}</ThemedText>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder={t('addExpense.descriptionPh')}
              className="border rounded-xl px-4 py-3 text-base"
              style={themed.borderColor}
              textAlign="right"
              multiline
              numberOfLines={3}
              returnKeyType="done"
              blurOnSubmit={true}
              onSubmitEditing={() => Keyboard.dismiss()}
            />
          </View>

          {/* Add Button */}
          <AsyncButton title={t('addExpense.add')} onPress={handleAddExpense} loadingText={t('addExpense.adding')} className="mb-6" />

          {/* Cancel Button */}
          <Pressable
            onPress={() => {
              impactLight(); // Haptic feedback for cancel action
              navigation.goBack();
            }}
            className="py-3"
          >
            <ThemedText className="text-center" style={themed.textSecondary}>{t('addExpense.cancel')}</ThemedText>
          </Pressable>
    </Screen>
  );
}