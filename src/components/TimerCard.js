import React, {useEffect, useRef} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
  Alert,
  Vibration,
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
  if (remainingSeconds <= 0 || totalSeconds <= 0) {
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

const TimerCard = React.memo(function TimerCard({timer, navigation}) {
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
      // FIX: use useNativeDriver: true (animate opacity, not borderColor).
      // The previous code animated borderColor with useNativeDriver: false AND
      // both outputRange values were identical (C.red → C.red), so the
      // interpolation was a no-op. Opacity animation with the native driver is
      // both correct and significantly more performant.
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.35,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
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
  // FIX: guard against totalSeconds === 0 to avoid NaN from division.
  const isUrgent =
    !timer.isComplete &&
    timer.totalSeconds > 0 &&
    (timer.remainingSeconds / timer.totalSeconds < 0.25 ||
      timer.remainingSeconds < 60);

  return (
    // Outer card — static style, no opacity animation here so the
    // Dismiss / +5 min buttons are always fully visible and tappable.
    <View
      style={[
        styles.card,
        {
          backgroundColor: timer.isComplete ? C.completeBg : C.primaryBg,
          borderColor: timer.isComplete ? C.red : isUrgent ? C.red : C.border,
          borderWidth: timer.isComplete ? 2 : isUrgent ? 1 : 0.5,
        },
      ]}>
      {/* FIX: pulse only the timer content (name/time/progress), NOT the
          action buttons — at 0.35 opacity the buttons were hard to see and
          interact with. Native driver is still used for performance. */}
      <Animated.View style={{opacity: timer.isComplete ? pulseAnim : 1}}>
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
      </Animated.View>

      {/* v4.5.6 — large, obvious Dismiss button sized for kitchen use.
          The QA report highlighted that users are often cooking with wet,
          greasy or occupied hands when silencing an alarm, so the dismiss
          action is a dominant red button at least 72dp tall filling most
          of the card width. A short haptic pulse on tap confirms the press
          registered even before the alarm sound stops (native-service
          teardown has a small latency). +5 min stays available but as a
          smaller secondary action. */}
      {timer.isComplete && (
        <View style={styles.completeActions}>
          <TouchableOpacity
            style={styles.dismissBtn}
            activeOpacity={0.75}
            accessibilityLabel="Dismiss alarm"
            accessibilityRole="button"
            onPress={() => {
              // Haptic confirms tap registered — critical for wet/greasy
              // fingers in a cooking context where users can't verify
              // visually that a light tap landed on the button.
              try { Vibration.vibrate(40); } catch (_) {}
              dismissTimer(timer.id);
            }}>
            <Text style={styles.dismissText}>Dismiss alarm</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.extendBtn, {borderColor: C.tealText}]}
            activeOpacity={0.75}
            accessibilityLabel="Extend timer by 5 minutes"
            accessibilityRole="button"
            onPress={() => extendTimer(timer.id, 300)}>
            <Text style={[styles.extendText, {color: C.tealText}]}>+5 min</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}, (prev, next) =>
  prev.timer.id === next.timer.id &&
  prev.timer.remainingSeconds === next.timer.remainingSeconds &&
  prev.timer.isComplete === next.timer.isComplete &&
  prev.timer.isRunning === next.timer.isRunning &&
  prev.timer.name === next.timer.name &&
  // BUG 5 FIX: note was missing from the comparator — changes to the note
  // field were silently ignored and the card never re-rendered.
  prev.timer.note === next.timer.note,
);

export default TimerCard;

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
    // Stack vertically so the primary Dismiss button gets full card width.
    marginTop: 14,
    gap: 10,
  },
  dismissBtn: {
    // Big red primary button — sized per QA recommendation (≥72dp tall,
    // fills card width). Hard-coded red #DC2626 so the destructive colour
    // stands out identically in light and dark mode.
    backgroundColor: '#DC2626',
    minHeight: 72,
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    // Elevation lifts it visually above the rest of the card.
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.18,
    shadowRadius: 3,
  },
  dismissText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  extendBtn: {
    // Secondary action — full width but clearly subordinate via outlined
    // style and smaller height.
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  extendText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
