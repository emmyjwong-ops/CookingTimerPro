import AsyncStorage from '@react-native-async-storage/async-storage';

const TIMERS_KEY = '@CookingTimerPro:timers';
const SETTINGS_KEY = '@CookingTimerPro:settings';
const COOK_STATS_KEY = '@CookingTimerPro:cookStats';
const PRESETS_KEY = '@CookingTimerPro:presets';
const GROUPS_KEY = '@CookingTimerPro:groups';

export async function saveTimers(timers) {
  try {
    await AsyncStorage.setItem(TIMERS_KEY, JSON.stringify(timers));
  } catch (e) {
    console.warn('Failed to save timers', e);
  }
}

export async function loadTimers() {
  try {
    const raw = await AsyncStorage.getItem(TIMERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn('Failed to load timers', e);
    return [];
  }
}

export async function saveSettings(settings) {
  try {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.warn('Failed to save settings', e);
  }
}

export async function loadSettings() {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    console.warn('Failed to load settings', e);
    return null;
  }
}

export async function savePresets(presets) {
  try {
    await AsyncStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
  } catch (e) {
    console.warn('Failed to save presets', e);
  }
}

export async function loadPresets() {
  try {
    const raw = await AsyncStorage.getItem(PRESETS_KEY);
    return raw ? JSON.parse(raw) : null; // null means use DEFAULT_PRESETS
  } catch (e) {
    console.warn('Failed to load presets', e);
    return null;
  }
}

export async function saveGroups(groups) {
  try {
    await AsyncStorage.setItem(GROUPS_KEY, JSON.stringify(groups));
  } catch (e) {
    console.warn('Failed to save groups', e);
  }
}

export async function loadGroups() {
  try {
    const raw = await AsyncStorage.getItem(GROUPS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn('Failed to load groups', e);
    return [];
  }
}

// cookStats shape:
// { [normalizedName]: { name, count, durations: { [seconds]: timesUsed } } }

function mostUsedDuration(durations) {
  if (!durations || Object.keys(durations).length === 0) {
    return null;
  }
  return parseInt(
    Object.entries(durations).sort((a, b) => b[1] - a[1])[0][0],
    10,
  );
}

export async function incrementCookStat(name, totalSeconds) {
  try {
    const key = name.trim().toLowerCase();
    const raw = await AsyncStorage.getItem(COOK_STATS_KEY);
    const stats = raw ? JSON.parse(raw) : {};
    const prev = stats[key] ?? {name: name.trim(), count: 0, durations: {}};
    const durKey = String(totalSeconds);
    prev.durations[durKey] = (prev.durations[durKey] ?? 0) + 1;
    stats[key] = {
      ...prev,
      name: name.trim(),
      count: prev.count + 1,
    };
    await AsyncStorage.setItem(COOK_STATS_KEY, JSON.stringify(stats));
  } catch (e) {
    console.warn('Failed to update cook stats', e);
  }
}

export async function loadCookStats() {
  try {
    const raw = await AsyncStorage.getItem(COOK_STATS_KEY);
    if (!raw) {
      return [];
    }
    const stats = JSON.parse(raw);
    return Object.values(stats)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map(item => ({
        ...item,
        topSeconds: mostUsedDuration(item.durations),
      }));
  } catch (e) {
    console.warn('Failed to load cook stats', e);
    return [];
  }
}
