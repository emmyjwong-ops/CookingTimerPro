/**
 * @format
 */

import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';
import notifee from '@notifee/react-native';

// Keeps the Notifee foreground service alive while timers are running.
notifee.registerForegroundService(() => new Promise(() => {}));

// Alarm sound is now handled entirely by the native AlarmSoundService
// (AlarmSchedulerModule → AlarmSoundReceiver → AlarmSoundService).
// No JS code is needed here for sound — it fires even when the screen is off.
notifee.onBackgroundEvent(async () => {});

AppRegistry.registerComponent(appName, () => App);
