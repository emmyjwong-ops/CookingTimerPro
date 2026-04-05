import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet, Alert} from 'react-native';
import {useTheme} from '../hooks/useTheme';
import {DEFAULT_PRESETS} from '../constants/presets';
import {useTimers} from '../context/TimerContext';

export default function QuickPresets() {
  const {addTimer} = useTimers();
  const C = useTheme();

  const handlePreset = preset => {
    const result = addTimer(preset.name, '', preset.seconds);
    if (result.error === 'free_limit') {
      Alert.alert(
        'Timer Limit Reached',
        'Free accounts can run up to 5 timers at once. Upgrade to Premium for unlimited timers.',
      );
    }
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.label, {color: C.tertiaryText}]}>Quick start</Text>
      <View style={styles.row}>
        {DEFAULT_PRESETS.map(preset => (
          <TouchableOpacity
            key={preset.id}
            style={[styles.pill, {backgroundColor: C.tealBg}]}
            onPress={() => handlePreset(preset)}
            activeOpacity={0.7}>
            <Text style={[styles.pillName, {color: C.tealText}]}>{preset.name}</Text>
            <Text style={[styles.pillTime, {color: C.tealText}]}>
              {Math.floor(preset.seconds / 60)}m
            </Text>
          </TouchableOpacity>
        ))}
      </View>
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
  row: {flexDirection: 'row', gap: 8},
  pill: {flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center'},
  pillName: {fontSize: 13, fontWeight: '500'},
  pillTime: {fontSize: 11, marginTop: 2, opacity: 0.7},
});
