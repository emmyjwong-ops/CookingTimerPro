import {Alert, NativeModules, Platform} from 'react-native';

const {PermissionsModule} = NativeModules;

// Module-level flag — ensures dialogs are shown at most once per app session
// even if addTimer is called rapidly or in quick succession.
let _permissionsChecked = false;

// Called on first timer creation. Checks and requests the two critical
// Android permissions needed for timers to work correctly in the background:
// 1. Exact alarm permission (Android 12 only — auto-granted on 13+)
// 2. Battery optimization exemption (all Android versions)
export async function ensureAndroidPermissions() {
  if (_permissionsChecked || Platform.OS !== 'android' || !PermissionsModule) {
    return;
  }
  _permissionsChecked = true;
  await checkExactAlarm();
  await checkBatteryOptimization();
}

async function checkExactAlarm() {
  try {
    const canSchedule = await PermissionsModule.canScheduleExactAlarms();
    if (!canSchedule) {
      Alert.alert(
        'Allow Exact Alarms',
        'To make sure your timers ring at exactly the right time, please allow CookingTimerPro to schedule exact alarms.',
        [
          {text: 'Not now', style: 'cancel'},
          {
            text: 'Allow',
            onPress: () => PermissionsModule.openExactAlarmSettings(),
          },
        ],
      );
    }
  } catch (_) {}
}

async function checkBatteryOptimization() {
  try {
    const isDisabled = await PermissionsModule.isBatteryOptimizationDisabled();
    if (!isDisabled) {
      // FIX: lowercase for reliable comparison — Android's Build.MANUFACTURER
      // returns mixed case (e.g. "Samsung", "HUAWEI", "Xiaomi").
      const raw = await PermissionsModule.getManufacturer();
      const mfr = (raw || '').toLowerCase();
      const isSamsung = mfr === 'samsung';
      const isXiaomi = mfr === 'xiaomi';
      const isHuawei = mfr === 'huawei' || mfr === 'honor';

      let extra = '';
      if (isSamsung) {
        extra =
          '\n\nOn Samsung: also go to Settings → Battery → Background usage limits and make sure CookingTimerPro is not restricted.';
      } else if (isXiaomi) {
        extra =
          '\n\nOn Xiaomi/MIUI: also enable "Autostart" for CookingTimerPro in Settings → Apps → Manage apps.';
      } else if (isHuawei) {
        extra =
          '\n\nOn Huawei: also go to Settings → Battery → App launch and enable all options for CookingTimerPro.';
      }

      Alert.alert(
        'Keep Timers Running',
        `To make sure your timers work when the screen is off, disable battery optimization for CookingTimerPro.${extra}`,
        [
          {text: 'Not now', style: 'cancel'},
          {
            text: 'Disable optimization',
            onPress: () =>
              PermissionsModule.requestDisableBatteryOptimization(),
          },
        ],
      );
    }
  } catch (_) {}
}
