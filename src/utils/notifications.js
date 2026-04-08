import {Platform, NativeModules} from 'react-native';
import notifee, {
  AndroidImportance,
  AndroidVisibility,
  TriggerType,
} from '@notifee/react-native';

// Single channel for completion notifications — no vibration at channel level.
// Vibration is handled natively by AlarmSoundService (Vibrator API) to avoid
// the Android channel-caching issue where vibration settings lock in permanently
// after first app install and cannot be changed via createChannel().
const CHANNEL_ALERT = 'cooking-timer-alert-v3';

export async function configureNotifications() {
  await notifee.requestPermission();

  if (Platform.OS === 'android') {
    // Completion alert — sound only. Vibration is handled by AlarmSoundService
    // natively so it is not subject to Android's permanent channel-setting cache.
    await notifee.createChannel({
      id: CHANNEL_ALERT,
      name: 'Timer Complete',
      importance: AndroidImportance.HIGH,
      visibility: AndroidVisibility.PUBLIC,
      sound: 'bell',
      vibration: false,
    });

    // Ongoing status bar notification — always silent
    await notifee.createChannel({
      id: 'cooking-timer-ongoing',
      name: 'Active Timers',
      importance: AndroidImportance.LOW,
      visibility: AndroidVisibility.PUBLIC,
    });
  }
}

// Schedule a completion notification via Notifee's AlarmManager trigger.
// Vibration is NOT controlled here — it is handled natively by AlarmSoundService.
export async function scheduleTriggerNotification(
  timerId,
  timerName,
  note,
  endTime,
) {
  const body = note ? `${timerName} is done! (${note})` : `${timerName} is done!`;

  await notifee.createTriggerNotification(
    {
      id: `trigger-${timerId}`,
      title: '⏰ Timer Complete',
      body,
      android: {
        channelId: CHANNEL_ALERT,
        importance: AndroidImportance.HIGH,
        visibility: AndroidVisibility.PUBLIC,
        pressAction: {id: 'default'},
      },
      ios: {
        sound: 'default',
      },
    },
    {
      type: TriggerType.TIMESTAMP,
      timestamp: endTime,
      alarmManager: {
        allowWhileIdle: true,
      },
    },
  );
}

// Cancel a scheduled trigger notification.
export async function cancelTriggerNotification(timerId) {
  try {
    await notifee.cancelNotification(`trigger-${timerId}`);
  } catch (_) {}
}

// Updates the persistent foreground-service notification in the status bar.
// FIX: uses Android's native chronometer (showChronometer + chronometerDirection: 'down'
// + timestamp = endTime) so the OS itself counts down without any JS involvement.
//
// BUG 8 FIX: all service-notification updates are now serialized through a
// promise chain ref so rapid consecutive displayNotification / stopForegroundService
// calls don't race and leave the notifee foreground service in an inconsistent
// state (e.g. "stop" arriving before its preceding "display" resolves).
let serviceNotifQueue = Promise.resolve();

function enqueueServiceNotif(fn) {
  const next = serviceNotifQueue.then(fn, fn);
  // Keep the chain alive but don't let a rejection break future calls.
  serviceNotifQueue = next.catch(() => {});
  return next;
}

export function updateServiceNotification(timerName, endTime) {
  return enqueueServiceNotif(() =>
    notifee.displayNotification({
      id: 'timer-service',
      title: timerName,
      body: 'Tap to open',
      android: {
        channelId: 'cooking-timer-ongoing',
        importance: AndroidImportance.LOW,
        ongoing: true,
        asForegroundService: true,
        pressAction: {id: 'default'},
        // Native OS chronometer — counts down from endTime without JS.
        showChronometer: true,
        chronometerDirection: 'down',
        timestamp: endTime,
        showTimestamp: true,
      },
    }),
  );
}

// Stops the foreground service and removes the status-bar notification.
export function stopServiceNotification() {
  return enqueueServiceNotif(async () => {
    try {
      await notifee.stopForegroundService();
    } catch (_) {}
  });
}

// Stops the looping bell sound (used by SettingsScreen preview).
export function stopCompletionSound() {
  NativeModules.SoundModule?.stopBell();
}

// Schedule a native AlarmManager alarm that fires AlarmSoundReceiver at endTime.
// This is the only reliable way to play a looping alarm when the screen is off —
// it runs entirely in native Kotlin, no JS thread required.
// vibration controls whether AlarmSoundService vibrates — handled natively to
// avoid Android's permanent notification channel vibration caching.
export function scheduleNativeAlarm(timerId, endTime, soundFile, vibration) {
  NativeModules.AlarmSchedulerModule?.scheduleAlarm(
    timerId,
    endTime,
    soundFile || 'bell',
    vibration === true,
  );
}

// Cancel the native alarm and stop AlarmSoundService if it is currently playing.
export function cancelNativeAlarm(timerId) {
  NativeModules.AlarmSchedulerModule?.cancelAlarm(timerId);
}
