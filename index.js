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
notifee.onBackgroundEvent(async ({type}) => {
  if (type === EventType.DELIVERED) {
    NativeModules.SoundModule?.playBell();
    Vibration.vibrate([0, 500, 200, 500]);
  }
});

AppRegistry.registerComponent(appName, () => App);
