import React from 'react';
import {
  View,
  Text,
  Switch,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {useTheme} from '../hooks/useTheme';
import {useSettings} from '../context/SettingsContext';
import {usePurchase} from '../context/PurchaseContext';

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

export default function SettingsScreen() {
  const {settings, updateSetting} = useSettings();
  const {buyPremium, restorePurchases, purchasing, displayPrice} = usePurchase();
  const C = useTheme();

  const darkModeLabel = {light: 'Light', dark: 'Dark'};

  const cycleDarkMode = () => {
    updateSetting('darkMode', settings.darkMode === 'dark' ? 'light' : 'dark');
  };

  return (
    <ScrollView
      style={[styles.container, {backgroundColor: C.secondaryBg}]}
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
          right={<Text style={[styles.rowValue, {color: C.secondaryText}]}>{settings.alertSound}</Text>}
          onPress={() => Alert.alert('Alert Sound', 'Sound picker coming in v1.1')}
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
          onPress={() => Alert.alert('Presets', 'Custom presets coming in v1.1')}
        />
        <SettingRow
          label="Rate the app"
          C={C}
          onPress={() => Alert.alert('Rate', 'App Store link not configured.')}
        />
      </View>

      <Text style={[styles.version, {color: C.tertiaryText}]}>
        CookingTimerPro v1.0.0
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1},
  content: {padding: 16, paddingBottom: 40},
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
  version: {fontSize: 12, textAlign: 'center', marginTop: 24},
});
