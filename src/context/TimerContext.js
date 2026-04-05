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

  // Update the status-bar notification on a dedicated 1-second interval.
  // Reading directly from timersRef + fresh endTime avoids the lag that
  // occurred when React-batched state updates caused the notification to
  // skip or duplicate seconds.
  useEffect(() => {
    if (!loaded) {
      return;
    }
    const notifInterval = setInterval(() => {
      const now = Date.now();
      const active = timersRef.current.filter(t => t.isRunning && !t.isComplete);
      if (active.length > 0) {
        const soonest = active.reduce((a, b) =>
          a.remainingSeconds < b.remainingSeconds ? a : b,
        );
        // Compute fresh remaining time from absolute endTime so the
        // notification always shows the correct second.
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

  // Countdown tick — checks absolute endTime so accuracy is preserved even
  // when the JS thread is throttled. Sound is triggered here in foreground;
  // the background AlarmManager notification handles background completions.
  //
  // FIX: completing timers are identified BEFORE setTimers is called, so the
  // sound side-effect is never inside a pure state-updater function (which
  // React may invoke more than once in Strict Mode / concurrent mode).
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const current = timersRef.current;

      // Identify timers completing THIS tick (outside the updater — no side
      // effects inside pure updater functions).
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

  // FIX: isAddingRef is always released in a finally block so a thrown
  // exception can never leave it permanently stuck on true.
  const addTimer = useCallback(
    (name, note, totalSeconds) => {
      if (isAddingRef.current) {
        return {error: 'busy'};
      }
      isAddingRef.current = true;
      try {
        // Check Android permissions on first use (non-blocking)
        ensureAndroidPermissions();

        // FIX: use the same definition as activeTimerCount (running & !complete)
        // so paused timers don't count against the free limit.
        const activeCount = timersRef.current.filter(
          t => t.isRunning && !t.isComplete,
        ).length;
        if (!settings.isPremium && activeCount >= MAX_FREE_TIMERS) {
          return {error: 'free_limit'};
        }

        // Cook stats are now incremented in dismissTimer when isComplete, so
        // only completed cooks are counted (not timers that were never used).

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

  // FIX: incrementCookStat moved here (was in addTimer) so only actually
  // completed cooks are counted, not timers that were dismissed mid-way.
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

  // FIX: added settings.vibration to dep array so re-scheduling uses the
  // current vibration preference, not the one captured at first render.
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

  // FIX: notification calls moved OUTSIDE the setTimers updater — side effects
  // must not live inside a pure updater function.
  // FIX: added settings.vibration to dep array.
  const extendTimer = useCallback(
    (id, extraSeconds) => {
      stopCompletionSound();
      const timer = timersRef.current.find(t => t.id === id);
      if (!timer) {
        return;
      }
      const newRemaining = timer.remainingSeconds + extraSeconds;
      const newEndTime = Date.now() + newRemaining * 1000;
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

  // FIX: added settings.vibration to dep array.
  const pauseTimer = useCallback(
    id => {
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
            scheduleTriggerNotification(
              id,
              t.name,
              t.note,
              newEndTime,
              settings.vibration,
            );
            return {...t, isRunning: true, endTime: newEndTime};
          }
        }),
      );
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
