/**
 * @format
 */

import {AppRegistry, NativeModules, Vibration} from 'react-native';
import App from './App';
import {name as appName} from './app.json';
import notifee, {EventType} from '@notifee/react-native';

// Keeps the foreground service alive while timers are running.
notifee.registerForegroundService(() => new Promise(() => {}));

// Plays bell sound when a timer trigger notification fires in background.
// Only fires for timer completions (id starts with 'trigger-'), NOT for
// the ongoing statusbar notification — which was causing sound on minimize.
notifee.onBackgroundEvent(async ({type, detail}) => {
  if (
    type === EventType.DELIVERED &&
    detail.notification?.id?.startsWith('trigger-')
  ) {
    NativeModules.SoundModule?.playBell();
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const raw = await AsyncStorage.getItem('@CookingTimerPro:settings');
      const parsed = raw ? JSON.parse(raw) : {};
      if (parsed.vibration !== false) {
        Vibration.vibrate([0, 500, 200, 500]);
      }
    } catch (_) {
      Vibration.vibrate([0, 500, 200, 500]);
    }
  }
});

AppRegistry.registerComponent(appName, () => App);
