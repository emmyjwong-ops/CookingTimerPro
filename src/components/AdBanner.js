import React from 'react';
import {View, StyleSheet} from 'react-native';
import {BannerAd, BannerAdSize, TestIds} from 'react-native-google-mobile-ads';
import {useSettings} from '../context/SettingsContext';

const AD_UNIT_ID = __DEV__
  ? TestIds.BANNER
  : 'ca-app-pub-6412968414688678/2049061994';

export default function AdBanner() {
  const {settings} = useSettings();

  if (settings.isPremium) {
    return null;
  }

  return (
    <View style={styles.container}>
      <BannerAd
        unitId={AD_UNIT_ID}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{requestNonPersonalizedAdsOnly: false}}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {alignItems: 'center', width: '100%'},
});
