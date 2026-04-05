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
import {getSoundFile} from '../constants/sounds';
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
  const isAddingRef = useRef(false);
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

  // Status-bar notification — dedicated 1-second interval reading directly
  // from timersRef + fresh endTime to avoid batched-state lag.
  // FIX: soonest timer is now selected by endTime (not stale remainingSeconds).
  useEffect(() => {
    if (!loaded) {
      return;
    }
    const notifInterval = setInterval(() => {
      const now = Date.now();
      const active = timersRef.current.filter(t => t.isRunning && !t.isComplete);
      if (active.length > 0) {
        // FIX: compare by absolute endTime for accurate selection.
        const soonest = active.reduce((a, b) => {
          const aEnd = a.endTime ?? Infinity;
          const bEnd = b.endTime ?? Infinity;
          return aEnd < bEnd ? a : b;
        });
        const remaining = soonest.endTime
          ? Math.max(0, Math.floor((soonest.endTime - now) / 1000))
          : soonest.remainingSeconds;
        updateServiceNotification(soonest.name, remaining);
      } else {
        stopServiceNotification();
      }
    }, 1000);
    return () => clearInterval(notifInterval);
  }, [loaded]);

  // Countdown tick — identifies completions BEFORE setTimers so sound is
  // never a side-effect inside a pure state updater.
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const current = timersRef.current;

      const completing = current.filter(
        t =>
          t.isRunning &&
          !t.isComplete &&
          t.endTime &&
          Math.max(0, Math.floor((t.endTime - now) / 1000)) === 0,
      );

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

      if (completing.length > 0) {
        playCompletionSound(getSoundFile(settings.alertSound), settings.vibration);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [settings.alertSound, settings.vibration]);

  const addTimer = useCallback(
    (name, note, totalSeconds) => {
      if (isAddingRef.current) {
        return {error: 'busy'};
      }
      isAddingRef.current = true;
      try {
        ensureAndroidPermissions();
        const activeCount = timersRef.current.filter(
          t => t.isRunning && !t.isComplete,
        ).length;
        if (!settings.isPremium && activeCount >= MAX_FREE_TIMERS) {
          return {error: 'free_limit'};
        }
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
        scheduleTriggerNotification(
          newTimer.id,
          name,
          note,
          endTime,
          settings.vibration,
        );
        setTimers(prev => [newTimer, ...prev]);
        return {error: null, timer: newTimer};
      } finally {
        isAddingRef.current = false;
      }
    },
    [settings.isPremium, settings.vibration],
  );

  const dismissTimer = useCallback(id => {
    const timer = timersRef.current.find(t => t.id === id);
    if (timer?.isComplete) {
      incrementCookStat(timer.name, timer.totalSeconds)
        .then(() => loadCookStats())
        .then(stats => setCookStats(stats))
        .catch(() => {});
    }
    cancelTriggerNotification(id);
    stopCompletionSound();
    setTimers(prev => prev.filter(t => t.id !== id));
  }, []);

  const editTimer = useCallback(
    (id, name, note, totalSeconds) => {
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
    },
    [settings.vibration],
  );

  // FIX: compute fresh remaining from endTime instead of stale
  // timersRef.current.remainingSeconds (could be up to 499ms old).
  const extendTimer = useCallback(
    (id, extraSeconds) => {
      stopCompletionSound();
      const timer = timersRef.current.find(t => t.id === id);
      if (!timer) {
        return;
      }
      const now = Date.now();
      const freshRemaining =
        timer.endTime && timer.isRunning
          ? Math.max(0, Math.floor((timer.endTime - now) / 1000))
          : timer.remainingSeconds;
      const newRemaining = freshRemaining + extraSeconds;
      const newEndTime = now + newRemaining * 1000;
      cancelTriggerNotification(id);
      scheduleTriggerNotification(
        id,
        timer.name,
        timer.note,
        newEndTime,
        settings.vibration,
      );
      setTimers(prev =>
        prev.map(t =>
          t.id === id
            ? {
                ...t,
                remainingSeconds: newRemaining,
                totalSeconds: t.totalSeconds + extraSeconds,
                endTime: newEndTime,
                isRunning: true,
                isComplete: false,
              }
            : t,
        ),
      );
    },
    [settings.vibration],
  );

  // FIX: notification side effects moved OUTSIDE setTimers updater.
  // Previously cancelTriggerNotification / scheduleTriggerNotification were
  // called inside the pure updater function, which React may invoke twice.
  const pauseTimer = useCallback(
    id => {
      const timer = timersRef.current.find(t => t.id === id);
      if (!timer) {
        return;
      }
      if (timer.isRunning) {
        // Pausing: cancel alarm and freeze state
        cancelTriggerNotification(id);
        stopServiceNotification();
        setTimers(prev =>
          prev.map(t =>
            t.id === id ? {...t, isRunning: false, endTime: null} : t,
          ),
        );
      } else {
        // Resuming: schedule new alarm from current remaining
        const newEndTime = Date.now() + timer.remainingSeconds * 1000;
        scheduleTriggerNotification(
          id,
          timer.name,
          timer.note,
          newEndTime,
          settings.vibration,
        );
        setTimers(prev =>
          prev.map(t =>
            t.id === id ? {...t, isRunning: true, endTime: newEndTime} : t,
          ),
        );
      }
    },
    [settings.vibration],
  );

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
