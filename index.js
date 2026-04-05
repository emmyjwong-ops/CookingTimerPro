/**
 * @format
 */

import {AppRegistry, NativeModules, Vibration} from 'react-native';
import App from './App';
import {name as appName} from './app.json';
import notifee, {EventType} from '@notifee/react-native';

// Keeps the foreground service alive while timers are running.
notifee.registerForegroundService(() => new Promise(() => {}));

// Plays bell sound when a trigger notification fires while app is in background.
// Reads vibration setting from AsyncStorage to respect user preference.
notifee.onBackgroundEvent(async ({type}) => {
  if (type === EventType.DELIVERED) {
    NativeModules.SoundModule?.playBell();
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const raw = await AsyncStorage.getItem('@CookingTimerPro:settings');
      const settings = raw ? JSON.parse(raw) : {};
      if (settings.vibration !== false) {
        Vibration.vibrate([0, 500, 200, 500]);
      }
    } catch (_) {
      // If we can't read settings, default to vibrating
      Vibration.vibrate([0, 500, 200, 500]);
    }
  }
});

AppRegistry.registerComponent(appName, () => App);
