import React from "react";
import { Modal, View, Text, Pressable } from "react-native";
import { Ionicons } from '@expo/vector-icons';
import { ThemedCard } from "../theme/components/ThemedCard";
import { ThemedText } from "../theme/components/ThemedText";
import { useTranslation } from 'react-i18next';

interface ConfirmModalProps {
  visible: boolean;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  loading?: boolean;
}

export default function ConfirmModal({
  visible,
  title,
  message,
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
  loading = false,
}: ConfirmModalProps) {
  const { t } = useTranslation();
  const finalTitle = title ?? t('common.confirm');
  const finalMessage = message ?? '';
  const finalConfirm = confirmText ?? t('common.confirm');
  const finalCancel = cancelText ?? t('common.cancel');
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={loading ? undefined : onCancel}>
      <View className="flex-1 bg-black/40 items-center justify-center px-6">
        <ThemedCard className="rounded-2xl w-full p-6">
          {!!finalTitle && (
            <ThemedText className="text-lg font-bold text-center mb-2">{finalTitle}</ThemedText>
          )}
          {!!finalMessage && (
            <ThemedText className="text-center mb-6">{finalMessage}</ThemedText>
          )}

          <View className="flex-row justify-between">
            <Pressable
              onPress={onCancel}
              className="flex-1 py-3 bg-gray-100 rounded-xl mr-2"
              disabled={loading}
              style={{ opacity: loading ? 0.5 : 1 }}
            >
              <Text className="text-center font-semibold">{finalCancel}</Text>
            </Pressable>

            <Pressable
              onPress={onConfirm}
              className="flex-1 py-3 bg-blue-500 rounded-xl ml-2"
              disabled={loading}
              style={{ opacity: loading ? 0.9 : 1 }}
            >
              <View className="flex-row items-center justify-center">
                {loading && (
                  <Ionicons name="hourglass" size={18} color="white" style={{ marginRight: 8 }} />
                )}
                <Text className="text-center text-white font-semibold">{finalConfirm}</Text>
              </View>
            </Pressable>
          </View>
        </ThemedCard>
      </View>
    </Modal>
  );
}
