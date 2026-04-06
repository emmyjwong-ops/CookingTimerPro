package com.cookingtimerpro

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.MediaPlayer
import android.os.Build
import android.os.IBinder
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import androidx.core.app.NotificationCompat

/**
 * Foreground service that plays the looping alarm sound (and optionally vibrates)
 * when a timer expires. Started by AlarmSoundReceiver — runs entirely without JS.
 * Stopped by AlarmSchedulerModule.cancelAlarm() or when the app calls dismissTimer.
 *
 * Vibration is handled here natively (not via notification channel) to avoid the
 * Android channel-caching issue where channel vibration settings are locked after
 * first creation and cannot be changed.
 */
class AlarmSoundService : Service() {

    companion object {
        const val ACTION_PLAY = "com.cookingtimerpro.ALARM_PLAY"
        const val ACTION_STOP = "com.cookingtimerpro.ALARM_STOP"
        private const val NOTIFICATION_ID = 9001
        private const val CHANNEL_ID = "alarm_sound_service_channel"
        // Repeating pattern: 0ms delay, 500ms on, 300ms off — loops until cancelled.
        private val VIBRATION_PATTERN = longArrayOf(0, 500, 300)
    }

    private var player: MediaPlayer? = null
    private var audioFocusRequest: AudioFocusRequest? = null
    private val audioManager by lazy {
        getSystemService(Context.AUDIO_SERVICE) as AudioManager
    }
    private val vibrator: Vibrator? by lazy {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            (getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager)?.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_PLAY -> {
                val soundFile = intent.getStringExtra("soundFile") ?: "bell"
                val vibrate   = intent.getBooleanExtra("vibrate", false)
                // Must call startForeground before doing any heavy work (Android 8+ requirement).
                startForegroundWithNotification()
                // If already playing (e.g. two timers complete simultaneously), don't restart.
                if (player == null) {
                    playSound(soundFile)
                }
                if (vibrate) {
                    startVibration()
                }
            }
            ACTION_STOP -> {
                stopAlarm()
                return START_NOT_STICKY
            }
        }
        return START_STICKY
    }

    private fun startForegroundWithNotification() {
        val openIntent = packageManager.getLaunchIntentForPackage(packageName)
        val pendingFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        else
            PendingIntent.FLAG_UPDATE_CURRENT
        val pendingIntent = PendingIntent.getActivity(this, 0, openIntent, pendingFlags)

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Timer complete! ⏰")
            .setContentText("Tap to open CookingTimerPro")
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setSilent(true) // Sound and vibration handled natively, not via notification
            .build()

        startForeground(NOTIFICATION_ID, notification)
    }

    private fun playSound(soundFile: String) {
        try {
            val ctx = applicationContext
            var resId = ctx.resources.getIdentifier(soundFile, "raw", ctx.packageName)
            if (resId == 0) resId = ctx.resources.getIdentifier("bell", "raw", ctx.packageName)
            if (resId == 0) return

            val mp = MediaPlayer()
            val audioAttributes = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()
            mp.setAudioAttributes(audioAttributes)

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val focusReq = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
                    .setAudioAttributes(audioAttributes)
                    .setAcceptsDelayedFocusGain(false)
                    .setOnAudioFocusChangeListener { change ->
                        if (change == AudioManager.AUDIOFOCUS_LOSS ||
                            change == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT) {
                            stopAlarm()
                        }
                    }
                    .build()
                audioFocusRequest = focusReq
                audioManager.requestAudioFocus(focusReq)
            } else {
                @Suppress("DEPRECATION")
                audioManager.requestAudioFocus(
                    null, AudioManager.STREAM_ALARM,
                    AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK
                )
            }

            val afd = ctx.resources.openRawResourceFd(resId) ?: run { mp.release(); return }
            mp.setDataSource(afd.fileDescriptor, afd.startOffset, afd.length)
            afd.close()
            mp.isLooping = true
            mp.prepare()
            player = mp
            mp.start()
        } catch (_: Exception) {
            player = null
        }
    }

    private fun startVibration() {
        try {
            val v = vibrator ?: return
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                v.vibrate(
                    VibrationEffect.createWaveform(VIBRATION_PATTERN, /*repeat=*/0),
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                )
            } else {
                @Suppress("DEPRECATION")
                v.vibrate(VIBRATION_PATTERN, /*repeat=*/0)
            }
        } catch (_: Exception) {}
    }

    private fun stopAlarm() {
        try {
            player?.let { if (it.isPlaying) it.stop(); it.release() }
        } catch (_: Exception) {}
        player = null

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                audioFocusRequest?.let { audioManager.abandonAudioFocusRequest(it) }
            } else {
                @Suppress("DEPRECATION")
                audioManager.abandonAudioFocus(null)
            }
        } catch (_: Exception) {}
        audioFocusRequest = null

        try {
            vibrator?.cancel()
        } catch (_: Exception) {}

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE)
        } else {
            @Suppress("DEPRECATION")
            stopForeground(true)
        }
        stopSelf()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Alarm Sound",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                setSound(null, null)  // Sound via MediaPlayer
                enableVibration(false) // Vibration via Vibrator, not channel
            }
            (getSystemService(NotificationManager::class.java))
                .createNotificationChannel(channel)
        }
    }

    override fun onDestroy() {
        stopAlarm()
        super.onDestroy()
    }
}
