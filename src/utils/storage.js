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
    // FIX: null means "use defaults" — remove the key entirely rather than
    // writing "null", which is fragile and confusing on future reads.
    if (presets === null) {
      await AsyncStorage.removeItem(PRESETS_KEY);
    } else {
      await AsyncStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
    }
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

// ISSUES 8 & 9: serialize ALL cookStat mutations through a promise-chain
// queue so that concurrent read-modify-write cycles (e.g. two timers
// completing at once) do not clobber each other. The queue lives at module
// scope so every caller shares the same chain; `loadCookStats` stays
// non-queued since it is read-only.
let cookStatsQueue = Promise.resolve();
function enqueueCookStats(fn) {
  const next = cookStatsQueue.then(fn, fn);
  cookStatsQueue = next.catch(() => {});
  return next;
}

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
  return enqueueCookStats(async () => {
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
  });
}

// Remove a single entry from the Most-cooked leaderboard.
// Keyed by the same normalized-lowercase key used in incrementCookStat so
// the caller can pass the display-cased name from the UI and still match.
export async function removeCookStat(name) {
  return enqueueCookStats(async () => {
    try {
      const key = name.trim().toLowerCase();
      const raw = await AsyncStorage.getItem(COOK_STATS_KEY);
      if (!raw) {return;}
      const stats = JSON.parse(raw);
      if (stats[key]) {
        delete stats[key];
        await AsyncStorage.setItem(COOK_STATS_KEY, JSON.stringify(stats));
      }
    } catch (e) {
      console.warn('Failed to remove cook stat', e);
    }
  });
}

// Rename an entry in the Most-cooked leaderboard. If a stat with the target
// name already exists, the counts and durations are merged into it.
export async function renameCookStat(oldName, newName) {
  return enqueueCookStats(async () => {
    try {
      const oldKey = oldName.trim().toLowerCase();
      const newKey = newName.trim().toLowerCase();
      if (!newKey || oldKey === newKey) {return;}
      const raw = await AsyncStorage.getItem(COOK_STATS_KEY);
      if (!raw) {return;}
      const stats = JSON.parse(raw);
      const entry = stats[oldKey];
      if (!entry) {return;}
      const existing = stats[newKey];
      if (existing) {
        // Merge durations and counts into the existing destination entry.
        const mergedDurations = {...existing.durations};
        for (const [sec, n] of Object.entries(entry.durations ?? {})) {
          mergedDurations[sec] = (mergedDurations[sec] ?? 0) + n;
        }
        stats[newKey] = {
          name: newName.trim(),
          count: (existing.count ?? 0) + (entry.count ?? 0),
          durations: mergedDurations,
        };
      } else {
        stats[newKey] = {...entry, name: newName.trim()};
      }
      delete stats[oldKey];
      await AsyncStorage.setItem(COOK_STATS_KEY, JSON.stringify(stats));
    } catch (e) {
      console.warn('Failed to rename cook stat', e);
    }
  });
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
