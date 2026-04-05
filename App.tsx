import React, {useEffect} from 'react';
import {StatusBar} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {NavigationContainer} from '@react-navigation/native';
import AppNavigator from './src/navigation/AppNavigator';
import {SettingsProvider} from './src/context/SettingsContext';
import {TimerProvider} from './src/context/TimerContext';
import {PurchaseProvider} from './src/context/PurchaseContext';
import {configureNotifications} from './src/utils/notifications';

function App() {
  useEffect(() => {
    configureNotifications();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <SettingsProvider>
        <PurchaseProvider>
          <TimerProvider>
            <NavigationContainer>
              <AppNavigator />
            </NavigationContainer>
          </TimerProvider>
        </PurchaseProvider>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}

export default App;
