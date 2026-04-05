/**
 * @format
 */

import {AppRegistry, NativeModules, AppState} from 'react-native';
import App from './App';
import {name as appName} from './app.json';
import notifee, {EventType} from '@notifee/react-native';

// Keeps the foreground service alive while timers are running.
notifee.registerForegroundService(() => new Promise(() => {}));

// Plays bell sound when a timer trigger notification fires in background.
// Only fires for timer completions (id starts with 'trigger-'), NOT for
// the ongoing statusbar notification.
//
// FIX: guard against firing while the app is active — the foreground
// interval in TimerContext already handles sound in that case, so playing
// here too would cause doubled/layered sound.
//
// FIX: notification channel handles vibration on Android automatically;
// a separate Vibration.vibrate() call here would cause double-vibration.
notifee.onBackgroundEvent(async ({type, detail}) => {
  if (
    type === EventType.DELIVERED &&
    detail.notification?.id?.startsWith('trigger-') &&
    AppState.currentState !== 'active'
  ) {
    NativeModules.SoundModule?.playBell();
  }
});

AppRegistry.registerComponent(appName, () => App);
