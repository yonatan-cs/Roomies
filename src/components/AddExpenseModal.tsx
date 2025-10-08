import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  Alert,
  TouchableWithoutFeedback,
  Keyboard,
  Animated,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useStore } from '../state/store';
import { cn } from '../utils/cn';
import { getDisplayName } from '../utils/userDisplay';
import { AsyncButton } from './AsyncButton';
import { NumericInput } from './NumericInput';
import { useTranslation } from 'react-i18next';
import { useIsRTL } from '../hooks/useIsRTL';
import { ThemedCard } from '../theme/components/ThemedCard';
import { ThemedText } from '../theme/components/ThemedText';
import { useThemedStyles } from '../theme/useThemedStyles';
import { useTheme } from '../theme/ThemeProvider';
import { impactLight } from '../utils/haptics';

// Keyboard lift hook for modal
function useKeyboardLift() {
  const shift = React.useRef(new Animated.Value(0)).current;
  const [cardH, setCardH] = useState(0);
  const [cardY, setCardY] = useState(0);

  useEffect(() => {
    const winH = require('react-native').Dimensions.get('window').height;
    const margin = 12;

    const onShow = (e: any) => {
      const kbH = e?.endCoordinates?.height ?? 0;
      const cardBottom = cardY + cardH;
      const overflow = cardBottom + kbH + margin - winH;
      const needed = Math.max(0, overflow);
      Animated.timing(shift, { toValue: needed, duration: 160, useNativeDriver: true }).start();
    };
    const onHide = () => {
      Animated.timing(shift, { toValue: 0, duration: 160, useNativeDriver: true }).start();
    };

    const subShow = require('react-native').Platform.OS === 'ios'
      ? Keyboard.addListener('keyboardWillShow', onShow)
      : Keyboard.addListener('keyboardDidShow', onShow);
    const subHide = require('react-native').Platform.OS === 'ios'
      ? Keyboard.addListener('keyboardWillHide', onHide)
      : Keyboard.addListener('keyboardDidHide', onHide);

    return () => {
      subShow?.remove?.();
      subHide?.remove?.();
    };
  }, [cardH, cardY, shift]);

  const onLayoutCard = (e: any) => {
    const { height, y } = e.nativeEvent.layout;
    setCardH(height);
    setCardY(y);
  };

  const animatedStyle = React.useMemo(
    () => ({ transform: [{ translateY: Animated.multiply(shift, -1) as any }] }),
    [shift]
  );

  return { animatedStyle, onLayoutCard };
}

interface AddExpenseModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  title?: string;
  showAsModal?: boolean; // true for modal, false for screen
}

