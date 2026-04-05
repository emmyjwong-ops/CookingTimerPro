import {Platform, Vibration, NativeModules} from 'react-native';
import notifee, {
  AndroidImportance,
  AndroidVisibility,
  TriggerType,
} from '@notifee/react-native';

function formatRemaining(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export async function configureNotifications() {
  await notifee.requestPermission();

  if (Platform.OS === 'android') {
    // High-importance channel — sound only, NO channel-level vibration.
    // Vibration is handled entirely in JS so the user setting is respected.
    await notifee.createChannel({
      id: 'cooking-timer-alert-v2',
      name: 'Timer Complete',
      importance: AndroidImportance.HIGH,
      visibility: AndroidVisibility.PUBLIC,
      sound: 'bell',
      vibration: false,
    });

    // Low-importance channel — ongoing "timer running" entry in status bar
    await notifee.createChannel({
      id: 'cooking-timer-ongoing',
      name: 'Active Timers',
      importance: AndroidImportance.LOW,
      visibility: AndroidVisibility.PUBLIC,
    });
  }
}

// Schedule a completion notification via Android AlarmManager.
// This fires at exactly endTime even if the app is killed.
export async function scheduleTriggerNotification(timerId, timerName, note, endTime) {
  const body = note ? `${timerName} is done! (${note})` : `${timerName} is done!`;

  await notifee.createTriggerNotification(
    {
      id: `trigger-${timerId}`,
      title: '⏰ Timer Complete',
      body,
      android: {
        channelId: 'cooking-timer-alert-v2',
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
        allowWhileIdle: true, // fires even in Doze mode
      },
    },
  );
}

// Cancel a scheduled trigger notification (e.g. when timer is dismissed/edited).
export async function cancelTriggerNotification(timerId) {
  try {
    await notifee.cancelNotification(`trigger-${timerId}`);
  } catch (_) {}
}

// Updates (or creates) the persistent notification in the status bar.
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

// Starts looping bell sound + vibration on timer completion.
export function playCompletionSound(vibrationEnabled = true) {
  NativeModules.SoundModule?.playBell();
  if (vibrationEnabled) {
    Vibration.vibrate([0, 500, 200, 500, 200, 500]);
  }
}

// Stops the looping bell sound (called on Dismiss or +5 min).
export function stopCompletionSound() {
  NativeModules.SoundModule?.stopBell();
}
