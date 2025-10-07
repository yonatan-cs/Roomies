import React, { useState } from 'react';
import { View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useStore } from '../state/store';
import { Screen } from '../components/Screen';
import AddExpenseModal from '../components/AddExpenseModal';
import { useTranslation } from 'react-i18next';
import { ThemedView } from '../theme/components/ThemedView';
import { ThemedText } from '../theme/components/ThemedText';
import { useThemedStyles } from '../theme/useThemedStyles';

export default function AddExpenseScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { currentUser, currentApartment } = useStore();
  const themed = useThemedStyles(tk => ({
    textSecondary: { color: tk.colors.text.secondary },
  }));

  const [showModal, setShowModal] = useState(true);

  if (!currentUser || !currentApartment) {
    return (
      <ThemedView className="flex-1 justify-center items-center">
        <ThemedText style={themed.textSecondary}>{t('common.loading')}</ThemedText>
      </ThemedView>
    );
  }

  return (
    <Screen withPadding={false} keyboardVerticalOffset={0}>
      <AddExpenseModal
        visible={showModal}
        onClose={() => {
          setShowModal(false);
          navigation.goBack();
        }}
        onSuccess={() => {
          setShowModal(false);
          navigation.goBack();
        }}
        showAsModal={false}
        title={t('addExpense.add')}
      />
    </Screen>
  );
}