import React from 'react';
import {View, Text, TouchableOpacity, StyleSheet} from 'react-native';
import {useTheme} from '../hooks/useTheme';
import {useTimers} from '../context/TimerContext';

const MEDALS = ['🥇', '🥈', '🥉'];

function formatDuration(seconds) {
  if (!seconds) {return null;}
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {return m > 0 ? `${h}h ${m}m` : `${h}h`;}
  if (m > 0) {return s > 0 ? `${m}m ${s}s` : `${m}m`;}
  return `${s}s`;
}

export default function MostCooked() {
  const {cookStats, addTimer} = useTimers();
  const C = useTheme();

  if (!cookStats || cookStats.length === 0) {return null;}

  const handleTap = item => {
    addTimer(item.name, '', item.topSeconds ?? 600);
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.label, {color: C.tertiaryText}]}>Most cooked</Text>
      <View style={[styles.list, {backgroundColor: C.primaryBg, borderColor: C.border}]}>
        {cookStats.map((item, index) => {
          const durationLabel = formatDuration(item.topSeconds);
          const isLast = index === cookStats.length - 1;
          return (
            <TouchableOpacity
              key={item.name}
              style={[styles.row, {borderBottomColor: C.border}, isLast && styles.rowLast]}
              onPress={() => handleTap(item)}
              activeOpacity={0.7}>
              <Text style={styles.medal}>{MEDALS[index] ?? '🍳'}</Text>
              <Text style={[styles.name, {color: C.primaryText}]} numberOfLines={1}>
                {item.name}
              </Text>
              <View style={styles.right}>
                {durationLabel && (
                  <Text style={[styles.duration, {color: C.tealText}]}>{durationLabel}</Text>
                )}
                <Text style={[styles.count, {color: C.tertiaryText}]}>{item.count}×</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {paddingHorizontal: 16, paddingBottom: 10},
  label: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  list: {borderRadius: 12, borderWidth: 0.5, overflow: 'hidden'},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 0.5,
    gap: 10,
  },
  rowLast: {borderBottomWidth: 0},
  medal: {fontSize: 16},
  name: {flex: 1, fontSize: 14, fontWeight: '500'},
  right: {flexDirection: 'row', alignItems: 'center', gap: 8},
  duration: {fontSize: 13, fontWeight: '500'},
  count: {fontSize: 13},
});
