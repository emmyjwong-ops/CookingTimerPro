import React, {useCallback} from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  Platform,
} from 'react-native';
// FIX: use SafeAreaView from react-native-safe-area-context instead of the
// built-in one from react-native — the context-aware version gives correct
// insets on Android (e.g. devices with punch-hole cameras or navigation bars).
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTheme} from '../hooks/useTheme';
import {useTimers} from '../context/TimerContext';
import {useSettings} from '../context/SettingsContext';
import TimerCard from '../components/TimerCard';
import QuickPresets from '../components/QuickPresets';
import AdBanner from '../components/AdBanner';
import MostCooked from '../components/MostCooked';

// Approximate heights below the Quick start pills used to vertically align
// the FAB's center with the row of pills. The AdBanner sits below Quick start
// (≈60 dp adaptive banner height on phones) and we lift the FAB by roughly
// half a pill height so it visually sits on the same line as "Pasta", "Rice",
// "Eggs", etc. Tune these if the layout changes.
const AD_BANNER_HEIGHT = 60;
const QUICK_PRESETS_BOTTOM_TO_PILL_CENTER = 30;

export default function HomeScreen({navigation}) {
  const {timers, activeTimerCount} = useTimers();
  const {settings} = useSettings();
  const C = useTheme();
  // Safe-area bottom inset — Samsung gesture nav bar overlays the bottom of
  // the screen and covered the FAB at `bottom: 24`. Lifting the FAB by the
  // inset guarantees it clears the nav bar on every device.
  const insets = useSafeAreaInsets();

  // ISSUE 18: the "Keep screen on" effect is now applied app-wide in App.tsx
  // so that it works on all screens (timer detail, settings, etc.), not only
  // while the user is on the Home screen.

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

  // ISSUE 23: memoize renderEmpty so FlatList doesn't remount it on every tick.
  const renderEmpty = useCallback(
    () => (
      <View style={styles.empty}>
        <Text style={[styles.emptyTitle, {color: C.primaryText}]}>
          No timers running
        </Text>
        <Text style={[styles.emptySubtitle, {color: C.secondaryText}]}>
          Tap the + button or use a quick preset to get started
        </Text>
      </View>
    ),
    [C.primaryText, C.secondaryText],
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
          timer. Positioned so its vertical center aligns with the Quick start
          pill row ("Pasta", "Rice", etc.) and it clears the device's bottom
          navigation bar via the safe-area inset. */}
      <TouchableOpacity
        style={[
          styles.fab,
          {
            backgroundColor: C.tealText,
            // Lift FAB above the nav bar, above the AdBanner (if present),
            // and up to the pill row's vertical center. 30 offsets half the
            // FAB height so its center (not its bottom) aligns with the pill
            // center. ISSUE 6: AdBanner renders null for Premium users, so
            // AD_BANNER_HEIGHT should be 0 when Premium — otherwise the FAB
            // floats with a ~60dp gap above the pills.
            bottom:
              insets.bottom +
              (settings.isPremium ? 0 : AD_BANNER_HEIGHT) +
              QUICK_PRESETS_BOTTOM_TO_PILL_CENTER -
              30,
          },
        ]}
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
    // `bottom` is set dynamically via insets in render so the FAB clears the
    // device's gesture navigation bar and aligns with the Quick start pills.
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
