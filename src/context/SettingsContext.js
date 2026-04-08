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
        setSettings(prev => ({...prev, ...saved}));
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
