import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView} from 'react-native';
import {useTheme} from '../hooks/useTheme';
import {DEFAULT_PRESETS} from '../constants/presets';
import {useTimers} from '../context/TimerContext';
import {useSettings} from '../context/SettingsContext';

function formatPresetTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0 && m > 0) {return `${h}h ${m}m`;}
  if (h > 0) {return `${h}h`;}
  return `${m}m`;
}

export default function QuickPresets() {
  const {addTimer} = useTimers();
  const {customPresets} = useSettings();
  const C = useTheme();

  const presets = customPresets ?? DEFAULT_PRESETS;

  const handlePreset = preset => {
    const result = addTimer(preset.name, '', preset.seconds);
    if (result.error === 'free_limit') {
      Alert.alert(
        'Timer Limit Reached',
        'Free accounts can run up to 5 timers at once. Upgrade to Premium for unlimited timers.',
      );
    }
  };

  if (presets.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={[styles.label, {color: C.tertiaryText}]}>Quick start</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}>
        {presets.map(preset => (
          <TouchableOpacity
            key={preset.id}
            style={[styles.pill, {backgroundColor: C.tealBg}]}
            onPress={() => handlePreset(preset)}
            activeOpacity={0.7}>
            <Text style={[styles.pillName, {color: C.tealText}]}>{preset.name}</Text>
            <Text style={[styles.pillTime, {color: C.tealText}]}>
              {formatPresetTime(preset.seconds)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {paddingHorizontal: 16, paddingVertical: 12},
  label: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  row: {gap: 8, paddingRight: 4},
  pill: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    minWidth: 64,
  },
  pillName: {fontSize: 13, fontWeight: '500'},
  pillTime: {fontSize: 11, marginTop: 2, opacity: 0.7},
});
