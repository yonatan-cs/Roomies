import React from "react";
import { Modal, View, Text, Pressable } from "react-native";
import { useTranslation } from 'react-i18next';

interface ConfirmModalProps {
  visible: boolean;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

export default function ConfirmModal({
  visible,
  title,
  message,
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const { t } = useTranslation();
  const finalTitle = title ?? t('common.confirm');
  const finalMessage = message ?? '';
  const finalConfirm = confirmText ?? t('common.confirm');
  const finalCancel = cancelText ?? t('common.cancel');
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View className="flex-1 bg-black/40 items-center justify-center px-6">
        <View className="bg-white rounded-2xl w-full p-6">
          {!!finalTitle && (
            <Text className="text-lg font-bold text-gray-900 text-center mb-2">{finalTitle}</Text>
          )}
          {!!finalMessage && (
            <Text className="text-gray-600 text-center mb-6">{finalMessage}</Text>
          )}

          <View className="flex-row justify-between">
            <Pressable
              onPress={onCancel}
              className="flex-1 py-3 bg-gray-100 rounded-xl mr-2"
            >
              <Text className="text-center text-gray-700 font-semibold">{finalCancel}</Text>
            </Pressable>

            <Pressable
              onPress={onConfirm}
              className="flex-1 py-3 bg-blue-500 rounded-xl ml-2"
            >
              <Text className="text-center text-white font-semibold">{finalConfirm}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
