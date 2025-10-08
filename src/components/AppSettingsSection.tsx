import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../state/store';
import { useTranslation } from 'react-i18next';
import { useIsRTL } from '../hooks/useIsRTL';
import { selection, impactMedium } from '../utils/haptics';
import { ThemeSetting } from '../theme/theme-settings';
import { ThemedText } from '../theme/components/ThemedText';
import { ThemedCard } from '../theme/components/ThemedCard';
import { useThemedStyles } from '../theme/useThemedStyles';
import { changeAppLanguage } from '../utils/changeLanguage';
import { cn } from '../utils/cn';

export default function AppSettingsSection() {
  const { t } = useTranslation();
  const isRTL = useIsRTL();
  const appLanguage = useStore(s => s.appLanguage);
  const setAppLanguage = useStore(s => s.setAppLanguage);
  const themeSetting = useStore(s => s.themeSetting);
  const setThemeSetting = useStore(s => s.setThemeSetting);
  const hapticsEnabled = useStore(s => s.hapticsEnabled);
  const setHapticsEnabled = useStore(s => s.setHapticsEnabled);
  const currency = useStore(s => s.currency);
  const setCurrency = useStore(s => s.setCurrency);
  const themed = useThemedStyles(tk => ({
    textSecondary: { color: tk.colors.text.secondary },
    buttonText: { color: '#111827' }, // Always dark for unselected buttons
    buttonTextSelected: { color: '#ffffff' },
  }));

  return (
    <ThemedCard className="rounded-2xl p-6 mb-6 shadow-sm">
      <View 
        className="items-center mb-4"
        style={{ 
          flexDirection: isRTL ? 'row-reverse' : 'row',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <ThemedText className="text-lg font-semibold flex-1">{t('settings.appSettings')}</ThemedText>
        <Ionicons name="settings-outline" size={20} color="#6b7280" />
      </View>

      {/* Language Section */}
      <View className="mb-6">
        <View 
          className="items-center mb-3"
          style={{ 
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <ThemedText className="text-base font-medium flex-1">{t('settings.language')}</ThemedText>
          <Ionicons name="language" size={18} color="#6b7280" />
        </View>
        <View 
          className="flex-wrap"
          style={{ 
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'flex-start'
          }}
        >
          <Pressable
            onPress={() => {
              selection();
              setAppLanguage('he');
              changeAppLanguage('he');
            }}
            className={cn(
              "px-3 py-2 rounded-xl",
              appLanguage === 'he' ? 'bg-blue-500' : 'bg-gray-100',
              isRTL ? "ml-2" : "mr-2"
            )}
          >
            <ThemedText className={appLanguage === 'he' ? 'text-white' : ''} style={appLanguage !== 'he' ? themed.buttonText : { color: '#ffffff' }}>{t('settings.hebrew')}</ThemedText>
          </Pressable>
          <Pressable
            onPress={() => {
              selection();
              setAppLanguage('en');
              changeAppLanguage('en');
            }}
            className={`px-3 py-2 rounded-xl ${appLanguage === 'en' ? 'bg-blue-500' : 'bg-gray-100'}`}
          >
            <ThemedText className={appLanguage === 'en' ? 'text-white' : ''} style={appLanguage !== 'en' ? themed.buttonText : { color: '#ffffff' }}>{t('settings.english')}</ThemedText>
          </Pressable>
        </View>
      </View>

      {/* Haptics Section */}
      <View className="mb-6">
        <View 
          className="items-center mb-3"
          style={{ 
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <ThemedText className="text-base font-medium flex-1">{t('settings.haptics')}</ThemedText>
          <Ionicons name="phone-portrait" size={18} color="#6b7280" />
        </View>
        
        <View style={{ alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
          <Pressable
            onPress={() => {
              // Give haptic feedback before toggling (so user feels it if enabling)
              if (!hapticsEnabled) {
                impactMedium();
              }
              setHapticsEnabled(!hapticsEnabled);
            }}
            className={`w-12 h-7 rounded-full p-1 ${hapticsEnabled ? 'bg-blue-500' : 'bg-gray-300'}`}
          >
            <View className={`w-5 h-5 rounded-full transition-transform ${hapticsEnabled ? 'translate-x-5' : 'translate-x-0'}`} style={{ backgroundColor: '#ffffff' }} />
          </Pressable>
        </View>
      </View>

      {/* Currency Section */}
      <View className="mb-6">
        <View 
          className="items-center mb-3"
          style={{ 
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <ThemedText className="text-base font-medium flex-1">{t('settings.currency')}</ThemedText>
          <Ionicons name="card-outline" size={18} color="#6b7280" />
        </View>
        <View 
          className="flex-wrap"
          style={{ 
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'flex-start'
          }}
        >
          <Pressable
            onPress={() => {
              selection();
              setCurrency('ILS');
            }}
            className={cn(
              "px-3 py-2 rounded-xl",
              currency === 'ILS' ? 'bg-blue-500' : 'bg-gray-100',
              isRTL ? "ml-2" : "mr-2"
            )}
          >
            <ThemedText className={currency === 'ILS' ? 'text-white' : ''} style={currency !== 'ILS' ? themed.buttonText : { color: '#ffffff' }}>{t('settings.currencyILS')}</ThemedText>
          </Pressable>
          <Pressable
            onPress={() => {
              selection();
              setCurrency('USD');
            }}
            className={`px-3 py-2 rounded-xl ${currency === 'USD' ? 'bg-blue-500' : 'bg-gray-100'}`}
          >
            <ThemedText className={currency === 'USD' ? 'text-white' : ''} style={currency !== 'USD' ? themed.buttonText : { color: '#ffffff' }}>{t('settings.currencyUSD')}</ThemedText>
          </Pressable>
        </View>
      </View>

      {/* Theme Section */}
      <View>
        <View 
          className="items-center mb-3"
          style={{ 
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <ThemedText className="text-base font-medium flex-1">{t('settings.theme')}</ThemedText>
          <Ionicons name="color-palette-outline" size={18} color="#6b7280" />
        </View>
        <View 
          className="flex-wrap"
          style={{ 
            flexDirection: isRTL ? 'row-reverse' : 'row',
            alignItems: 'flex-start'
          }}
        >
          {(['light', 'dark', 'system'] as ThemeSetting[]).map((theme) => (
            <Pressable
              key={theme}
              onPress={() => {
                selection();
                setThemeSetting(theme);
              }}
              className={cn(
                "px-3 py-2 rounded-xl mb-2",
                themeSetting === theme ? 'bg-blue-500' : 'bg-gray-100',
                isRTL ? "ml-2" : "mr-2"
              )}
            >
              <ThemedText className={themeSetting === theme ? 'text-white' : ''} style={themeSetting !== theme ? themed.buttonText : { color: '#ffffff' }}>
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