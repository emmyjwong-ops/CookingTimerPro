package com.cookingtimerpro

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * React Native native module that schedules and cancels native AlarmManager alarms
 * for the looping alarm sound. Completely independent of the JS thread at fire time.
 */
class AlarmSchedulerModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "AlarmSchedulerModule"

    companion object {
        const val ACTION_PLAY_ALARM = "com.cookingtimerpro.ACTION_PLAY_ALARM"
    }

    private fun buildPendingIntent(timerId: String, soundFile: String, vibrate: Boolean): PendingIntent {
        val intent = Intent(reactApplicationContext, AlarmSoundReceiver::class.java).apply {
            action = ACTION_PLAY_ALARM
            putExtra("timerId", timerId)
            putExtra("soundFile", soundFile)
            putExtra("vibrate", vibrate)
        }
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        else
            PendingIntent.FLAG_UPDATE_CURRENT
        // Use timerId.hashCode() as a stable, unique request code per timer.
        return PendingIntent.getBroadcast(
            reactApplicationContext, timerId.hashCode(), intent, flags
        )
    }

    /** Schedule an exact AlarmManager alarm that fires AlarmSoundReceiver at endTimeMs. */
    @ReactMethod
    fun scheduleAlarm(timerId: String, endTimeMs: Double, soundFile: String, vibrate: Boolean) {
        val am = reactApplicationContext
            .getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val pi = buildPendingIntent(timerId, soundFile, vibrate)
        val triggerMs = endTimeMs.toLong()
        // setExactAndAllowWhileIdle fires even in Doze mode (screen off, low-power).
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerMs, pi)
        } else {
            am.setExact(AlarmManager.RTC_WAKEUP, triggerMs, pi)
        }
    }

    /** Cancel a pending alarm and stop AlarmSoundService if it is currently playing. */
    @ReactMethod
    fun cancelAlarm(timerId: String) {
        // Cancel the pending AlarmManager broadcast.
        val am = reactApplicationContext
            .getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val cancelIntent = Intent(reactApplicationContext, AlarmSoundReceiver::class.java).apply {
            action = ACTION_PLAY_ALARM
        }
        val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
            PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
        else
            PendingIntent.FLAG_NO_CREATE
        PendingIntent.getBroadcast(
            reactApplicationContext, timerId.hashCode(), cancelIntent, flags
        )?.let { am.cancel(it) }

        // BUG 1 FIX: send a targeted ACTION_STOP intent carrying the timerId so
        // AlarmSoundService only stops if *this* timer is the one currently playing.
        // Previously we called stopService() which killed the service regardless of
        // which timer was playing — cancelling a concurrent alarm while another
        // timer's alarm was still sounding.
        val stopIntent = Intent(reactApplicationContext, AlarmSoundService::class.java).apply {
            action = AlarmSoundService.ACTION_STOP
            putExtra("timerId", timerId)
        }
        // BUG FIX: on Android 8+ startService() throws IllegalStateException if
        // the service is not currently running (or in background restrictions).
        // If the targeted stop fails, fall back to stopService() as a best-effort
        // cleanup — if the service is dead there's nothing playing anyway.
        try {
            reactApplicationContext.startService(stopIntent)
        } catch (e: IllegalStateException) {
            try {
                reactApplicationContext.stopService(
                    Intent(reactApplicationContext, AlarmSoundService::class.java)
                )
            } catch (_: Exception) {}
        } catch (_: Exception) {
            // Any other unexpected failure — best-effort cleanup.
            try {
                reactApplicationContext.stopService(
                    Intent(reactApplicationContext, AlarmSoundService::class.java)
                )
            } catch (_: Exception) {}
        }
    }
}
