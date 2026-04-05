import React from 'react';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import HomeScreen from '../screens/HomeScreen';
import AddTimerScreen from '../screens/AddTimerScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ManagePresetsScreen from '../screens/ManagePresetsScreen';
import TimerGroupsScreen from '../screens/TimerGroupsScreen';
import {useTheme} from '../hooks/useTheme';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const C = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {backgroundColor: C.primaryBg},
        headerTintColor: C.primaryText,
        headerTitleStyle: {fontWeight: '500', fontSize: 17},
        headerShadowVisible: false,
        headerBackTitleVisible: false,
        contentStyle: {backgroundColor: C.secondaryBg},
      }}>
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{title: 'CookingTimerPro'}}
      />
      <Stack.Screen
        name="AddTimer"
        component={AddTimerScreen}
        options={({route}) => ({
          title: route.params?.timer ? 'Edit Timer' : 'New Timer',
        })}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{title: 'Settings'}}
      />
      <Stack.Screen
        name="ManagePresets"
        component={ManagePresetsScreen}
        options={{title: 'Manage Presets'}}
      />
      <Stack.Screen
        name="TimerGroups"
        component={TimerGroupsScreen}
        options={{title: 'Timer Groups'}}
      />
    </Stack.Navigator>
  );
}
