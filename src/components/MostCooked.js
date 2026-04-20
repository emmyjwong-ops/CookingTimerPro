import React, {useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
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
  const {cookStats, addTimer, removeCookStatEntry, renameCookStatEntry} = useTimers();
  const C = useTheme();
  const [renameTarget, setRenameTarget] = useState(null); // {oldName} | null
  const [renameValue, setRenameValue] = useState('');

  if (!cookStats || cookStats.length === 0) {return null;}

  // Tap = quick-start a timer using the most-used duration for that entry.
  const handleTap = item => {
    const result = addTimer(item.name, '', item.topSeconds ?? 600);
    if (result.error === 'free_limit') {
      Alert.alert(
        'Timer Limit Reached',
        'Free accounts can run up to 5 timers at once. Upgrade to Premium for unlimited timers.',
      );
    }
    // result.error === 'busy' is a rapid double-tap — silently ignore.
  };

  // Long-press = edit the leaderboard entry. Rename fixes typos / casing;
  // Remove clears the entry so it no longer appears in the list.
  const handleLongPress = item => {
    Alert.alert(item.name, 'What would you like to do?', [
      {
        text: 'Rename',
        onPress: () => {
          setRenameValue(item.name);
          setRenameTarget({oldName: item.name});
        },
      },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          Alert.alert(
            'Remove from leaderboard',
            `Remove "${item.name}" from Most cooked? This only clears the stat — it does not affect any running timers.`,
            [
              {text: 'Cancel', style: 'cancel'},
              {
                text: 'Remove',
                style: 'destructive',
                onPress: () => removeCookStatEntry(item.name),
              },
            ],
          );
        },
      },
      {text: 'Cancel', style: 'cancel'},
    ]);
  };

  const closeRename = () => {
    setRenameTarget(null);
    setRenameValue('');
  };

  const submitRename = async () => {
    const trimmed = renameValue.trim();
    if (!trimmed || !renameTarget) {
      closeRename();
      return;
    }
    await renameCookStatEntry(renameTarget.oldName, trimmed);
    closeRename();
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
              onLongPress={() => handleLongPress(item)}
              delayLongPress={400}
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

      {/* Rename modal — shown on long-press → Rename.
          A simple bottom-sheet text input; submitting merges with an existing
          entry of the same (case-insensitive) name if there is one. */}
      <Modal
        visible={renameTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={closeRename}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={closeRename}
          />
          <View style={[styles.modalSheet, {backgroundColor: C.primaryBg, borderColor: C.border}]}>
            <Text style={[styles.modalTitle, {color: C.primaryText}]}>Rename</Text>
            <TextInput
              style={[
                styles.input,
                {
                  color: C.primaryText,
                  borderColor: C.border,
                  backgroundColor: C.secondaryBg,
                },
              ]}
              value={renameValue}
              onChangeText={setRenameValue}
              placeholder="Name"
              placeholderTextColor={C.tertiaryText}
              autoFocus
              maxLength={30}
              returnKeyType="done"
              onSubmitEditing={submitRename}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.cancelBtn, {borderColor: C.border}]}
                onPress={closeRename}>
                <Text style={[styles.cancelBtnText, {color: C.secondaryText}]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, {backgroundColor: C.tealText}]}
                onPress={submitRename}>
                <Text style={styles.saveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  modalOverlay: {flex: 1, justifyContent: 'center'},
  modalBackdrop: {...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)'},
  modalSheet: {
    marginHorizontal: 24,
    padding: 20,
    borderRadius: 14,
    borderWidth: 0.5,
  },
  modalTitle: {fontSize: 16, fontWeight: '600', marginBottom: 12},
  input: {
    borderWidth: 0.5,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 16,
  },
  modalActions: {flexDirection: 'row', gap: 12},
  cancelBtn: {
    flex: 1,
    borderWidth: 0.5,
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: 'center',
  },
  cancelBtnText: {fontSize: 14},
  saveBtn: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: 'center',
  },
  saveBtnText: {fontSize: 14, fontWeight: '600', color: '#fff'},
});
