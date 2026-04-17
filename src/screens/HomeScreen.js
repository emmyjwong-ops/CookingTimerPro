import React, {useEffect} from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  NativeModules,
  Image,
  Platform,
} from 'react-native';
// FIX: use SafeAreaView from react-native-safe-area-context instead of the
// built-in one from react-native — the context-aware version gives correct
// insets on Android (e.g. devices with punch-hole cameras or navigation bars).
import {SafeAreaView} from 'react-native-safe-area-context';
import {useTheme} from '../hooks/useTheme';
import {useTimers} from '../context/TimerContext';
import {useSettings} from '../context/SettingsContext';
import TimerCard from '../components/TimerCard';
import QuickPresets from '../components/QuickPresets';
import AdBanner from '../components/AdBanner';
import MostCooked from '../components/MostCooked';

export default function HomeScreen({navigation}) {
  const {timers, activeTimerCount} = useTimers();
  const {settings} = useSettings();
  const C = useTheme();

  // Apply the "Keep screen on" setting via the native ScreenWakeModule.
  // Runs whenever the setting changes so it stays in sync.
  useEffect(() => {
    if (settings.keepScreenOn) {
      NativeModules.ScreenWakeModule?.enable();
    } else {
      NativeModules.ScreenWakeModule?.disable();
    }
  }, [settings.keepScreenOn]);

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerStyle: {backgroundColor: C.primaryBg},
      headerTintColor: C.primaryText,
      headerRight: () => (
        // The header "+" was removed in v4.5.2 — the big bottom-right FAB is
        // now the single, obvious entry point for adding a timer. The gear
        // remains as the only header button.
        <TouchableOpacity
          onPress={() => navigation.navigate('Settings')}
          accessibilityLabel="Settings"
          accessibilityRole="button"
          hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}>
          {Platform.OS === 'android' ? (
            <Image
              source={{uri: 'ic_settings_gear'}}
              style={[styles.gearIcon, {tintColor: C.primaryText}]}
              resizeMode="contain"
            />
          ) : (
            <Text style={[styles.gearBtn, {color: C.primaryText}]}>{'\u26ED'}</Text>
          )}
        </TouchableOpacity>
      ),
    });
  }, [navigation, C]);

  const renderEmpty = () => (
    <View style={styles.empty}>
      <Text style={[styles.emptyTitle, {color: C.primaryText}]}>
        No timers running
      </Text>
      <Text style={[styles.emptySubtitle, {color: C.secondaryText}]}>
        Tap + or use a quick preset below to get started
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, {backgroundColor: C.secondaryBg}]}>
      <View style={styles.statusBar}>
        <Text style={[styles.statusText, {color: C.secondaryText}]}>
          {activeTimerCount > 0
            ? `${activeTimerCount} active timer${activeTimerCount !== 1 ? 's' : ''}`
            : 'No active timers'}
        </Text>
      </View>

      <FlatList
        data={timers}
        keyExtractor={item => item.id}
        renderItem={({item}) => (
          <TimerCard timer={item} navigation={navigation} />
        )}
        contentContainerStyle={styles.list}
        ListEmptyComponent={renderEmpty}
      />

      <MostCooked />
      <QuickPresets />
      <AdBanner />

      {/* Prominent Floating Action Button — primary entry point for adding a
          timer. First-time users often miss the smaller "+" in the header, so
          this large FAB at the bottom right makes the core action obvious.
          The header "+" is kept for power users already used to it. */}
      <TouchableOpacity
        style={[styles.fab, {backgroundColor: C.tealText}]}
        onPress={() => navigation.navigate('AddTimer')}
        activeOpacity={0.85}
        accessibilityLabel="Add timer"
        accessibilityRole="button">
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addBtn: {
    fontSize: 24,
    fontWeight: '400',
  },
  gearBtn: {
    fontSize: 22,
    fontWeight: '500',
  },
  gearIcon: {
    width: 24,
    height: 24,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 3},
    shadowOpacity: 0.25,
    shadowRadius: 5,
  },
  fabText: {
    fontSize: 34,
    lineHeight: 38,
    color: '#FFFFFF',
    fontWeight: '300',
  },
  statusBar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '400',
  },
  list: {
    paddingHorizontal: 16,
    flexGrow: 1,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  emptySubtitle: {
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
  },
});
