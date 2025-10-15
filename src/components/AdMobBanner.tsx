import React from 'react';
import { View, StyleSheet } from 'react-native';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import { AdMobConfig } from '../config/admob';

interface AdMobBannerProps {
  size?: BannerAdSize;
  unitId?: string;
  style?: any;
}

export const AdMobBanner: React.FC<AdMobBannerProps> = ({
  size = BannerAdSize.ADAPTIVE_BANNER,
  unitId,
  style,
}) => {
  const adUnitId = unitId || AdMobConfig.getUnitId('banner') || TestIds.BANNER;
  console.log('🎯 Banner Ad Unit ID:', adUnitId, 'isDev:', __DEV__);

  return (
    <View style={[styles.container, style]}>
      <BannerAd
        unitId={adUnitId}
        size={size}
        requestOptions={{
          requestNonPersonalizedAdsOnly: __DEV__, // Use test ads in development
        }}
        onAdLoaded={() => {
          console.log('✅ Banner ad loaded successfully');
        }}
        onAdFailedToLoad={(error) => {
          console.error('❌ Banner ad failed to load:', error);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default AdMobBanner;
