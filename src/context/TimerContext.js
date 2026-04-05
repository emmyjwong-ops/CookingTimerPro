import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import notifee, {EventType} from '@notifee/react-native';
import {saveTimers, loadTimers, incrementCookStat, loadCookStats} from '../utils/storage';
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

  // Play alarm sound when a trigger notification fires while app is in foreground.
  // This fires at exactly endTime via AlarmManager — no delay.
  useEffect(() => {
    const unsubscribe = notifee.onForegroundEvent(({type, detail}) => {
      if (
        type === EventType.DELIVERED &&
        detail.notification?.id?.startsWith('trigger-')
      ) {
        playCompletionSound(settings.vibration);
      }
    });
    return unsubscribe;
  }, [settings.vibration]);

  // Countdown tick — only updates UI state and service notification.
  // Sound is handled by onForegroundEvent / onBackgroundEvent above.
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setTimers(prev =>
        prev.map(t => {
          if (t.isRunning && !t.isComplete && t.endTime) {
            const remaining = Math.max(0, Math.floor((t.endTime - now) / 1000));
            return {
              ...t,
              remainingSeconds: remaining,
              isRunning: remaining > 0,
              isComplete: remaining === 0,
            };
          }
          return t;
        }),
      );
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const addTimer = useCallback(
    (name, note, totalSeconds) => {
      const activeCount = timersRef.current.filter(t => !t.isComplete).length;
      if (!settings.isPremium && activeCount >= MAX_FREE_TIMERS) {
        return {error: 'free_limit'};
      }
      incrementCookStat(name, totalSeconds).then(() =>
        loadCookStats().then(stats => setCookStats(stats)),
      );
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
      // Schedule alarm-based completion notification
      scheduleTriggerNotification(newTimer.id, name, note, endTime);
      setTimers(prev => [newTimer, ...prev]);
      return {error: null, timer: newTimer};
    },
    [settings.isPremium],
  );

  const dismissTimer = useCallback(id => {
    cancelTriggerNotification(id);
    stopCompletionSound();
    setTimers(prev => prev.filter(t => t.id !== id));
  }, []);

  const editTimer = useCallback((id, name, note, totalSeconds) => {
    const endTime = Date.now() + totalSeconds * 1000;
    cancelTriggerNotification(id);
    scheduleTriggerNotification(id, name, note, endTime);
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
        scheduleTriggerNotification(id, t.name, t.note, newEndTime);
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
          // Pausing: cancel the alarm, freeze remainingSeconds
          cancelTriggerNotification(id);
          return {...t, isRunning: false};
        } else {
          // Resuming: set a new endTime from current remainingSeconds
          const newEndTime = Date.now() + t.remainingSeconds * 1000;
          scheduleTriggerNotification(id, t.name, t.note, newEndTime);
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
