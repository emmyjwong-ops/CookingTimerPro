import React from 'react';
import {View, StyleSheet} from 'react-native';
import {BannerAd, BannerAdSize, TestIds} from 'react-native-google-mobile-ads';
import {useSettings} from '../context/SettingsContext';
import {hasAdsConsent} from '../utils/ads';

const AD_UNIT_ID = __DEV__
  ? TestIds.BANNER
  : 'ca-app-pub-6412968414688678/2049061994';

class AdErrorBoundary extends React.Component {
  state = {hasError: false};
  static getDerivedStateFromError() {
    return {hasError: true};
  }
  render() {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}

function AdBannerInner() {
  const {settings} = useSettings();

  if (settings.isPremium) {
    return null;
  }

  return (
    <View style={styles.container}>
      <BannerAd
        unitId={AD_UNIT_ID}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{requestNonPersonalizedAdsOnly: !hasAdsConsent()}}
        onAdFailedToLoad={() => {}}
      />
    </View>
  );
}

export default function AdBanner() {
  return (
    <AdErrorBoundary>
      <AdBannerInner />
    </AdErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {alignItems: 'center', width: '100%'},
});
