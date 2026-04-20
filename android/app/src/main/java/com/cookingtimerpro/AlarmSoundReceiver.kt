package com.cookingtimerpro

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.PowerManager
import androidx.core.app.NotificationCompat

/**
 * Receives the exact AlarmManager broadcast when a cooking timer expires.
 * Starts AlarmSoundService to play the looping alarm sound.
 * This runs entirely natively — no JS thread required.
 */
class AlarmSoundReceiver : BroadcastReceiver() {
    companion object {
        private const val FALLBACK_NOTIFICATION_ID = 9002
        // ISSUE 15 FIX: use a dedicated HIGH-importance channel for the fallback
        // notification. Previously the fallback reused the service channel id
        // (alarm_sound_service_channel, IMPORTANCE_LOW) which made the fallback
        // show silently in the shade — defeating its purpose when the service
        // failed to start. A fresh channel id is required because channel
        // importance is locked after first creation.
        private const val FALLBACK_CHANNEL_ID = "alarm_fallback_channel_v1"
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != AlarmSchedulerModule.ACTION_PLAY_ALARM) return

        val timerId   = intent.getStringExtra("timerId")  ?: return
        val soundFile = intent.getStringExtra("soundFile") ?: "bell"
        val vibrate   = intent.getBooleanExtra("vibrate", false)

        // ISSUE 4 FIX: hold a local WakeLock reference so it can be released
        // after the service handoff, rather than leaking a wake lock that
        // stays held until its 10-second safety timeout. The timeout is kept
        // as a last-resort safety net.
        val wakeLock = acquireBriefWakeLock(context)

        val serviceIntent = Intent(context, AlarmSoundService::class.java).apply {
            action = AlarmSoundService.ACTION_PLAY
            putExtra("timerId", timerId)
            putExtra("soundFile", soundFile)
            putExtra("vibrate", vibrate)
        }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent)
            } else {
                context.startService(serviceIntent)
            }
            // ISSUE 4 FIX: release the wake lock once the service has taken
            // over — the foreground service will hold the CPU itself.
            releaseWakeLock(wakeLock)
        } catch (e: Exception) {
            // On Android 12+ (S), starting a foreground service from a
            // BroadcastReceiver can throw ForegroundServiceStartNotAllowedException
            // if the app is in certain restricted states. Fall back to a
            // full-screen-intent high-priority notification so the user still
            // gets notified that their timer is done.
            android.util.Log.w("AlarmSoundReceiver", "startForegroundService failed: ${e.message}")
            postFallbackNotification(context, timerId)
            // ISSUE 4 FIX: release the wake lock after posting the fallback.
            releaseWakeLock(wakeLock)
        }
    }

    private fun acquireBriefWakeLock(context: Context): PowerManager.WakeLock? {
        return try {
            val pm = context.getSystemService(Context.POWER_SERVICE) as? PowerManager ?: return null
            val wl = pm.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK,
                "CookingTimerPro:AlarmReceiverWakeLock"
            )
            wl.setReferenceCounted(false)
            wl.acquire(10_000L) // 10-second safety net in case we never release.
            wl
        } catch (_: Exception) { null }
    }

    private fun releaseWakeLock(wl: PowerManager.WakeLock?) {
        try {
            if (wl != null && wl.isHeld) wl.release()
        } catch (_: Exception) {}
    }

    private fun postFallbackNotification(context: Context, timerId: String) {
        try {
            val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                // ISSUE 15 FIX: create a dedicated HIGH-importance channel so the
                // fallback notification actually pops as heads-up, vibrates,
                // and bypasses DND (it represents a timer-complete alarm).
                val existing = nm.getNotificationChannel(FALLBACK_CHANNEL_ID)
                if (existing == null) {
                    val channel = NotificationChannel(
                        FALLBACK_CHANNEL_ID,
                        "Timer alarm (fallback)",
                        NotificationManager.IMPORTANCE_HIGH
                    ).apply {
                        description = "Shown when the alarm sound service cannot be started."
                        enableVibration(true)
                        setBypassDnd(true)
                    }
                    nm.createNotificationChannel(channel)
                }
            }

            val openIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
            val pendingFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
            else
                PendingIntent.FLAG_UPDATE_CURRENT
            val pendingIntent = PendingIntent.getActivity(
                context, timerId.hashCode(), openIntent, pendingFlags
            )

            val notification = NotificationCompat.Builder(context, FALLBACK_CHANNEL_ID)
                .setContentTitle("Timer complete!")
                .setContentText("Tap to open CookingTimerPro")
                .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
                .setContentIntent(pendingIntent)
                .setFullScreenIntent(pendingIntent, true)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setAutoCancel(true)
                .build()

            nm.notify(FALLBACK_NOTIFICATION_ID + timerId.hashCode(), notification)
        } catch (_: Exception) {}
    }
}
