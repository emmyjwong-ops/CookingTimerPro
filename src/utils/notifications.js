import {Platform, Vibration, NativeModules} from 'react-native';
import notifee, {
  AndroidImportance,
  AndroidVisibility,
  TriggerType,
} from '@notifee/react-native';

// Channel IDs — one with vibration, one without.
// Android caches channel settings permanently, so we use separate channels
// rather than trying to update vibration on an existing channel.
const CHANNEL_SOUND_ONLY   = 'cooking-timer-sound-only';
const CHANNEL_SOUND_VIBRATE = 'cooking-timer-sound-vibrate';

function formatRemaining(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export async function configureNotifications() {
  await notifee.requestPermission();

  if (Platform.OS === 'android') {
    // Sound only — no channel-level vibration
    await notifee.createChannel({
      id: CHANNEL_SOUND_ONLY,
      name: 'Timer Complete (sound only)',
      importance: AndroidImportance.HIGH,
      visibility: AndroidVisibility.PUBLIC,
      sound: 'bell',
      vibration: false,
    });

    // Sound + vibration
    await notifee.createChannel({
      id: CHANNEL_SOUND_VIBRATE,
      name: 'Timer Complete (sound + vibration)',
      importance: AndroidImportance.HIGH,
      visibility: AndroidVisibility.PUBLIC,
      sound: 'bell',
      vibration: true,
      vibrationPattern: [0, 500, 200, 500],
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

// Schedule a completion notification via Android AlarmManager.
// vibrationEnabled controls which channel is used — the channel itself
// handles vibration so Android's system respects it correctly.
export async function scheduleTriggerNotification(
  timerId,
  timerName,
  note,
  endTime,
  vibrationEnabled = true,
) {
  const body = note ? `${timerName} is done! (${note})` : `${timerName} is done!`;
  const channelId = vibrationEnabled ? CHANNEL_SOUND_VIBRATE : CHANNEL_SOUND_ONLY;

  await notifee.createTriggerNotification(
    {
      id: `trigger-${timerId}`,
      title: '⏰ Timer Complete',
      body,
      android: {
        channelId,
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

// Updates the persistent notification in the status bar.
export async function updateServiceNotification(timerName, remainingSeconds) {
  await notifee.displayNotification({
    id: 'timer-service',
    title: 'Cooking Timer',
    body: `${timerName} — ${formatRemaining(remainingSeconds)} remaining`,
    android: {
      channelId: 'cooking-timer-ongoing',
      importance: AndroidImportance.LOW,
      ongoing: true,
      asForegroundService: true,
      pressAction: {id: 'default'},
    },
  });
}

// Stops the foreground service and removes the status-bar notification.
export async function stopServiceNotification() {
  try {
    await notifee.stopForegroundService();
  } catch (_) {}
}

// Plays bell sound in foreground. Vibration is already handled by the
// notification channel when the trigger fires — only vibrate here if
// the app is in foreground (where no notification is displayed).
export function playCompletionSound(vibrationEnabled = true) {
  NativeModules.SoundModule?.playBell();
  if (vibrationEnabled) {
    Vibration.vibrate([0, 500, 200, 500, 200, 500]);
  }
}

// Stops the looping bell sound.
export function stopCompletionSound() {
  NativeModules.SoundModule?.stopBell();
}
