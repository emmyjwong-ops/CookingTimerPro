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
        private const val FALLBACK_CHANNEL_ID = "alarm_sound_service_channel"
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != AlarmSchedulerModule.ACTION_PLAY_ALARM) return

        val timerId   = intent.getStringExtra("timerId")  ?: return
        val soundFile = intent.getStringExtra("soundFile") ?: "bell"
        val vibrate   = intent.getBooleanExtra("vibrate", false)

        // Acquire a short wake lock to keep the CPU awake while the service starts.
        acquireBriefWakeLock(context)

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
        } catch (e: Exception) {
            // On Android 12+ (S), starting a foreground service from a
            // BroadcastReceiver can throw ForegroundServiceStartNotAllowedException
            // if the app is in certain restricted states. Fall back to a
            // full-screen-intent high-priority notification so the user still
            // gets notified that their timer is done.
            android.util.Log.w("AlarmSoundReceiver", "startForegroundService failed: ${e.message}")
            postFallbackNotification(context, timerId)
        }
    }

    private fun acquireBriefWakeLock(context: Context) {
        try {
            val pm = context.getSystemService(Context.POWER_SERVICE) as? PowerManager ?: return
            val wl = pm.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK,
                "CookingTimerPro:AlarmReceiverWakeLock"
            )
            wl.setReferenceCounted(false)
            wl.acquire(10_000L) // 10 seconds max, released automatically.
        } catch (_: Exception) {}
    }

    private fun postFallbackNotification(context: Context, timerId: String) {
        try {
            val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                // Reuse the same channel id as AlarmSoundService so the user's settings apply.
                val existing = nm.getNotificationChannel(FALLBACK_CHANNEL_ID)
                if (existing == null) {
                    val channel = NotificationChannel(
                        FALLBACK_CHANNEL_ID,
                        "Alarm Sound",
                        NotificationManager.IMPORTANCE_HIGH
                    )
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
