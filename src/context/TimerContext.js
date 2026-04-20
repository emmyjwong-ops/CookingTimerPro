import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import {
  saveTimers,
  loadTimers,
  incrementCookStat,
  loadCookStats,
  removeCookStat,
  renameCookStat,
} from '../utils/storage';
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
    // ISSUE 16: load cookStats and timers in parallel, but wait for BOTH to
    // resolve before flipping `loaded` / updating state. Previously the two
    // promises raced — a fast-completing timer could call
    // incrementCookStat → loadCookStats → setCookStats before the initial
    // loadCookStats settled, and the stale initial result would overwrite
    // the freshly-incremented stats.
    Promise.all([loadCookStats(), loadTimers()])
      .then(([stats, saved]) => {
        setCookStats(stats);
        if (saved && saved.length > 0) {
          const now = Date.now();
          const restored = saved.map(t => {
            if (t.isRunning && !t.isComplete && t.endTime) {
              const remaining = Math.max(
                0,
                Math.floor((t.endTime - now) / 1000),
              );
              // BUG 11 FIX: if the timer expired while the app was closed the
              // AlarmManager intent already fired, but cancel the pending intent
              // anyway (guards against rare OS delays) and stop any sound that
              // was left playing in AlarmSoundService before the app reopened.
              if (remaining === 0) {
                cancelNativeAlarm(t.id);
              }
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
      })
      .catch(() => setLoaded(true));
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

      // ISSUE 17: record cook stats the moment a timer completes (rather
      // than only when the user taps Dismiss). We mark the timer with
      // `_cookStatRecorded = true` below so dismissTimer does not re-record.
      if (completing.length > 0) {
        Promise.all(
          completing.map(t => incrementCookStat(t.name, t.totalSeconds)),
        )
          .then(() => loadCookStats())
          .then(stats => setCookStats(stats))
          .catch(() => {});
      }

      setTimers(prev =>
        prev.map(t => {
          if (t.isRunning && !t.isComplete && t.endTime) {
            const remaining = Math.max(0, Math.floor((t.endTime - now) / 1000));
            const isComplete = remaining === 0;
            return {
              ...t,
              remainingSeconds: remaining,
              isRunning: remaining > 0,
              isComplete,
              // Mark so dismissTimer does not double-count this completion.
              _cookStatRecorded: isComplete ? true : t._cookStatRecorded,
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
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
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
    [settings.isPremium, settings.vibration, settings.alertSound],
  );

  const dismissTimer = useCallback(id => {
    // ISSUE 17: cook-stat recording now happens in the countdown tick the
    // moment a timer completes. To avoid double-counting we only record here
    // if the timer is complete AND the tick handler didn't already record it
    // (e.g. the timer was restored from storage already-complete, so no tick
    // ever flipped it). `_cookStatRecorded` is the single-source flag.
    const timer = timersRef.current.find(t => t.id === id);
    if (timer?.isComplete && !timer._cookStatRecorded) {
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
        // BUG 4 FIX: only stop the foreground service notification if no other
        // timer is still running — stopping it unconditionally killed the
        // notification for all concurrent active timers.
        const otherRunning = timersRef.current.filter(
          t => t.id !== id && t.isRunning && !t.isComplete,
        );
        if (otherRunning.length === 0) {
          stopServiceNotification();
        }
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

  // ── Most-cooked editing ────────────────────────────────────────────────
  const removeCookStatEntry = useCallback(async name => {
    await removeCookStat(name);
    const fresh = await loadCookStats();
    setCookStats(fresh);
  }, []);

  const renameCookStatEntry = useCallback(async (oldName, newName) => {
    await renameCookStat(oldName, newName);
    const fresh = await loadCookStats();
    setCookStats(fresh);
  }, []);

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
        removeCookStatEntry,
        renameCookStatEntry,
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
