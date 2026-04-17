import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import {useTheme} from '../hooks/useTheme';
import {useSettings} from '../context/SettingsContext';
import {useTimers} from '../context/TimerContext';
import {usePurchase} from '../context/PurchaseContext';
import {saveGroups, loadGroups} from '../utils/storage';

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0 && m > 0) {return `${h}h ${m}m`;}
  if (h > 0) {return `${h}h`;}
  return `${m} min`;
}

// ─── Premium upsell ─────────────────────────────────────────────────────────

function PremiumGate({C, displayPrice, buyPremium}) {
  return (
    <View style={[styles.gate, {backgroundColor: C.secondaryBg}]}>
      <Text style={styles.gateIcon}>⏱</Text>
      <Text style={[styles.gateTitle, {color: C.primaryText}]}>Timer Groups</Text>
      <Text style={[styles.gateDesc, {color: C.secondaryText}]}>
        Save sets of timers and launch them all at once — perfect for multi-dish meals like a Sunday roast.
      </Text>
      <TouchableOpacity
        style={[styles.gateBtn, {backgroundColor: '#3B82F6'}]}
        onPress={buyPremium}
        activeOpacity={0.8}>
        <Text style={styles.gateBtnText}>Upgrade for {displayPrice}</Text>
      </TouchableOpacity>
      <Text style={[styles.gateSub, {color: C.tertiaryText}]}>One-time purchase · All features unlocked</Text>
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function TimerGroupsScreen({navigation}) {
  const {settings} = useSettings();
  const {addTimer} = useTimers();
  const {buyPremium, displayPrice} = usePurchase();
  const C = useTheme();

  const [groups, setGroups] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  // ISSUE 5 FIX: track whether the modal is editing an existing group (string id)
  // or creating a new one (null). `saveGroup` branches on this.
  const [editingId, setEditingId] = useState(null);

  // Form state
  const [groupName, setGroupName] = useState('');
  const [groupTimers, setGroupTimers] = useState([]);
  const [timerName, setTimerName] = useState('');
  const [timerHours, setTimerHours] = useState('');
  const [timerMinutes, setTimerMinutes] = useState('');

  useEffect(() => {
    loadGroups().then(g => setGroups(g));
  }, []);

  const persistGroups = useCallback(updated => {
    setGroups(updated);
    saveGroups(updated);
  }, []);

  // ── Modal helpers ──────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditingId(null);
    setGroupName('');
    setGroupTimers([]);
    setTimerName('');
    setTimerHours('');
    setTimerMinutes('');
    setModalVisible(true);
  };

  // ISSUE 5 FIX: open the modal in "edit" mode pre-filled with the existing
  // group's data. Timers inside the group get a fresh in-progress id if they
  // lack one (legacy groups saved before ids were added).
  const openEdit = group => {
    setEditingId(group.id);
    setGroupName(group.name);
    setGroupTimers(
      group.timers.map(t => ({
        id: t.id ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: t.name,
        note: t.note ?? '',
        seconds: t.seconds,
      })),
    );
    setTimerName('');
    setTimerHours('');
    setTimerMinutes('');
    setModalVisible(true);
  };

  const closeModal = () => {
    setModalVisible(false);
    setEditingId(null);
  };

  const addTimerToGroup = () => {
    const name = timerName.trim();
    if (!name) {return;}
    const h = parseInt(timerHours || '0', 10) || 0;
    const m = parseInt(timerMinutes || '0', 10) || 0;
    const seconds = h * 3600 + m * 60;
    if (seconds <= 0) {return;}
    // FIX: give each in-progress timer a stable id so React keys are not
    // index-based (index keys break when items are removed from the middle).
    setGroupTimers(prev => [...prev, {id: Date.now().toString(), name, note: '', seconds}]);
    setTimerName('');
    setTimerHours('');
    setTimerMinutes('');
  };

  const removeTimerFromGroup = index => {
    setGroupTimers(prev => prev.filter((_, i) => i !== index));
  };

  const saveGroup = () => {
    const name = groupName.trim();
    if (!name) {
      Alert.alert('Name required', 'Give your group a name.');
      return;
    }
    if (groupTimers.length === 0) {
      Alert.alert('Add at least one timer', 'A group needs at least one timer.');
      return;
    }
    if (editingId) {
      // ISSUE 5 FIX: replace the edited group in place (preserve ordering).
      persistGroups(
        groups.map(g =>
          g.id === editingId ? {...g, name, timers: groupTimers} : g,
        ),
      );
    } else {
      const newGroup = {id: Date.now().toString(), name, timers: groupTimers};
      persistGroups([newGroup, ...groups]);
    }
    closeModal();
  };

  // ISSUE 5 FIX: long-press on a group card opens an action sheet with
  // Edit / Remove / Cancel — matching the pattern used for individual timers.
  const handleGroupLongPress = group => {
    Alert.alert(group.name, 'What would you like to do?', [
      {text: 'Edit', onPress: () => openEdit(group)},
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => deleteGroup(group.id),
      },
      {text: 'Cancel', style: 'cancel'},
    ]);
  };

  // ── Group actions ──────────────────────────────────────────────────────────

  const startGroup = group => {
    let anyStarted = false;
    let limitReached = false;
    group.timers.forEach(t => {
      if (!limitReached) {
        const result = addTimer(t.name, t.note, t.seconds);
        if (result.error === 'free_limit') {
          limitReached = true;
        } else if (!result.error) {
          // FIX: only count as started if there was no error at all
          // (previously result.error === 'busy' would silently count as started)
          anyStarted = true;
        }
      }
    });
    if (limitReached && !anyStarted) {
      Alert.alert(
        'Timer Limit Reached',
        'Upgrade to Premium for unlimited timers.',
      );
      return;
    }
    if (limitReached) {
      Alert.alert(
        'Some timers not started',
        'The free limit was reached before all timers could be added.',
      );
    }
    navigation.navigate('Home');
  };

  const deleteGroup = id => {
    Alert.alert('Delete group', 'Remove this timer group?', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => persistGroups(groups.filter(g => g.id !== id)),
      },
    ]);
  };

  // ── Premium gate ───────────────────────────────────────────────────────────

  if (!settings.isPremium) {
    return <PremiumGate C={C} displayPrice={displayPrice} buyPremium={buyPremium} />;
  }

  // ── Groups list ────────────────────────────────────────────────────────────

  return (
    <View style={[styles.container, {backgroundColor: C.secondaryBg}]}>
      <FlatList
        data={groups}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={[styles.emptyTitle, {color: C.primaryText}]}>No groups yet</Text>
            <Text style={[styles.emptyDesc, {color: C.secondaryText}]}>
              Tap + to create your first timer group.
            </Text>
          </View>
        }
        renderItem={({item}) => (
          // ISSUE 5 FIX: long-press opens Edit/Remove/Cancel action sheet.
          // Regular press does nothing (Start has its own button).
          <TouchableOpacity
            activeOpacity={0.9}
            onLongPress={() => handleGroupLongPress(item)}
            delayLongPress={400}
            style={[styles.card, {backgroundColor: C.primaryBg, borderColor: C.border}]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.cardName, {color: C.primaryText}]}>{item.name}</Text>
              <TouchableOpacity
                onPress={() => openEdit(item)}
                hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
                <Text style={[styles.cardEdit, {color: C.tealText}]}>Edit</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.timerList}>
              {item.timers.map((t, i) => (
                // FIX: prefer stable id over index; fall back to index only for
                // legacy groups saved before ids were added to timer objects.
                <Text key={t.id ?? i} style={[styles.timerLine, {color: C.secondaryText}]}>
                  · {t.name} — {formatTime(t.seconds)}
                </Text>
              ))}
            </View>
            <TouchableOpacity
              style={[styles.startBtn, {backgroundColor: C.tealText}]}
              onPress={() => startGroup(item)}
              activeOpacity={0.8}>
              <Text style={styles.startBtnText}>▶  Start all timers</Text>
            </TouchableOpacity>
            <Text style={[styles.longPressHint, {color: C.tertiaryText}]}>
              Long-press for more options
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* Add group FAB */}
      <TouchableOpacity
        style={[styles.fab, {backgroundColor: C.tealText}]}
        onPress={openCreate}
        activeOpacity={0.8}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Create group modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeModal}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={closeModal}
          />
          <View style={[styles.modalSheet, {backgroundColor: C.primaryBg, borderColor: C.border}]}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={[styles.modalTitle, {color: C.primaryText}]}>
                {editingId ? 'Edit Group' : 'New Group'}
              </Text>

              {/* Group name */}
              <Text style={[styles.fieldLabel, {color: C.secondaryText}]}>Group name</Text>
              <TextInput
                style={[styles.textInput, {color: C.primaryText, borderColor: C.border, backgroundColor: C.secondaryBg}]}
                placeholder="e.g. Sunday Roast"
                placeholderTextColor={C.tertiaryText}
                value={groupName}
                onChangeText={setGroupName}
                autoFocus
                maxLength={40}
              />

              {/* Added timers */}
              {groupTimers.length > 0 && (
                <View style={[styles.addedList, {borderColor: C.border}]}>
                  {groupTimers.map((t, i) => (
                    // FIX: use stable t.id instead of array index as key
                    <View key={t.id ?? i} style={styles.addedRow}>
                      <Text style={[styles.addedName, {color: C.primaryText}]}>
                        {t.name} — {formatTime(t.seconds)}
                      </Text>
                      <TouchableOpacity onPress={() => removeTimerFromGroup(i)}>
                        <Text style={styles.addedDelete}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {/* Add a timer to the group */}
              <Text style={[styles.fieldLabel, {color: C.secondaryText, marginTop: 12}]}>Add a timer</Text>
              <TextInput
                style={[styles.textInput, {color: C.primaryText, borderColor: C.border, backgroundColor: C.secondaryBg}]}
                placeholder="Timer name (e.g. Chicken)"
                placeholderTextColor={C.tertiaryText}
                value={timerName}
                onChangeText={setTimerName}
                maxLength={30}
              />
              <View style={styles.timeRow}>
                <View style={styles.timeField}>
                  <TextInput
                    style={[styles.timeInput, {color: C.primaryText, borderColor: C.border, backgroundColor: C.secondaryBg}]}
                    placeholder="0"
                    placeholderTextColor={C.tertiaryText}
                    value={timerHours}
                    onChangeText={setTimerHours}
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                  <Text style={[styles.timeUnit, {color: C.secondaryText}]}>hr</Text>
                </View>
                <View style={styles.timeField}>
                  <TextInput
                    style={[styles.timeInput, {color: C.primaryText, borderColor: C.border, backgroundColor: C.secondaryBg}]}
                    placeholder="30"
                    placeholderTextColor={C.tertiaryText}
                    value={timerMinutes}
                    onChangeText={setTimerMinutes}
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                  <Text style={[styles.timeUnit, {color: C.secondaryText}]}>min</Text>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.addTimerBtn, {borderColor: C.tealText}]}
                onPress={addTimerToGroup}>
                <Text style={[styles.addTimerBtnText, {color: C.tealText}]}>+ Add timer to group</Text>
              </TouchableOpacity>

              {/* Actions */}
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.cancelBtn, {borderColor: C.border}]}
                  onPress={closeModal}>
                  <Text style={[styles.cancelBtnText, {color: C.secondaryText}]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, {backgroundColor: C.tealText}]}
                  onPress={saveGroup}>
                  <Text style={styles.saveBtnText}>
                    {editingId ? 'Save changes' : 'Save group'}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  // Premium gate
  gate: {flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32},
  gateIcon: {fontSize: 48, marginBottom: 16},
  gateTitle: {fontSize: 22, fontWeight: '600', marginBottom: 12},
  gateDesc: {fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 28},
  gateBtn: {
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 28,
    marginBottom: 12,
  },
  gateBtnText: {fontSize: 15, fontWeight: '600', color: '#fff'},
  gateSub: {fontSize: 12},

  // Main
  container: {flex: 1},
  list: {padding: 16, paddingBottom: 100},
  emptyWrap: {alignItems: 'center', paddingTop: 60},
  emptyTitle: {fontSize: 16, fontWeight: '500'},
  emptyDesc: {fontSize: 13, marginTop: 6, textAlign: 'center'},

  // Group card
  card: {
    borderRadius: 12,
    borderWidth: 0.5,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  cardName: {fontSize: 16, fontWeight: '600'},
  cardDelete: {fontSize: 15, color: '#EF4444'},
  cardEdit: {fontSize: 14, fontWeight: '500'},
  longPressHint: {fontSize: 11, textAlign: 'center', marginTop: 8, fontStyle: 'italic'},
  timerList: {marginBottom: 14, gap: 4},
  timerLine: {fontSize: 13},
  startBtn: {
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: 'center',
  },
  startBtnText: {fontSize: 14, fontWeight: '600', color: '#fff'},

  // FAB
  fab: {
    position: 'absolute',
    bottom: 32,
    right: 24,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  fabText: {fontSize: 28, color: '#fff', lineHeight: 32},

  // Modal
  modalOverlay: {flex: 1, justifyContent: 'flex-end'},
  modalBackdrop: {flex: 1, backgroundColor: 'rgba(0,0,0,0.4)'},
  modalSheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 0.5,
    padding: 24,
    paddingBottom: 40,
    maxHeight: '90%',
  },
  modalTitle: {fontSize: 17, fontWeight: '600', marginBottom: 20},
  fieldLabel: {fontSize: 13, marginBottom: 6},
  textInput: {
    borderWidth: 0.5,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 12,
  },
  addedList: {
    borderWidth: 0.5,
    borderRadius: 8,
    marginBottom: 4,
    overflow: 'hidden',
  },
  addedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  addedName: {fontSize: 14, flex: 1},
  addedDelete: {fontSize: 14, color: '#EF4444', paddingLeft: 8},
  timeRow: {flexDirection: 'row', gap: 12, marginBottom: 12},
  timeField: {flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8},
  timeInput: {
    flex: 1,
    borderWidth: 0.5,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 18,
    textAlign: 'center',
  },
  timeUnit: {fontSize: 14},
  addTimerBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 20,
  },
  addTimerBtnText: {fontSize: 14, fontWeight: '500'},
  modalActions: {flexDirection: 'row', gap: 12},
  cancelBtn: {
    flex: 1,
    borderWidth: 0.5,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelBtnText: {fontSize: 15},
  saveBtn: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveBtnText: {fontSize: 15, fontWeight: '600', color: '#fff'},
});
