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
  scheduleNativeAlarm,
  cancelNativeAlarm,
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
  // Tracks the last notification key (name|endTime) so we only call
  // displayNotification when the soonest timer actually changes — avoids
  // spurious calls on every 500ms countdown tick.
  const lastNotifKeyRef = useRef(null);
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

  // FIX: Status-bar notification now uses Android's native OS chronometer
  // (updateServiceNotification passes endTime, not remainingSeconds).
  // The OS counts down smoothly even when the JS thread is throttled in
  // the background — no JS setInterval required for the display update.
  //
  // We only call displayNotification when the soonest timer's identity
  // (name or endTime) actually changes, so the 500ms countdown tick that
  // updates remainingSeconds doesn't trigger a redundant API call.
  useEffect(() => {
    if (!loaded) {
      return;
    }
    const active = timers.filter(t => t.isRunning && !t.isComplete);
    if (active.length > 0) {
      const soonest = active.reduce((a, b) =>
        (a.endTime ?? Infinity) < (b.endTime ?? Infinity) ? a : b,
      );
      if (!soonest.endTime) {
        return;
      }
      const key = `${soonest.name}|${soonest.endTime}`;
      if (lastNotifKeyRef.current === key) {
        return; // Nothing changed — chronometer is already running correctly.
      }
      lastNotifKeyRef.current = key;
      updateServiceNotification(soonest.name, soonest.endTime);
    } else {
      if (lastNotifKeyRef.current === null) {
        return; // Already stopped.
      }
      lastNotifKeyRef.current = null;
      stopServiceNotification();
    }
  }, [timers, loaded]);

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

      // Sound is now played by the native AlarmSoundService (scheduled via
      // AlarmSchedulerModule) — no JS call needed here.
    }, 1000);

    return () => clearInterval(interval);
  }, []);

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
        scheduleTriggerNotification(newTimer.id, name, note, endTime);
        // Native alarm fires AlarmSoundReceiver at endTime — works even when
        // the screen is off or the JS thread is throttled. vibration is passed
        // to AlarmSoundService which handles it natively (Vibrator API).
        scheduleNativeAlarm(newTimer.id, endTime, getSoundFile(settings.alertSound), settings.vibration);
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
    cancelNativeAlarm(id); // stops AlarmSoundService if playing
    setTimers(prev => prev.filter(t => t.id !== id));
  }, []);

  const editTimer = useCallback(
    (id, name, note, totalSeconds) => {
      const endTime = Date.now() + totalSeconds * 1000;
      cancelTriggerNotification(id);
      cancelNativeAlarm(id);
      scheduleTriggerNotification(id, name, note, endTime);
      scheduleNativeAlarm(id, endTime, getSoundFile(settings.alertSound), settings.vibration);
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
    [settings.vibration, settings.alertSound],
  );

  // FIX: compute fresh remaining from endTime instead of stale
  // timersRef.current.remainingSeconds (could be up to 499ms old).
  const extendTimer = useCallback(
    (id, extraSeconds) => {
      cancelNativeAlarm(id); // stop any playing alarm sound
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
      scheduleTriggerNotification(id, timer.name, timer.note, newEndTime);
      scheduleNativeAlarm(id, newEndTime, getSoundFile(settings.alertSound), settings.vibration);
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
    [settings.vibration, settings.alertSound],
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
        cancelNativeAlarm(id);
        stopServiceNotification();
        setTimers(prev =>
          prev.map(t =>
            t.id === id ? {...t, isRunning: false, endTime: null} : t,
          ),
        );
      } else {
        // Resuming: schedule new alarm from current remaining
        const newEndTime = Date.now() + timer.remainingSeconds * 1000;
        scheduleTriggerNotification(id, timer.name, timer.note, newEndTime);
        scheduleNativeAlarm(id, newEndTime, getSoundFile(settings.alertSound), settings.vibration);
        setTimers(prev =>
          prev.map(t =>
            t.id === id ? {...t, isRunning: true, endTime: newEndTime} : t,
          ),
        );
      }
    },
    [settings.vibration, settings.alertSound],
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
