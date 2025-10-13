/**
 * Real Native Ad Item Component
 * 
 * This component uses real AdMob Native Advanced Ads.
 * 
 * ADMOB RESTORE: Uncomment all code before App Store deployment
 * Replace MockAdItem imports with this component in:
 * - ShoppingListAd.tsx
 * - ExpenseListAd.tsx
 */

/* ADMOB RESTORE: Uncomment all imports before App Store deployment

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NativeAd, NativeAdView, HeadlineView, TaglineView, AdvertiserView, CallToActionView, IconView } from 'react-native-google-mobile-ads';
import { ThemedCard } from '../../theme/components/ThemedCard';
import { ThemedText } from '../../theme/components/ThemedText';
import { useThemedStyles } from '../../theme/useThemedStyles';
import { useTranslation } from 'react-i18next';
import { useIsRTL } from '../../hooks/useIsRTL';
import { getAdUnitId } from '../../services/admob-service';

interface RealNativeAdItemProps {
  variant?: 'shopping' | 'expense';
}

export default function RealNativeAdItem({ variant = 'shopping' }: RealNativeAdItemProps) {
  const { t } = useTranslation();
  const isRTL = useIsRTL();
  const themed = useThemedStyles(tk => ({
    borderColor: { borderColor: tk.colors.border.primary },
    textSecondary: { color: tk.colors.text.secondary },
    adBg: { backgroundColor: '#f9fafb' },
  }));

  const adUnitId = getAdUnitId('nativeAdvanced');

  return (
    <NativeAd adUnitId={adUnitId}>
      <NativeAdView style={styles.adContainer}>
        <View 
          style={[
            styles.adCard,
            { borderWidth: 1, borderStyle: 'dashed' },
            themed.borderColor,
            themed.adBg
          ]}
        >
          {/* Sponsored Tag *\/}
          <View 
            style={[
              styles.sponsoredTag,
              isRTL ? { left: 8 } : { right: 8 }
            ]}
          >
            <View style={styles.sponsoredBadge}>
              <Text style={styles.sponsoredText}>
                {t('ads.sponsored')}
              </Text>
            </View>
          </View>

          {/* Ad Content *\/}
          <View 
            style={[
              styles.adContent,
              { 
                flexDirection: isRTL ? 'row-reverse' : 'row',
              }
            ]}
          >
            {/* Ad Icon *\/}
            <IconView style={styles.iconContainer} />

            {/* Ad Text *\/}
            <View style={styles.textContainer}>
              <HeadlineView style={styles.headline} />
              <TaglineView style={styles.tagline} />
              <AdvertiserView style={styles.advertiser} />
            </View>

            {/* CTA Button *\/}
            <CallToActionView style={styles.ctaButton}>
              <Text style={styles.ctaText}>→</Text>
            </CallToActionView>
          </View>
        </View>
      </NativeAdView>
    </NativeAd>
  );
}

const styles = StyleSheet.create({
  adContainer: {
    marginBottom: 12,
  },
  adCard: {
    borderRadius: 12,
    padding: 16,
  },
  sponsoredTag: {
    position: 'absolute',
    top: 8,
    zIndex: 10,
  },
  sponsoredBadge: {
    backgroundColor: '#9ca3af',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  sponsoredText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  adContent: {
    alignItems: 'center',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 8,
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  headline: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  tagline: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 2,
  },
  advertiser: {
    fontSize: 12,
    color: '#9ca3af',
  },
  ctaButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ctaText: {
    fontSize: 20,
    color: '#9ca3af',
  },
});

*/

// Temporary export for Expo Go compatibility
// ADMOB RESTORE: Delete this mock export and uncomment the real component above
import MockAdItem from './MockAdItem';

interface RealNativeAdItemProps {
  variant?: 'shopping' | 'expense';
}

export default function RealNativeAdItem({ variant = 'shopping' }: RealNativeAdItemProps) {
  // In Expo Go, use mock ads
  return <MockAdItem variant={variant} />;
}

