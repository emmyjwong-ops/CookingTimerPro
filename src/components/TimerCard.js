import React, {useEffect, useRef} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
  Alert,
} from 'react-native';
import {useTheme} from '../hooks/useTheme';
import {useTimers} from '../context/TimerContext';

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = n => String(n).padStart(2, '0');
  if (h > 0) {
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }
  return `${pad(m)}:${pad(s)}`;
}

function getStatusColor(remainingSeconds, totalSeconds, C) {
  if (remainingSeconds <= 0) {
    return C.red;
  }
  const pct = remainingSeconds / totalSeconds;
  if (pct < 0.25 || remainingSeconds < 60) {
    return C.red;
  }
  if (pct < 0.5) {
    return C.amber;
  }
  return C.coral;
}

export default function TimerCard({timer, navigation}) {
  const {dismissTimer, extendTimer, pauseTimer} = useTimers();
  const C = useTheme();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (timer.isComplete) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.3,
            duration: 600,
            useNativeDriver: false,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: false,
          }),
        ]),
      );
      animation.start();
      return () => {
        animation.stop();
        if (isMounted.current) {
          pulseAnim.setValue(1);
        }
      };
    } else {
      pulseAnim.setValue(1);
    }
  }, [timer.isComplete, pulseAnim]);

  const handleLongPress = () => {
    Alert.alert(timer.name, 'What would you like to do?', [
      {
        text: 'Edit',
        onPress: () => {
          if (navigation) {
            navigation.navigate('AddTimer', {timer});
          }
        },
      },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => dismissTimer(timer.id),
      },
      {text: 'Cancel', style: 'cancel'},
    ]);
  };

  const progress =
    timer.totalSeconds > 0 ? timer.remainingSeconds / timer.totalSeconds : 0;
  const statusColor = getStatusColor(
    timer.remainingSeconds,
    timer.totalSeconds,
    C,
  );
  const isUrgent =
    !timer.isComplete &&
    (timer.remainingSeconds / timer.totalSeconds < 0.25 ||
      timer.remainingSeconds < 60);

  const borderColorAnim = pulseAnim.interpolate({
    inputRange: [0.3, 1],
    outputRange: [C.red, C.red],
  });

  return (
    <Animated.View
      style={[
        styles.card,
        {
          backgroundColor: timer.isComplete ? C.completeBg : C.primaryBg,
          borderColor: timer.isComplete
            ? borderColorAnim
            : isUrgent
            ? C.red
            : C.border,
          borderWidth: timer.isComplete ? 2 : isUrgent ? 1 : 0.5,
        },
      ]}>
      <TouchableOpacity
        activeOpacity={0.8}
        onLongPress={handleLongPress}
        delayLongPress={400}>
        <View style={styles.header}>
          <View style={styles.nameRow}>
            {timer.isComplete && <Text style={styles.bellIcon}>{'🔔'}</Text>}
            <Text style={[styles.name, {color: C.primaryText}]} numberOfLines={1}>
              {timer.name}
            </Text>
          </View>
          {!timer.isComplete && (
            <TouchableOpacity
              onPress={() => pauseTimer(timer.id)}
              hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
              <Text style={[styles.pauseBtn, {color: C.tealText}]}>
                {timer.isRunning ? 'Pause' : 'Resume'}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {timer.note ? (
          <Text style={[styles.note, {color: C.secondaryText}]} numberOfLines={1}>
            {timer.note}
          </Text>
        ) : null}

        <Text
          style={[
            styles.time,
            {color: timer.isComplete ? C.red : C.primaryText},
            timer.isComplete && styles.timeComplete,
          ]}>
          {timer.isComplete ? "Time's up!" : formatTime(timer.remainingSeconds)}
        </Text>

        {!timer.isComplete && (
          <View style={[styles.progressTrack, {backgroundColor: C.secondaryBg}]}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.max(progress * 100, 0)}%`,
                  backgroundColor: statusColor,
                },
              ]}
            />
          </View>
        )}
      </TouchableOpacity>

      {timer.isComplete && (
        <View style={styles.completeActions}>
          <TouchableOpacity
            style={[styles.dismissBtn, {borderColor: C.border}]}
            onPress={() => dismissTimer(timer.id)}>
            <Text style={[styles.dismissText, {color: C.primaryText}]}>Dismiss</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.extendBtn, {backgroundColor: C.tealBg}]}
            onPress={() => extendTimer(timer.id, 300)}>
            <Text style={[styles.extendText, {color: C.tealText}]}>+5 min</Text>
          </TouchableOpacity>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  bellIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  name: {
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
  pauseBtn: {
    fontSize: 13,
    fontWeight: '500',
  },
  note: {
    fontSize: 12,
    marginTop: 4,
  },
  time: {
    fontSize: 28,
    fontWeight: '500',
    marginTop: 8,
    fontVariant: ['tabular-nums'],
  },
  timeComplete: {
    fontSize: 18,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    marginTop: 10,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  completeActions: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 10,
  },
  dismissBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 0.5,
    alignItems: 'center',
  },
  dismissText: {
    fontSize: 14,
    fontWeight: '500',
  },
  extendBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  extendText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
