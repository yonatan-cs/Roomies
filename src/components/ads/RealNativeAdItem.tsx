/**
 * Real Native Ad Item Component
 * 
 * This component uses real AdMob Native Advanced Ads.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NativeAd, NativeAdView, NativeAsset, NativeAssetType, NativeMediaView } from 'react-native-google-mobile-ads';
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
  const [nativeAd, setNativeAd] = useState<NativeAd | null>(null);
  const themed = useThemedStyles(tk => ({
    borderColor: { borderColor: tk.colors.border.primary },
    textSecondary: { color: tk.colors.text.secondary },
    adBg: { backgroundColor: '#f9fafb' },
  }));

  const adUnitId = getAdUnitId('nativeAdvanced');

  useEffect(() => {
    let ad: NativeAd | null = null;
    
    const loadAd = async () => {
      // createForAdRequest already loads the ad and returns a populated NativeAd
      ad = await NativeAd.createForAdRequest(adUnitId);
      setNativeAd(ad);
    };
    
    loadAd();

    return () => {
      // Cleanup ad on unmount
      if (ad) {
        ad.destroy();
      }
    };
  }, [adUnitId]);

  if (!nativeAd) {
    return null;
  }

  return (
    <NativeAdView nativeAd={nativeAd} style={styles.adContainer}>
      <View 
        style={[
          styles.adCard,
          { borderWidth: 1, borderStyle: 'dashed' },
          themed.borderColor,
          themed.adBg
        ]}
      >
        {/* Sponsored Tag */}
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

        {/* Ad Content */}
        <View 
          style={[
            styles.adContent,
            { 
              flexDirection: isRTL ? 'row-reverse' : 'row',
            }
          ]}
        >
          {/* Ad Icon */}
          <NativeAsset assetType={NativeAssetType.ICON}>
            <View style={styles.iconContainer} />
          </NativeAsset>

          {/* Ad Text */}
          <View style={styles.textContainer}>
            <NativeAsset assetType={NativeAssetType.HEADLINE}>
              <Text style={styles.headline} />
            </NativeAsset>
            <NativeAsset assetType={NativeAssetType.BODY}>
              <Text style={styles.tagline} />
            </NativeAsset>
            <NativeAsset assetType={NativeAssetType.ADVERTISER}>
              <Text style={styles.advertiser} />
            </NativeAsset>
          </View>

          {/* CTA Button */}
          <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
            <View style={styles.ctaButton}>
              <Text style={styles.ctaText}>→</Text>
            </View>
          </NativeAsset>
        </View>
      </View>
    </NativeAdView>
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
