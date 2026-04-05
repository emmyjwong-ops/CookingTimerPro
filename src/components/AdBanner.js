import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {useTheme} from '../hooks/useTheme';
import {useSettings} from '../context/SettingsContext';

export default function AdBanner() {
  const {settings} = useSettings();
  const C = useTheme();

  if (settings.isPremium) {
    return null;
  }

  return (
    <View style={[styles.banner, {backgroundColor: C.adBannerBg}]}>
      <Text style={[styles.text, {color: C.tertiaryText}]}>Ad</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {height: 28, alignItems: 'center', justifyContent: 'center'},
  text: {fontSize: 11},
});
