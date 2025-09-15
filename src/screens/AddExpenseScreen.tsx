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
import { getUserDisplayInfo } from '../utils/userDisplay';
import { Screen } from '../components/Screen';
import { AsyncButton } from '../components/AsyncButton';
import { NumericInput } from '../components/NumericInput';
import { useTranslation } from 'react-i18next';

export default function AddExpenseScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { currentUser, currentApartment, addExpense } = useStore();

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
      <View className="flex-1 bg-white justify-center items-center">
        <Text className="text-gray-500">{t('common.loading')}</Text>
      </View>
    );
  }

  const amountPerPerson = selectedParticipants.length > 0 
    ? parseFloat(amount) / selectedParticipants.length 
    : 0;

  return (
    <Screen withPadding={true} keyboardVerticalOffset={0}>
          {/* Title */}
          <View className="mb-6">
            <Text className="text-gray-700 text-base mb-2 font-medium">{t('addExpense.expenseName')}</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder={t('addExpense.expenseNamePh')}
              className="border border-gray-300 rounded-xl px-4 py-3 text-base"
              textAlign="right"
              returnKeyType="next"
              blurOnSubmit={false}
            />
          </View>

          {/* Amount */}
          <View className="mb-6">
            <Text className="text-gray-700 text-base mb-2 font-medium">{t('addExpense.amount')}</Text>
            <View className="flex-row items-center">
              <NumericInput
                value={amount}
                onChangeText={setAmount}
                placeholder="0"
                className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-base"
                textAlign="center"
              />
              <Text className="text-gray-700 text-lg mr-3">{t('shopping.shekel')}</Text>
            </View>
            {selectedParticipants.length > 0 && parseFloat(amount) > 0 && (
              <Text className="text-sm text-gray-500 mt-2 text-center">{t('addExpense.perPerson', { amount: `${amountPerPerson.toFixed(2)}${t('shopping.shekel')}` })}</Text>
            )}
          </View>

          {/* Participants */}
          <View className="mb-6">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-gray-700 text-base font-medium">{t('addExpense.participants')}</Text>
              <View className="flex-row">
                <Pressable
                  onPress={selectAllParticipants}
                  className="bg-blue-100 py-1 px-3 rounded-lg ml-2"
                >
                  <Text className="text-blue-700 text-sm">{t('addExpense.all')}</Text>
                </Pressable>
                <Pressable
                  onPress={clearAllParticipants}
                  className="bg-gray-100 py-1 px-3 rounded-lg"
                >
                  <Text className="text-gray-700 text-sm">{t('addExpense.clear')}</Text>
                </Pressable>
              </View>
            </View>

            {currentApartment.members.map((member) => (
              <Pressable
                key={member.id}
                onPress={() => toggleParticipant(member.id)}
                className="flex-row items-center py-3 px-4 bg-gray-50 rounded-xl mb-2"
              >
                <View className={cn(
                  "w-6 h-6 rounded border-2 items-center justify-center ml-3",
                  selectedParticipants.includes(member.id) 
                    ? "bg-blue-500 border-blue-500" 
                    : "border-gray-300"
                )}>
                  {selectedParticipants.includes(member.id) && (
                    <Ionicons name="checkmark" size={16} color="white" />
                  )}
                </View>
                <Text className="text-gray-900 flex-1">
                  {getUserDisplayInfo(member).displayName} {member.id === currentUser.id && `(${t('common.you')})`}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Description */}
          <View className="mb-8">
            <Text className="text-gray-700 text-base mb-2 font-medium">{t('addExpense.description')}</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder={t('addExpense.descriptionPh')}
              className="border border-gray-300 rounded-xl px-4 py-3 text-base"
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
            onPress={() => navigation.goBack()}
            className="py-3"
          >
            <Text className="text-gray-500 text-center">{t('addExpense.cancel')}</Text>
          </Pressable>
    </Screen>
  );
}