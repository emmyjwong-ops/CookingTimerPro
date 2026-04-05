import React, {useState} from 'react';
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
} from 'react-native';
import {useTheme} from '../hooks/useTheme';
import {useSettings} from '../context/SettingsContext';
import {DEFAULT_PRESETS} from '../constants/presets';

function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0 && m > 0) {return `${h}h ${m}m`;}
  if (h > 0) {return `${h}h`;}
  return `${m} min`;
}

export default function ManagePresetsScreen() {
  const {customPresets, updatePresets} = useSettings();
  const C = useTheme();

  const presets = customPresets ?? DEFAULT_PRESETS;

  const [modalVisible, setModalVisible] = useState(false);
  const [inputName, setInputName] = useState('');
  const [inputHours, setInputHours] = useState('');
  const [inputMinutes, setInputMinutes] = useState('');

  const openAdd = () => {
    setInputName('');
    setInputHours('');
    setInputMinutes('');
    setModalVisible(true);
  };

  const savePreset = () => {
    const name = inputName.trim();
    if (!name) {
      Alert.alert('Name required', 'Please enter a name for the preset.');
      return;
    }
    const h = parseInt(inputHours || '0', 10) || 0;
    const m = parseInt(inputMinutes || '0', 10) || 0;
    const seconds = h * 3600 + m * 60;
    if (seconds <= 0) {
      Alert.alert('Duration required', 'Please enter a duration greater than zero.');
      return;
    }
    const newPreset = {id: Date.now().toString(), name, seconds};
    updatePresets([...presets, newPreset]);
    setModalVisible(false);
  };

  const deletePreset = id => {
    Alert.alert('Remove preset', 'Remove this preset from the quick-start bar?', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => updatePresets(presets.filter(p => p.id !== id)),
      },
    ]);
  };

  const resetDefaults = () => {
    Alert.alert(
      'Reset to defaults',
      'Replace your presets with the original Pasta, Eggs, Rice and Tea shortcuts?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => updatePresets(null),
        },
      ],
    );
  };

  return (
    <View style={[styles.container, {backgroundColor: C.secondaryBg}]}>
      {/* Explanation */}
      <View style={[styles.infoBox, {backgroundColor: C.primaryBg, borderColor: C.border}]}>
        <Text style={[styles.infoText, {color: C.secondaryText}]}>
          Presets are the quick-start shortcuts at the bottom of the home screen. Add your own favourite recipes here.
        </Text>
      </View>

      <FlatList
        data={presets}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={[styles.empty, {color: C.tertiaryText}]}>
            No presets — tap + to add one.
          </Text>
        }
        renderItem={({item}) => (
          <View style={[styles.row, {backgroundColor: C.primaryBg, borderColor: C.border}]}>
            <View style={styles.rowLeft}>
              <Text style={[styles.rowName, {color: C.primaryText}]}>{item.name}</Text>
              <Text style={[styles.rowTime, {color: C.secondaryText}]}>{formatTime(item.seconds)}</Text>
            </View>
            <TouchableOpacity
              onPress={() => deletePreset(item.id)}
              hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
              <Text style={styles.deleteBtn}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
        ItemSeparatorComponent={() => <View style={{height: 1}} />}
        ListFooterComponent={
          presets.length > 0 ? (
            <TouchableOpacity style={styles.resetBtn} onPress={resetDefaults}>
              <Text style={[styles.resetText, {color: C.tertiaryText}]}>Reset to defaults</Text>
            </TouchableOpacity>
          ) : null
        }
      />

      {/* Add button */}
      <TouchableOpacity
        style={[styles.fab, {backgroundColor: C.tealText}]}
        onPress={openAdd}
        activeOpacity={0.8}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Add preset modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setModalVisible(false)}
          />
          <View style={[styles.modalSheet, {backgroundColor: C.primaryBg, borderColor: C.border}]}>
            <Text style={[styles.modalTitle, {color: C.primaryText}]}>New Preset</Text>

            <Text style={[styles.fieldLabel, {color: C.secondaryText}]}>Name</Text>
            <TextInput
              style={[styles.textInput, {color: C.primaryText, borderColor: C.border, backgroundColor: C.secondaryBg}]}
              placeholder="e.g. Chicken, Broccoli…"
              placeholderTextColor={C.tertiaryText}
              value={inputName}
              onChangeText={setInputName}
              autoFocus
              maxLength={30}
            />

            <Text style={[styles.fieldLabel, {color: C.secondaryText}]}>Duration</Text>
            <View style={styles.timeRow}>
              <View style={styles.timeField}>
                <TextInput
                  style={[styles.timeInput, {color: C.primaryText, borderColor: C.border, backgroundColor: C.secondaryBg}]}
                  placeholder="0"
                  placeholderTextColor={C.tertiaryText}
                  value={inputHours}
                  onChangeText={setInputHours}
                  keyboardType="number-pad"
                  maxLength={2}
                />
                <Text style={[styles.timeUnit, {color: C.secondaryText}]}>hr</Text>
              </View>
              <View style={styles.timeField}>
                <TextInput
                  style={[styles.timeInput, {color: C.primaryText, borderColor: C.border, backgroundColor: C.secondaryBg}]}
                  placeholder="10"
                  placeholderTextColor={C.tertiaryText}
                  value={inputMinutes}
                  onChangeText={setInputMinutes}
                  keyboardType="number-pad"
                  maxLength={2}
                />
                <Text style={[styles.timeUnit, {color: C.secondaryText}]}>min</Text>
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.cancelBtn, {borderColor: C.border}]}
                onPress={() => setModalVisible(false)}>
                <Text style={[styles.cancelBtnText, {color: C.secondaryText}]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, {backgroundColor: C.tealText}]}
                onPress={savePreset}>
                <Text style={styles.saveBtnText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1},
  infoBox: {
    margin: 16,
    marginBottom: 8,
    padding: 14,
    borderRadius: 10,
    borderWidth: 0.5,
  },
  infoText: {fontSize: 13, lineHeight: 18},
  list: {paddingHorizontal: 16, paddingBottom: 100},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 0.5,
  },
  rowLeft: {flex: 1},
  rowName: {fontSize: 15, fontWeight: '500'},
  rowTime: {fontSize: 13, marginTop: 2},
  deleteBtn: {fontSize: 16, color: '#EF4444', paddingHorizontal: 4},
  resetBtn: {marginTop: 24, alignItems: 'center', paddingVertical: 8},
  resetText: {fontSize: 13},
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
  modalOverlay: {flex: 1, justifyContent: 'flex-end'},
  modalBackdrop: {flex: 1, backgroundColor: 'rgba(0,0,0,0.4)'},
  modalSheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 0.5,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {fontSize: 17, fontWeight: '600', marginBottom: 20},
  fieldLabel: {fontSize: 13, marginBottom: 6},
  textInput: {
    borderWidth: 0.5,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 16,
  },
  timeRow: {flexDirection: 'row', gap: 12, marginBottom: 24},
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
