import React, {createContext, useContext, useState, useEffect} from 'react';
import {saveSettings, loadSettings} from '../utils/storage';

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

  useEffect(() => {
    loadSettings().then(saved => {
      if (saved) {
        setSettings(prev => ({...prev, ...saved}));
      }
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (loaded) {
      saveSettings(settings);
    }
  }, [settings, loaded]);

  const updateSetting = (key, value) => {
    setSettings(prev => ({...prev, [key]: value}));
  };

  return (
    <SettingsContext.Provider value={{settings, updateSetting}}>
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
