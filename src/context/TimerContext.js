import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import {saveTimers, loadTimers, incrementCookStat, loadCookStats} from '../utils/storage';
import {ensureAndroidPermissions} from '../utils/androidPermissions';
import {
  scheduleTriggerNotification,
  cancelTriggerNotification,
  updateServiceNotification,
  stopServiceNotification,
  playCompletionSound,
  stopCompletionSound,
} from '../utils/notifications';
import {useSettings} from './SettingsContext';
import {MAX_FREE_TIMERS} from '../constants/presets';

const TimerContext = createContext();

export function TimerProvider({children}) {
  const [timers, setTimers] = useState([]);
  const [cookStats, setCookStats] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const timersRef = useRef(timers);
  const isAddingRef = useRef(false); // prevents race condition on rapid addTimer calls
  const {settings} = useSettings();

  useEffect(() => {
    timersRef.current = timers;
  }, [timers]);

  // Load persisted timers on mount
  useEffect(() => {
    loadCookStats().then(stats => setCookStats(stats));
    loadTimers().then(saved => {
      if (saved && saved.length > 0) {
        const now = Date.now();
        const restored = saved.map(t => {
          if (t.isRunning && !t.isComplete && t.endTime) {
            const remaining = Math.max(0, Math.floor((t.endTime - now) / 1000));
            return {
              ...t,
              remainingSeconds: remaining,
              isComplete: remaining === 0,
              isRunning: remaining > 0,
            };
          }
          return t;
        });
        setTimers(restored);
      }
      setLoaded(true);
    });
  }, []);

  // Persist on every change
  useEffect(() => {
    if (loaded) {
      saveTimers(timers);
    }
  }, [timers, loaded]);

  // Update the status-bar service notification when timers change
  useEffect(() => {
    if (!loaded) {
      return;
    }
    const active = timers.filter(t => t.isRunning && !t.isComplete);
    if (active.length > 0) {
      const soonest = active.reduce((a, b) =>
        a.remainingSeconds < b.remainingSeconds ? a : b,
      );
      updateServiceNotification(soonest.name, soonest.remainingSeconds);
    } else {
      stopServiceNotification();
    }
  }, [timers, loaded]);

  // Countdown tick — updates UI and plays sound at exactly the right moment.
  // Sound is triggered here (foreground) or by onBackgroundEvent (background).
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      let anyCompleted = false;

      setTimers(prev =>
        prev.map(t => {
          if (t.isRunning && !t.isComplete && t.endTime) {
            const remaining = Math.max(0, Math.floor((t.endTime - now) / 1000));
            const justCompleted = remaining === 0;
            if (justCompleted) {
              anyCompleted = true;
            }
            return {
              ...t,
              remainingSeconds: remaining,
              isRunning: !justCompleted,
              isComplete: justCompleted,
            };
          }
          return t;
        }),
      );

      if (anyCompleted) {
        playCompletionSound(settings.vibration);
      }
    }, 500); // 500ms interval = max 0.5s delay, catches exact second reliably

    return () => clearInterval(interval);
  }, [settings.vibration]);

  const addTimer = useCallback(
    (name, note, totalSeconds) => {
      if (isAddingRef.current) {
        return {error: 'busy'};
      }
      isAddingRef.current = true;
      // Check Android permissions on first use (non-blocking)
      ensureAndroidPermissions();
      const activeCount = timersRef.current.filter(t => !t.isComplete).length;
      if (!settings.isPremium && activeCount >= MAX_FREE_TIMERS) {
        isAddingRef.current = false;
        return {error: 'free_limit'};
      }
      incrementCookStat(name, totalSeconds)
        .then(() => loadCookStats())
        .then(stats => setCookStats(stats))
        .catch(() => {});
      const endTime = Date.now() + totalSeconds * 1000;
      const newTimer = {
        id: Date.now().toString(),
        name,
        note: note || '',
        totalSeconds,
        remainingSeconds: totalSeconds,
        endTime,
        isRunning: true,
        isComplete: false,
        createdAt: Date.now(),
      };
      scheduleTriggerNotification(newTimer.id, name, note, endTime, settings.vibration);
      setTimers(prev => [newTimer, ...prev]);
      isAddingRef.current = false;
      return {error: null, timer: newTimer};
    },
    [settings.isPremium, settings.vibration],
  );

  const dismissTimer = useCallback(id => {
    cancelTriggerNotification(id);
    stopCompletionSound();
    setTimers(prev => prev.filter(t => t.id !== id));
  }, []);

  const editTimer = useCallback((id, name, note, totalSeconds) => {
    const endTime = Date.now() + totalSeconds * 1000;
    cancelTriggerNotification(id);
    scheduleTriggerNotification(id, name, note, endTime, settings.vibration);
    setTimers(prev =>
      prev.map(t =>
        t.id === id
          ? {
              ...t,
              name,
              note: note || '',
              totalSeconds,
              remainingSeconds: totalSeconds,
              endTime,
              isRunning: true,
              isComplete: false,
            }
          : t,
      ),
    );
  }, []);

  const extendTimer = useCallback((id, extraSeconds) => {
    stopCompletionSound();
    setTimers(prev =>
      prev.map(t => {
        if (t.id !== id) {
          return t;
        }
        const newRemaining = t.remainingSeconds + extraSeconds;
        const newEndTime = Date.now() + newRemaining * 1000;
        cancelTriggerNotification(id);
        scheduleTriggerNotification(id, t.name, t.note, newEndTime, settings.vibration);
        return {
          ...t,
          remainingSeconds: newRemaining,
          totalSeconds: t.totalSeconds + extraSeconds,
          endTime: newEndTime,
          isRunning: true,
          isComplete: false,
        };
      }),
    );
  }, []);

  const pauseTimer = useCallback(id => {
    setTimers(prev =>
      prev.map(t => {
        if (t.id !== id) {
          return t;
        }
        if (t.isRunning) {
          // Pausing: cancel the alarm, freeze remainingSeconds, clear endTime
          cancelTriggerNotification(id);
          stopServiceNotification();
          return {...t, isRunning: false, endTime: null};
        } else {
          // Resuming: set a new endTime from current remainingSeconds
          const newEndTime = Date.now() + t.remainingSeconds * 1000;
          scheduleTriggerNotification(id, t.name, t.note, newEndTime, settings.vibration);
          return {...t, isRunning: true, endTime: newEndTime};
        }
      }),
    );
  }, []);

  const activeTimerCount = timers.filter(
    t => t.isRunning && !t.isComplete,
  ).length;

  return (
    <TimerContext.Provider
      value={{
        timers,
        cookStats,
        activeTimerCount,
        addTimer,
        editTimer,
        dismissTimer,
        extendTimer,
        pauseTimer,
      }}>
      {children}
    </TimerContext.Provider>
  );
}

export function useTimers() {
  const ctx = useContext(TimerContext);
  if (!ctx) {
    throw new Error('useTimers must be used within TimerProvider');
  }
  return ctx;
}
