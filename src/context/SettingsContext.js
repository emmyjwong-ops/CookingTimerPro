import React, {createContext, useContext, useState, useEffect, useCallback} from 'react';
import {saveSettings, loadSettings, savePresets, loadPresets} from '../utils/storage';

const SettingsContext = createContext();

const DEFAULT_SETTINGS = {
  alertSound: 'bell',
  vibration: true,
  keepScreenOn: false,
  darkMode: 'light', // 'light' | 'dark'
  isPremium: false,
};

export function SettingsProvider({children}) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  // null = use DEFAULT_PRESETS from constants; array = user's custom list
  const [customPresets, setCustomPresets] = useState(null);

  useEffect(() => {
    loadSettings().then(saved => {
      if (saved) {
        // ISSUE 19: migrate legacy `darkMode: 'system'` (from an earlier
        // version that supported a third "System" segment) to 'light'.
        // Without this the theme segmented control would silently fall into
        // the "light" branch anyway, but the saved value would stay as
        // 'system' and re-confuse future readers. Normalize once here.
        const migrated = {...saved};
        if (migrated.darkMode !== 'light' && migrated.darkMode !== 'dark') {
          migrated.darkMode = 'light';
        }
        setSettings(prev => ({...prev, ...migrated}));
      }
      setLoaded(true);
    });
    loadPresets().then(p => setCustomPresets(p));
  }, []);

  useEffect(() => {
    if (loaded) {
      saveSettings(settings);
    }
  }, [settings, loaded]);

  const updateSetting = useCallback((key, value) => {
    setSettings(prev => ({...prev, [key]: value}));
  }, []);

  const updatePresets = useCallback(presets => {
    setCustomPresets(presets);
    savePresets(presets);
  }, []);

  return (
    <SettingsContext.Provider
      value={{settings, updateSetting, customPresets, updatePresets}}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return ctx;
}
