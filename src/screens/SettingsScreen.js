import React, {useState, useRef, useEffect} from 'react';
import {
  View,
  Text,
  Switch,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Modal,
  NativeModules,
  Linking,
} from 'react-native';
import {useTheme} from '../hooks/useTheme';
import {useSettings} from '../context/SettingsContext';
import {usePurchase} from '../context/PurchaseContext';
import {ALARM_SOUNDS, getSoundFile} from '../constants/sounds';

function SettingRow({label, right, onPress, C}) {
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper
      style={[styles.row, {borderBottomColor: C.border}]}
      onPress={onPress}
      activeOpacity={0.6}>
      <Text style={[styles.rowLabel, {color: C.primaryText}]}>{label}</Text>
      {right || <Text style={[styles.rowChevron, {color: C.tertiaryText}]}>{'›'}</Text>}
    </Wrapper>
  );
}

export default function SettingsScreen({navigation}) {
  const {settings, updateSetting} = useSettings();
  const {buyPremium, restorePurchases, purchasing, displayPrice} = usePurchase();
  const C = useTheme();
  const [soundPickerVisible, setSoundPickerVisible] = useState(false);
  const soundPreviewTimeout = useRef(null);

  // Hidden dev toggle: tap version text 7 times to unlock/lock premium.
  const devTapCount = useRef(0);
  const devTapTimer = useRef(null);
  const handleVersionTap = () => {
    devTapCount.current += 1;
    if (devTapTimer.current) clearTimeout(devTapTimer.current);
    devTapTimer.current = setTimeout(() => { devTapCount.current = 0; }, 1500);
    if (devTapCount.current >= 7) {
      devTapCount.current = 0;
      const next = !settings.isPremium;
      updateSetting('isPremium', next);
      Alert.alert(
        next ? '🔓 Premium ON' : '🔒 Premium OFF',
        'Developer toggle — not visible to real users.',
      );
    }
  };

  // FIX: clean up any in-flight sound preview when the component unmounts
  // so a pending setTimeout can't stop a sound that started for a different reason.
  useEffect(() => {
    return () => {
      if (soundPreviewTimeout.current) {
        clearTimeout(soundPreviewTimeout.current);
        NativeModules.SoundModule?.stopBell();
      }
    };
  }, []);

  const darkModeLabel = {light: 'Light', dark: 'Dark'};

  const currentSound = ALARM_SOUNDS.find(s => s.id === settings.alertSound) ?? ALARM_SOUNDS[0];

  const handleSoundSelect = sound => {
    if (sound.premium && !settings.isPremium) {
      Alert.alert(
        'Premium Feature',
        'Unlock all alarm sounds by upgrading to Premium.',
        [
          {text: 'Not now', style: 'cancel'},
          {text: `Upgrade for ${displayPrice}`, onPress: buyPremium},
        ],
      );
      return;
    }
    updateSetting('alertSound', sound.id);
    // FIX: cancel any existing preview before starting a new one, and store
    // the timeout ref so it can be cleared on unmount.
    if (soundPreviewTimeout.current) {
      clearTimeout(soundPreviewTimeout.current);
      NativeModules.SoundModule?.stopBell();
    }
    NativeModules.SoundModule?.playBell(getSoundFile(sound.id));
    soundPreviewTimeout.current = setTimeout(() => {
      NativeModules.SoundModule?.stopBell();
      soundPreviewTimeout.current = null;
    }, 2500);
    setSoundPickerVisible(false);
  };

  const cycleDarkMode = () => {
    updateSetting('darkMode', settings.darkMode === 'dark' ? 'light' : 'dark');
  };

  return (
    <View style={[styles.container, {backgroundColor: C.secondaryBg}]}>
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}>

      {/* Premium upsell */}
      {!settings.isPremium ? (
        <View style={[styles.premiumCard, {backgroundColor: C.premiumBg, borderColor: C.premiumBorder}]}>
          <Text style={[styles.premiumTitle, {color: C.primaryText}]}>
            CookingTimerPro Premium
          </Text>
          <Text style={[styles.premiumPrice, {color: C.secondaryText}]}>
            {displayPrice} — one-time purchase
          </Text>
          <View style={styles.premiumFeatures}>
            <Text style={[styles.premiumFeature, {color: C.primaryText}]}>{'✓'} Unlimited simultaneous timers</Text>
            <Text style={[styles.premiumFeature, {color: C.primaryText}]}>{'✓'} No ads</Text>
            <Text style={[styles.premiumFeature, {color: C.primaryText}]}>{'✓'} Timer groups</Text>
            <Text style={[styles.premiumFeature, {color: C.primaryText}]}>{'✓'} Custom presets & sounds</Text>
          </View>
          <TouchableOpacity
            style={[styles.premiumBtn, purchasing && styles.premiumBtnDisabled]}
            onPress={buyPremium}
            disabled={purchasing}
            activeOpacity={0.8}>
            {purchasing ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.premiumBtnText}>Upgrade for {displayPrice}</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.restoreBtn} onPress={restorePurchases}>
            <Text style={[styles.restoreText, {color: C.premiumBorder}]}>Restore purchase</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={[styles.premiumActiveBadge, {backgroundColor: C.tealBg, borderColor: C.tealText}]}>
          <Text style={[styles.premiumActiveText, {color: C.tealText}]}>
            ✓ Premium — all features unlocked
          </Text>
        </View>
      )}

      {/* Settings list */}
      <View style={[styles.section, {backgroundColor: C.primaryBg, borderColor: C.border}]}>
        <SettingRow
          label="Alert sound"
          C={C}
          right={<Text style={[styles.rowValue, {color: C.secondaryText}]}>{currentSound.label}</Text>}
          onPress={() => setSoundPickerVisible(true)}
        />
        <SettingRow
          label="Vibration"
          C={C}
          right={
            <Switch
              value={settings.vibration}
              onValueChange={v => updateSetting('vibration', v)}
              trackColor={{true: C.tealText}}
            />
          }
        />
        <SettingRow
          label="Keep screen on"
          C={C}
          right={
            <Switch
              value={settings.keepScreenOn}
              onValueChange={v => updateSetting('keepScreenOn', v)}
              trackColor={{true: C.tealText}}
            />
          }
        />
        <SettingRow
          label="Mode"
          C={C}
          right={
            <Text style={[styles.rowValue, {color: C.secondaryText}]}>
              {darkModeLabel[settings.darkMode] ?? 'Light'}
            </Text>
          }
          onPress={cycleDarkMode}
        />
        <SettingRow
          label="Manage presets"
          C={C}
          onPress={() => navigation.navigate('ManagePresets')}
        />
        <SettingRow
          label="Timer groups"
          C={C}
          right={
            !settings.isPremium ? (
              <Text style={[styles.rowBadge, {color: '#F59E0B', borderColor: '#F59E0B'}]}>Premium</Text>
            ) : undefined
          }
          onPress={() => navigation.navigate('TimerGroups')}
        />
        <SettingRow
          label="Rate the app"
          C={C}
          onPress={() =>
            Linking.openURL('market://details?id=com.cookingtimerpro').catch(() =>
              Linking.openURL(
                'https://play.google.com/store/apps/details?id=com.cookingtimerpro',
              ),
            )
          }
        />
      </View>

      <TouchableOpacity onPress={handleVersionTap} activeOpacity={1}>
        <Text style={[styles.version, {color: C.tertiaryText}]}>
          CookingTimerPro v1.0.0
        </Text>
      </TouchableOpacity>

    </ScrollView>

    {/* Sound picker modal — outside ScrollView so it does not affect
        the scroll content height or cut off the version text. */}
    <Modal
      visible={soundPickerVisible}
      transparent
      animationType="slide"
      onRequestClose={() => setSoundPickerVisible(false)}>
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => setSoundPickerVisible(false)}>
        <TouchableOpacity activeOpacity={1} style={[styles.modalSheet, {backgroundColor: C.primaryBg, borderColor: C.border}]}>
          <Text style={[styles.modalTitle, {color: C.primaryText}]}>Alert Sound</Text>
          {ALARM_SOUNDS.map(sound => {
            const isSelected = sound.id === settings.alertSound;
            const locked = sound.premium && !settings.isPremium;
            return (
              <TouchableOpacity
                key={sound.id}
                style={[
                  styles.soundRow,
                  {borderBottomColor: C.border},
                  isSelected && {backgroundColor: C.tealBg},
                ]}
                onPress={() => handleSoundSelect(sound)}
                activeOpacity={0.6}>
                <Text style={[styles.soundLabel, {color: locked ? C.tertiaryText : C.primaryText}]}>
                  {sound.label}
                </Text>
                {locked ? (
                  <Text style={[styles.lockIcon, {color: C.tertiaryText}]}>🔒</Text>
                ) : isSelected ? (
                  <Text style={[styles.checkIcon, {color: C.tealText}]}>✓</Text>
                ) : null}
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            style={[styles.modalCancel, {borderTopColor: C.border}]}
            onPress={() => setSoundPickerVisible(false)}>
            <Text style={[styles.modalCancelText, {color: C.secondaryText}]}>Cancel</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1},
  scroll: {flex: 1},
  content: {padding: 16, paddingBottom: 80},
  premiumCard: {
    borderRadius: 12,
    borderWidth: 1.5,
    padding: 20,
    marginBottom: 20,
  },
  premiumTitle: {fontSize: 16, fontWeight: '500'},
  premiumPrice: {fontSize: 13, marginTop: 4},
  premiumFeatures: {marginTop: 12, gap: 6},
  premiumFeature: {fontSize: 13},
  premiumBtn: {
    marginTop: 16,
    backgroundColor: '#3B82F6',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  premiumBtnDisabled: {opacity: 0.6},
  premiumBtnText: {fontSize: 14, fontWeight: '500', color: '#FFFFFF'},
  restoreBtn: {marginTop: 10, alignItems: 'center', paddingVertical: 6},
  restoreText: {fontSize: 13},
  premiumActiveBadge: {
    borderRadius: 12,
    borderWidth: 0.5,
    padding: 16,
    marginBottom: 20,
    alignItems: 'center',
  },
  premiumActiveText: {fontSize: 14, fontWeight: '500'},
  section: {
    borderRadius: 12,
    borderWidth: 0.5,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
  },
  rowLabel: {fontSize: 15},
  rowValue: {fontSize: 14},
  rowChevron: {fontSize: 18},
  rowBadge: {
    fontSize: 11,
    fontWeight: '600',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  version: {fontSize: 12, textAlign: 'center', marginTop: 24},
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 0.5,
    paddingTop: 8,
    paddingBottom: 32,
  },
  modalTitle: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 14,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  soundRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 0.5,
  },
  soundLabel: {fontSize: 16},
  lockIcon: {fontSize: 15},
  checkIcon: {fontSize: 18, fontWeight: '700'},
  modalCancel: {
    marginTop: 8,
    borderTopWidth: 0.5,
    paddingVertical: 16,
    alignItems: 'center',
  },
  modalCancelText: {fontSize: 16},
});
