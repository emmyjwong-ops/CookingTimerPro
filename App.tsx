import React, {useEffect} from 'react';
import {StatusBar} from 'react-native';
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
