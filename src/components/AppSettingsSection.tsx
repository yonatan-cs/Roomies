import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../state/store';
import { useTranslation } from 'react-i18next';
import { selection } from '../utils/haptics';
import { ThemeSetting } from '../theme/theme-settings';

export default function AppSettingsSection() {
  const { t } = useTranslation();
  const appLanguage = useStore(s => s.appLanguage);
  const setAppLanguage = useStore(s => s.setAppLanguage);
  const themeSetting = useStore(s => s.themeSetting);
  const setThemeSetting = useStore(s => s.setThemeSetting);

  return (
    <View className="bg-white rounded-2xl p-6 mb-6 shadow-sm">
      <View className="flex-row items-center justify-between mb-4">
        <Text className="text-lg font-semibold text-gray-900">{t('settings.appSettings')}</Text>
        <Ionicons name="settings-outline" size={20} color="#6b7280" />
      </View>

      {/* Language Section */}
      <View className="mb-6">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-base font-medium text-gray-900">{t('settings.language')}</Text>
          <Ionicons name="language" size={18} color="#6b7280" />
        </View>
        <View className="flex-row">
          <Pressable
            onPress={() => {
              selection();
              setAppLanguage('he');
            }}
            className={`px-3 py-2 rounded-xl mr-2 ${appLanguage === 'he' ? 'bg-blue-500' : 'bg-gray-100'}`}
          >
            <Text className={appLanguage === 'he' ? 'text-white' : 'text-gray-700'}>{t('settings.hebrew')}</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              selection();
              setAppLanguage('en');
            }}
            className={`px-3 py-2 rounded-xl ${appLanguage === 'en' ? 'bg-blue-500' : 'bg-gray-100'}`}
          >
            <Text className={appLanguage === 'en' ? 'text-white' : 'text-gray-700'}>{t('settings.english')}</Text>
          </Pressable>
        </View>
      </View>

      {/* Theme Section */}
      <View>
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-base font-medium text-gray-900">{t('settings.theme')}</Text>
          <Ionicons name="color-palette-outline" size={18} color="#6b7280" />
        </View>
        <View className="flex-row flex-wrap">
          {(['light', 'dark', 'system'] as ThemeSetting[]).map((theme) => (
            <Pressable
              key={theme}
              onPress={() => {
                selection();
                setThemeSetting(theme);
              }}
              className={`px-3 py-2 rounded-xl mr-2 mb-2 ${themeSetting === theme ? 'bg-blue-500' : 'bg-gray-100'}`}
            >
              <Text className={themeSetting === theme ? 'text-white' : 'text-gray-700'}>
                {t(`settings.theme.${theme}`)}
              </Text>
            </Pressable>
          ))}
        </View>
        {themeSetting === 'system' && (
          <Text className="text-sm text-gray-600 mt-2" style={{ textAlign: appLanguage === 'he' ? 'right' : 'left' }}>
            {t('settings.theme.system.help')}
          </Text>
        )}
      </View>
    </View>
  );
}