export default function AddExpenseModal({ 
  visible, 
  onClose, 
  onSuccess,
  title,
  showAsModal = true 
}: AddExpenseModalProps) {
  const { t } = useTranslation();
  const isRTL = useIsRTL();
  const { theme, activeScheme } = useTheme();
  const { currentUser, currentApartment, addExpense } = useStore();
  const themed = useThemedStyles(tk => ({
    surfaceBg: { backgroundColor: tk.colors.surface },
    textSecondary: { color: tk.colors.text.secondary },
    borderColor: { borderColor: tk.colors.border.primary },
    backgroundBg: { backgroundColor: tk.colors.background },
  }));

  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDescription, setExpenseDescription] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Keyboard lift hook for modal
  const keyboardLift = useKeyboardLift();

  // Initialize participants when modal opens
  useEffect(() => {
    if (visible && currentApartment) {
      setSelectedParticipants(currentApartment.members.map(m => m.id));
    }
  }, [visible, currentApartment]);

  // Reset form when modal closes
  useEffect(() => {
    if (!visible) {
      setExpenseTitle('');
      setExpenseAmount('');
      setExpenseDescription('');
      setSelectedParticipants([]);
      setIsAddingExpense(false);
      setSelectedDate(new Date());
      setShowDatePicker(false);
    }
  }, [visible]);

  // Handle Add Expense
  const handleAddExpense = async () => {
    if (!expenseTitle.trim()) {
      Alert.alert(t('common.error'), t('dashboard.alerts.enterExpenseName'));
      return;
    }

    const numAmount = parseFloat(expenseAmount);
    if (!numAmount || numAmount <= 0) {
      Alert.alert(t('common.error'), t('dashboard.alerts.enterValidAmount'));
      return;
    }

    if (selectedParticipants.length === 0) {
      Alert.alert(t('common.error'), t('dashboard.alerts.selectAtLeastOneParticipant'));
      return;
    }

    if (!currentUser) {
      Alert.alert(t('common.error'), t('dashboard.alerts.userNotLoggedIn'));
      return;
    }

    setIsAddingExpense(true);
    try {
      await addExpense({
        title: expenseTitle.trim(),
        amount: numAmount,
        paidBy: currentUser.id,
        participants: selectedParticipants,
        category: 'other',
        description: expenseDescription.trim() || undefined,
        date: selectedDate,
      });

      // Close modal and call success callback
      onClose();
      onSuccess?.();
    } catch (error) {
      console.error('Error adding expense:', error);
      Alert.alert(t('common.error'), t('dashboard.alerts.cannotAddExpense'));
    } finally {
      setIsAddingExpense(false);
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

  // Format date for display
  const formatDateDisplay = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const compareDate = new Date(date);
    compareDate.setHours(0, 0, 0, 0);
    
    if (compareDate.getTime() === today.getTime()) {
      return t('addExpense.today');
    }
    
    const locale = appLanguage === 'he' ? 'he-IL' : 'en-US';
    return new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(date);
  };

  // Handle date change from picker
  const handleDateChange = (event: any, newDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (newDate) {
      setSelectedDate(newDate);
    }
  };

  const appLanguage = useStore(s => s.appLanguage);

  if (!currentUser || !currentApartment) {
    return null;
  }

  const amountPerPerson = selectedParticipants.length > 0 
    ? parseFloat(expenseAmount) / selectedParticipants.length 
    : 0;

  const modalTitle = title || t('dashboard.actionAddExpense');

  // If showAsModal is false, render as screen content (for AddExpenseScreen)
  if (!showAsModal) {
    return (
      <View style={themed.backgroundBg} className="flex-1">
        {/* Title */}
        <View className="mb-6">
          <ThemedText className="text-base mb-2 font-medium" style={themed.textSecondary}>
            {t('addExpense.expenseName')}
          </ThemedText>
          <TextInput
            value={expenseTitle}
            onChangeText={setExpenseTitle}
            placeholder={t('addExpense.expenseNamePh')}
            className="border rounded-xl px-4 py-3 text-base"
            style={themed.borderColor}
            textAlign={isRTL ? 'right' : 'left'}
            returnKeyType="next"
            blurOnSubmit={false}
          />
        </View>

        {/* Amount and Date in one row */}
        <View className="mb-6">
          <View 
            className="gap-3 mb-2"
            style={{ 
              flexDirection: isRTL ? 'row-reverse' : 'row'
            }}
          >
            {/* Amount */}
            <View className="flex-1">
              <ThemedText className="text-base mb-2 font-medium" style={themed.textSecondary}>
                {t('addExpense.amount')}
              </ThemedText>
              <View 
                className="items-center"
                style={{ 
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center'
                }}
              >
                <NumericInput
                  value={expenseAmount}
                  onChangeText={setExpenseAmount}
                  placeholder="0"
                  className="flex-1 border rounded-xl px-4 py-3 text-base"
                  style={themed.borderColor}
                  textAlign="center"
                />
                <ThemedText className="text-lg" style={[themed.textSecondary, isRTL ? { marginEnd: 8 } : { marginStart: 8 }]}>
                  {t('shopping.shekel')}
                </ThemedText>
              </View>
            </View>

            {/* Date */}
            <View className="flex-1">
              <ThemedText className="text-base mb-2 font-medium" style={themed.textSecondary}>
                {t('addExpense.date')}
              </ThemedText>
              <Pressable
                onPress={() => {
                  impactLight();
                  setShowDatePicker(true);
                }}
                className="border rounded-xl px-4 py-3"
                style={themed.borderColor}
              >
                <View 
                  className="items-center"
                  style={{ 
                    flexDirection: isRTL ? 'row-reverse' : 'row',
                    alignItems: 'center'
                  }}
                >
                  <Ionicons 
                    name="calendar-outline" 
                    size={20} 
                    color={theme.colors.text.secondary} 
                    style={isRTL ? { marginStart: 8 } : { marginEnd: 8 }}
                  />
                  <ThemedText className="text-base">
                    {formatDateDisplay(selectedDate)}
                  </ThemedText>
                </View>
              </Pressable>
            </View>
          </View>
          
          {selectedParticipants.length > 0 && parseFloat(expenseAmount) > 0 && (
            <ThemedText className="text-sm mt-1 text-center" style={themed.textSecondary}>
              {t('addExpense.perPerson', { amount: `${amountPerPerson.toFixed(2)}${t('shopping.shekel')}` })}
            </ThemedText>
          )}
          
          {showDatePicker && (
            <DateTimePicker
              value={selectedDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleDateChange}
              maximumDate={new Date()}
              locale={appLanguage === 'he' ? 'he-IL' : 'en-US'}
            />
          )}
          {showDatePicker && Platform.OS === 'ios' && (
            <Pressable
              onPress={() => setShowDatePicker(false)}
              className="mt-2 py-2 px-4 rounded-xl bg-blue-500"
            >
              <Text style={{ textAlign: 'center', color: '#ffffff' }} className="font-medium w-full">
                {t('common.ok')}
              </Text>
            </Pressable>
          )}
        </View>

        {/* Participants */}
        <View className="mb-6">
          <View 
            className="items-center mb-3"
            style={{ 
              flexDirection: isRTL ? 'row-reverse' : 'row',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <ThemedText className="text-base font-medium flex-1" style={themed.textSecondary}>
              {t('addExpense.participants')}
            </ThemedText>
            <View 
              className="items-center"
              style={{ 
                flexDirection: isRTL ? 'row-reverse' : 'row',
                alignItems: 'center'
              }}
            >
              <Pressable
                onPress={selectAllParticipants}
                className={cn(
                  "bg-blue-100 py-1 px-3 rounded-lg",
                  isRTL ? "mr-2" : "ml-2"
                )}
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

          <View 
            style={{ 
              alignItems: isRTL ? 'flex-end' : 'flex-start'
            }}
          >
            {currentApartment.members.map((member) => (
              <Pressable
                key={member.id}
                onPress={() => toggleParticipant(member.id)}
                className="items-center py-3 px-4 rounded-xl mb-2"
                style={{
                  ...themed.surfaceBg,
                  flexDirection: isRTL ? 'row-reverse' : 'row',
                  alignItems: 'center',
                  alignSelf: isRTL ? 'flex-end' : 'flex-start'
                }}
              >
                <View className={cn(
                  "w-6 h-6 rounded border-2 items-center justify-center",
                  selectedParticipants.includes(member.id) 
                    ? "bg-blue-500 border-blue-500" 
                    : "",
                  isRTL ? "mr-3" : "ml-3"
                )} style={!selectedParticipants.includes(member.id) ? themed.borderColor : undefined}>
                  {selectedParticipants.includes(member.id) && (
                    <Ionicons name="checkmark" size={16} color="white" />
                  )}
                </View>
                <ThemedText 
                  className="flex-1"
                  style={selectedParticipants.includes(member.id) ? { color: '#ffffff' } : undefined}
                >
                  {getDisplayName(member)} {member.id === currentUser.id && `(${t('common.you')})`}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Description */}
        <View className="mb-8">
          <ThemedText className="text-base mb-2 font-medium" style={themed.textSecondary}>
            {t('addExpense.description')}
          </ThemedText>
          <TextInput
            value={expenseDescription}
            onChangeText={setExpenseDescription}
            placeholder={t('addExpense.descriptionPh')}
            className="border rounded-xl px-4 py-3 text-base"
            style={themed.borderColor}
            textAlign={isRTL ? 'right' : 'left'}
            multiline
            numberOfLines={3}
            returnKeyType="done"
            blurOnSubmit={true}
            onSubmitEditing={() => Keyboard.dismiss()}
          />
        </View>

        {/* Add Button */}
        <AsyncButton 
          title={t('addExpense.add')} 
          onPress={handleAddExpense} 
          loadingText={t('addExpense.adding')} 
          className="mb-6" 
        />

        {/* Cancel Button */}
        <Pressable
          onPress={() => {
            impactLight();
            onClose();
          }}
          className="py-3"
        >
          <Text style={{ textAlign: 'center', color: themed.textSecondary.color }} className="w-full">
            {t('addExpense.cancel')}
          </Text>
        </Pressable>
      </View>
    );
  }

  // Render as modal
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View className="flex-1 bg-black/50 justify-center items-center px-6">
          <Animated.View
            onLayout={keyboardLift.onLayoutCard}
            style={[{ width: '100%', maxWidth: 400 }, keyboardLift.animatedStyle]}
          >
            <ThemedCard className="rounded-2xl p-6">
              <ThemedText className="text-xl font-semibold mb-6 w-full" style={{ textAlign: 'center' }}>
                {modalTitle}
              </ThemedText>

              {/* Expense Title */}
              <View className="mb-6">
                <ThemedText className="text-base mb-2" style={themed.textSecondary}>
                  {t('expenseEdit.expenseName')}
                </ThemedText>
                <TextInput
                  value={expenseTitle}
                  onChangeText={setExpenseTitle}
                  placeholder={t('budget.expenseNamePlaceholder')}
                  className="border rounded-xl px-4 py-3 text-base"
                  style={themed.borderColor}
                  textAlign={isRTL ? 'right' : 'left'}
                  autoFocus
                  returnKeyType="next"
                  onSubmitEditing={Keyboard.dismiss}
                  blurOnSubmit={false}
                />
              </View>

              {/* Amount and Date in one row */}
              <View className="mb-6">
                <View 
                  className="gap-3"
                  style={{ 
                    flexDirection: isRTL ? 'row-reverse' : 'row'
                  }}
                >
                  {/* Amount */}
                  <View className="flex-1">
                    <ThemedText className="text-base mb-2" style={themed.textSecondary}>
                      {t('expenseEdit.amount')}
                    </ThemedText>
                    <NumericInput
                      value={expenseAmount}
                      onChangeText={setExpenseAmount}
                      placeholder="0"
                      className="border rounded-xl px-4 py-3 text-base"
                      style={themed.borderColor}
                      textAlign={isRTL ? 'right' : 'left'}
                      returnKeyType="next"
                      onSubmitEditing={Keyboard.dismiss}
                      blurOnSubmit={false}
                    />
                  </View>

                  {/* Date */}
                  <View className="flex-1">
                    <ThemedText className="text-base mb-2" style={themed.textSecondary}>
                      {t('addExpense.date')}
                    </ThemedText>
                    <Pressable
                      onPress={() => {
                        impactLight();
                        setShowDatePicker(true);
                      }}
                      className="border rounded-xl px-4 py-3"
                      style={themed.borderColor}
                    >
                      <View 
                        className="items-center"
                        style={{ 
                          flexDirection: isRTL ? 'row-reverse' : 'row',
                          alignItems: 'center'
                        }}
                      >
                        <Ionicons 
                          name="calendar-outline" 
                          size={20} 
                          color={theme.colors.text.secondary} 
                          style={isRTL ? { marginStart: 8 } : { marginEnd: 8 }}
                        />
                        <ThemedText className="text-base">
                          {formatDateDisplay(selectedDate)}
                        </ThemedText>
                      </View>
                    </Pressable>
                  </View>
                </View>
                
                {showDatePicker && (
                  <DateTimePicker
                    value={selectedDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={handleDateChange}
                    maximumDate={new Date()}
                    locale={appLanguage === 'he' ? 'he-IL' : 'en-US'}
                  />
                )}
                {showDatePicker && Platform.OS === 'ios' && (
                  <Pressable
                    onPress={() => setShowDatePicker(false)}
                    className="mt-2 py-2 px-4 rounded-xl bg-blue-500"
                  >
                    <Text style={{ textAlign: 'center', color: '#ffffff' }} className="font-medium w-full">
                      {t('common.ok')}
                    </Text>
                  </Pressable>
                )}
              </View>

              {/* Participants */}
              <View className="mb-6">
                <ThemedText className="text-base mb-2" style={themed.textSecondary}>
                  {t('expenseEdit.participants')}
                </ThemedText>
                <View 
                  className="flex-row flex-wrap"
                  style={{ 
                    justifyContent: isRTL ? 'flex-end' : 'flex-start'
                  }}
                >
                  {currentApartment.members.map((member) => (
                    <Pressable
                      key={member.id}
                      onPress={() => toggleParticipant(member.id)}
                      className={cn(
                        "mb-2 px-4 py-2 rounded-xl border-2",
                        selectedParticipants.includes(member.id)
                          ? "bg-blue-500 border-blue-500"
                          : "bg-white border-gray-300",
                        isRTL ? "ml-2" : "mr-2"
                      )}
                      style={!selectedParticipants.includes(member.id) ? themed.borderColor : undefined}
                    >
                      <Text className={cn(
                        "text-sm font-medium",
                        selectedParticipants.includes(member.id)
                          ? "text-white"
                          : "text-gray-700"
                      )}>
                        {getDisplayName(member)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Description */}
              <View className="mb-6">
                <ThemedText className="text-base mb-2" style={themed.textSecondary}>
                  {t('expenseEdit.description')}
                </ThemedText>
                <TextInput
                  value={expenseDescription}
                  onChangeText={setExpenseDescription}
                  placeholder={t('budget.additionalDetailsPlaceholder')}
                  className="border rounded-xl px-4 py-3 text-base"
                  style={themed.borderColor}
                  textAlign={isRTL ? 'right' : 'left'}
                  multiline
                  numberOfLines={3}
                  returnKeyType="done"
                  blurOnSubmit={true}
                  onSubmitEditing={() => Keyboard.dismiss()}
                />
              </View>

              {/* Action Buttons */}
              <View className="flex-row gap-3">
                <Pressable
                  onPress={() => {
                    impactLight();
                    onClose();
                  }}
                  className="flex-1 py-3 px-4 rounded-xl"
                  style={[
                    { backgroundColor: '#f3f4f6' },
                    activeScheme === 'dark' && { 
                      backgroundColor: theme.colors.card, 
                      borderColor: theme.colors.border.primary, 
                      borderWidth: require('react-native').StyleSheet.hairlineWidth 
                    }
                  ]}
                >
                  <Text 
                    style={[
                      { textAlign: 'center', color: '#374151' },
                      activeScheme === 'dark' && { color: theme.colors.text.primary }
                    ]}
                    className="font-medium w-full"
                  >
                    {t('expenseEdit.cancel')}
                  </Text>
                </Pressable>
                
                <AsyncButton
                  title={modalTitle}
                  onPress={handleAddExpense}
                  loadingText={t('addExpense.adding')}
                  className="flex-1"
                  disabled={isAddingExpense}
                />
              </View>
            </ThemedCard>
          </Animated.View>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}
