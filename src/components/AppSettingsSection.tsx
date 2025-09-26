import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../state/store';
import { useTranslation } from 'react-i18next';
import { selection } from '../utils/haptics';
import { ThemeSetting } from '../theme/theme-settings';
import { ThemedText } from '../theme/components/ThemedText';
import { ThemedCard } from '../theme/components/ThemedCard';
import { useThemedStyles } from '../theme/useThemedStyles';
import { changeAppLanguage } from '../utils/changeLanguage';

export default function AppSettingsSection() {
  const { t } = useTranslation();
  const appLanguage = useStore(s => s.appLanguage);
  const setAppLanguage = useStore(s => s.setAppLanguage);
  const themeSetting = useStore(s => s.themeSetting);
  const setThemeSetting = useStore(s => s.setThemeSetting);
  const themed = useThemedStyles(tk => ({
    textSecondary: { color: tk.colors.text.secondary },
    buttonText: { color: tk.colors.text.primary },
  }));

  return (
    <ThemedCard className="rounded-2xl p-6 mb-6 shadow-sm">
      <View className="flex-row items-center justify-between mb-4">
        <ThemedText className="text-lg font-semibold">{t('settings.appSettings')}</ThemedText>
        <Ionicons name="settings-outline" size={20} color="#6b7280" />
      </View>

      {/* Language Section */}
      <View className="mb-6">
        <View className="flex-row items-center justify-between mb-3">
          <ThemedText className="text-base font-medium">{t('settings.language')}</ThemedText>
          <Ionicons name="language" size={18} color="#6b7280" />
        </View>
        <View className="flex-row">
          <Pressable
            onPress={() => {
              selection();
              setAppLanguage('he');
              changeAppLanguage('he');
            }}
            className={`px-3 py-2 rounded-xl mr-2 ${appLanguage === 'he' ? 'bg-blue-500' : 'bg-gray-100'}`}
          >
            <ThemedText className={appLanguage === 'he' ? 'text-white' : ''} style={appLanguage !== 'he' ? themed.buttonText : undefined}>{t('settings.hebrew')}</ThemedText>
          </Pressable>
          <Pressable
            onPress={() => {
              selection();
              setAppLanguage('en');
              changeAppLanguage('en');
            }}
            className={`px-3 py-2 rounded-xl ${appLanguage === 'en' ? 'bg-blue-500' : 'bg-gray-100'}`}
          >
            <ThemedText className={appLanguage === 'en' ? 'text-white' : ''} style={appLanguage !== 'en' ? themed.buttonText : undefined}>{t('settings.english')}</ThemedText>
          </Pressable>
        </View>
      </View>

      {/* Theme Section */}
      <View>
        <View className="flex-row items-center justify-between mb-3">
          <ThemedText className="text-base font-medium">{t('settings.theme')}</ThemedText>
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
              <ThemedText className={themeSetting === theme ? 'text-white' : ''} style={themeSetting !== theme ? themed.buttonText : undefined}>
                {t(`settings.theme.${theme}`)}
              </ThemedText>
            </Pressable>
          ))}
        </View>
        {themeSetting === 'system' && (
          <ThemedText className="text-sm mt-2" style={{ textAlign: appLanguage === 'he' ? 'right' : 'left' }}>
            {t('settings.theme.system.help')}
          </ThemedText>
        )}
      </View>
    </ThemedCard>
  );
}