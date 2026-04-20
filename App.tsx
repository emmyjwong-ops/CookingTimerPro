import React, {useEffect} from 'react';
import {StatusBar, NativeModules} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {NavigationContainer} from '@react-navigation/native';
import AppNavigator from './src/navigation/AppNavigator';
import {SettingsProvider, useSettings} from './src/context/SettingsContext';
import {TimerProvider} from './src/context/TimerContext';
import {PurchaseProvider} from './src/context/PurchaseContext';
import {configureNotifications} from './src/utils/notifications';

// Inner component so it can read settings for StatusBar
function AppContent() {
  const {settings} = useSettings();
  const isDark = settings.darkMode === 'dark';

  useEffect(() => {
    configureNotifications();
  }, []);

  // ISSUE 18: apply "Keep screen on" app-wide (previously was only applied
  // while the user was on HomeScreen). Runs whenever the setting changes.
  useEffect(() => {
    if (settings.keepScreenOn) {
      NativeModules.ScreenWakeModule?.enable();
    } else {
      NativeModules.ScreenWakeModule?.disable();
    }
  }, [settings.keepScreenOn]);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <PurchaseProvider>
        <TimerProvider>
          <NavigationContainer>
            <AppNavigator />
          </NavigationContainer>
        </TimerProvider>
      </PurchaseProvider>
    </SafeAreaProvider>
  );
}

function App() {
  return (
    <SettingsProvider>
      <AppContent />
    </SettingsProvider>
  );
}

export default App;
