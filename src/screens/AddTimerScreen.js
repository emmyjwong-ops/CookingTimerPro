import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {useTheme} from '../hooks/useTheme';
import {QUICK_SET_PILLS} from '../constants/presets';
import {useTimers} from '../context/TimerContext';

// Standalone component so it can use hooks
function TimeBox({label, value, setter, max, C}) {
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState(String(value).padStart(2, '0'));

  // Keep display in sync when arrows change value
  useEffect(() => {
    if (!focused) {
      setText(String(value).padStart(2, '0'));
    }
  }, [value, focused]);

  const handleFocus = () => {
    setFocused(true);
    setText(String(value)); // show plain number for easy editing
  };

  const handleChangeText = raw => {
    const digits = raw.replace(/\D/g, '').slice(0, 2);
    setText(digits);
    const num = digits === '' ? 0 : Math.min(parseInt(digits, 10), max);
    setter(num);
  };

  const handleBlur = () => {
    setFocused(false);
    const num = Math.max(0, Math.min(parseInt(text, 10) || 0, max));
    setter(num);
    setText(String(num).padStart(2, '0'));
  };

  const increment = () => setter(value < max ? value + 1 : 0);
  const decrement = () => setter(value > 0 ? value - 1 : max);

  return (
    <View style={styles.timeBox}>
      <TouchableOpacity style={styles.timeArrow} onPress={increment}>
        <Text style={[styles.arrowText, {color: C.secondaryText}]}>{'▲'}</Text>
      </TouchableOpacity>
      <TextInput
        style={[styles.timeValue, {color: C.primaryText}]}
        value={text}
        onChangeText={handleChangeText}
        onFocus={handleFocus}
        onBlur={handleBlur}
        keyboardType="number-pad"
        maxLength={2}
        selectTextOnFocus
        textAlign="center"
      />
      <Text style={[styles.timeLabel, {color: C.tertiaryText}]}>{label}</Text>
      <TouchableOpacity style={styles.timeArrow} onPress={decrement}>
        <Text style={[styles.arrowText, {color: C.secondaryText}]}>{'▼'}</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function AddTimerScreen({navigation, route}) {
  const {addTimer, editTimer} = useTimers();
  const C = useTheme();

  const editingTimer = route?.params?.timer ?? null;
  const isEditing = editingTimer !== null;

  const initFromSeconds = s => ({
    h: Math.floor(s / 3600),
    m: Math.floor((s % 3600) / 60),
    s: s % 60,
  });
  const init = isEditing ? initFromSeconds(editingTimer.totalSeconds) : {h: 0, m: 0, s: 0};

  const [name, setName] = useState(isEditing ? editingTimer.name : '');
  const [note, setNote] = useState(isEditing ? editingTimer.note : '');
  const [hours, setHours] = useState(init.h);
  const [minutes, setMinutes] = useState(init.m);
  const [seconds, setSeconds] = useState(init.s);

  const totalSeconds = hours * 3600 + minutes * 60 + seconds;

  const applyQuickSet = pill => {
    setHours(Math.floor(pill.seconds / 3600));
    setMinutes(Math.floor((pill.seconds % 3600) / 60));
    setSeconds(pill.seconds % 60);
  };

  const handleStart = () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Please give your timer a name.');
      return;
    }
    if (totalSeconds <= 0) {
      Alert.alert('Set a time', 'Please set a time greater than zero.');
      return;
    }
    if (isEditing) {
      editTimer(editingTimer.id, name.trim(), note.trim(), totalSeconds);
    } else {
      const result = addTimer(name.trim(), note.trim(), totalSeconds);
      if (result.error === 'free_limit') {
        Alert.alert(
          'Timer Limit Reached',
          'Free accounts can run up to 5 timers at once. Upgrade to Premium for unlimited timers.',
        );
        return;
      }
      if (result.error === 'busy') {
        // Double-tap protection — silently ignore, do not navigate back.
        return;
      }
    }
    navigation.goBack();
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, {backgroundColor: C.primaryBg}]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled">
        <Text style={[styles.sectionLabel, {color: C.tertiaryText}]}>Timer name</Text>
        <TextInput
          style={[styles.input, {borderColor: C.border, color: C.primaryText, backgroundColor: C.primaryBg}]}
          placeholder="e.g. Roasted vegetables"
          placeholderTextColor={C.tertiaryText}
          value={name}
          onChangeText={setName}
          maxLength={40}
        />

        <Text style={[styles.sectionLabel, {color: C.tertiaryText}]}>Note (optional)</Text>
        <TextInput
          style={[styles.input, {borderColor: C.border, color: C.primaryText, backgroundColor: C.primaryBg}]}
          placeholder="e.g. 180C, flip halfway..."
          placeholderTextColor={C.tertiaryText}
          value={note}
          onChangeText={setNote}
          maxLength={80}
        />

        <Text style={[styles.sectionLabel, {color: C.tertiaryText}]}>Set time</Text>
        <View style={styles.timeRow}>
          <TimeBox label="hrs" value={hours} setter={setHours} max={23} C={C} />
          <Text style={[styles.timeSeparator, {color: C.tertiaryText}]}>:</Text>
          <TimeBox label="min" value={minutes} setter={setMinutes} max={59} C={C} />
          <Text style={[styles.timeSeparator, {color: C.tertiaryText}]}>:</Text>
          <TimeBox label="sec" value={seconds} setter={setSeconds} max={59} C={C} />
        </View>

        <Text style={[styles.sectionLabel, {color: C.tertiaryText}]}>Quick set</Text>
        <View style={styles.pillRow}>
          {QUICK_SET_PILLS.map(pill => (
            <TouchableOpacity
              key={pill.label}
              style={[styles.pill, {backgroundColor: C.secondaryBg, borderColor: C.border}]}
              onPress={() => applyQuickSet(pill)}
              activeOpacity={0.7}>
              <Text style={[styles.pillText, {color: C.primaryText}]}>{pill.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[
            styles.startBtn,
            {backgroundColor: C.tealText},
            totalSeconds <= 0 && styles.startBtnDisabled,
          ]}
          onPress={handleStart}
          activeOpacity={0.8}>
          <Text style={styles.startBtnText}>
            {isEditing ? 'Save changes' : 'Start timer'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1},
  scroll: {padding: 20, paddingBottom: 40},
  sectionLabel: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 20,
  },
  input: {
    borderWidth: 0.5,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  timeBox: {
    alignItems: 'center',
    width: 80,
  },
  timeArrow: {padding: 8},
  arrowText: {fontSize: 14},
  timeValue: {
    fontSize: 36,
    fontWeight: '500',
    fontVariant: ['tabular-nums'],
    width: 80,
    paddingVertical: 0,
  },
  timeLabel: {fontSize: 11, marginTop: 2},
  timeSeparator: {
    fontSize: 28,
    fontWeight: '400',
    marginHorizontal: 4,
    marginBottom: 20,
  },
  pillRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 0.5,
  },
  pillText: {fontSize: 13, fontWeight: '500'},
  startBtn: {
    marginTop: 32,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  startBtnDisabled: {opacity: 0.4},
  startBtnText: {fontSize: 16, fontWeight: '500', color: '#FFFFFF'},
});
