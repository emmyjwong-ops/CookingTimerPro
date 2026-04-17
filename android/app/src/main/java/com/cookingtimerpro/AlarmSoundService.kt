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
    // BUG 1 FIX: track which timer is currently playing so stop requests for
    // a *different* timer are ignored (prevents cancelling a concurrent alarm).
    private var activeTimerId: String? = null
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
        // BUG FIX: ALWAYS call startForeground first — before any when/return path.
        // Android enforces a 5-second contract: if startForegroundService() was called
        // to deliver this intent, we *must* call startForeground() before returning,
        // even for a spurious ACTION_STOP that arrives while the service isn't
        // actually playing. Failing this causes a ForegroundServiceDidNotStartInTimeException
        // / ANR on API 26+.
        startForegroundWithNotification()

        // BUG 14 FIX: when the OS restarts this START_STICKY service after killing it,
        // intent is null. We have no alarm to play — stop immediately.
        if (intent == null) {
            stopSelf()
            return START_NOT_STICKY
        }
        when (intent.action) {
            ACTION_PLAY -> {
                val timerId  = intent.getStringExtra("timerId")
                val soundFile = intent.getStringExtra("soundFile") ?: "bell"
                val vibrate   = intent.getBooleanExtra("vibrate", false)
                // BUG 1 FIX: record which timer triggered this alarm so that a
                // stop request for a *different* timer is ignored.
                activeTimerId = timerId
                // If already playing (e.g. two timers complete simultaneously), don't restart.
                if (player == null) {
                    playSound(soundFile)
                }
                if (vibrate) {
                    startVibration()
                }
            }
            ACTION_STOP -> {
                // BUG 1 FIX: only honour the stop if it targets the currently
                // playing timer (or is a broadcast stop with no specific ID).
                val requestedId = intent.getStringExtra("timerId")
                if (requestedId != null && requestedId != activeTimerId) {
                    // This stop is for a different timer — ignore it.
                    // We still satisfied the fg contract above; now release ourselves
                    // if nothing is actually playing so we don't leak a silent fg service.
                    if (player == null && activeTimerId == null) {
                        stopSelf()
                        return START_NOT_STICKY
                    }
                    return START_STICKY
                }
                stopAlarm()
                return START_NOT_STICKY
            }
            else -> {
                // Unknown / null action — release if nothing is playing.
                if (player == null && activeTimerId == null) {
                    stopSelf()
                    return START_NOT_STICKY
                }
            }
        }
        return START_STICKY
    }

    private fun startForegroundWithNotification() {
        val pendingFlags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        else
            PendingIntent.FLAG_UPDATE_CURRENT

        // ONE-TAP DISMISS:
        // Tapping the notification body OR the "Stop" action routes directly to
        // this service with ACTION_STOP, which synchronously stops playback and
        // removes the notification. No app launch, no extra dialog, no second tap.
        val stopIntent = Intent(this, AlarmSoundService::class.java).apply {
            action = ACTION_STOP
            putExtra("timerId", activeTimerId)
        }
        val stopPI = PendingIntent.getService(this, 1001, stopIntent, pendingFlags)

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Timer complete! ⏰")
            .setContentText("Tap to stop the alarm")
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
            .setContentIntent(stopPI)
            .addAction(android.R.drawable.ic_media_pause, "Stop alarm", stopPI)
            .setAutoCancel(true)
            .setOngoing(true)
            .setSilent(true) // Sound and vibration handled natively, not via notification
            .build()

        startForeground(NOTIFICATION_ID, notification)
    }

    private fun playSound(soundFile: String) {
        val ctx = applicationContext
        var resId = ctx.resources.getIdentifier(soundFile, "raw", ctx.packageName)
        if (resId == 0) resId = ctx.resources.getIdentifier("bell", "raw", ctx.packageName)
        if (resId == 0) return

        // BUG 8 FIX: create MediaPlayer *outside* the try block so we can
        // release it in the catch if setup fails — previously any exception
        // between `MediaPlayer()` and `player = mp` would leak the object.
        val mp = MediaPlayer()
        try {
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
                        when (change) {
                            AudioManager.AUDIOFOCUS_LOSS -> stopAlarm()
                            AudioManager.AUDIOFOCUS_LOSS_TRANSIENT,
                            AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK -> {
                                // Duck instead of stopping — a cooking alarm must stay
                                // audible through short interruptions (notifications).
                                try { player?.setVolume(0.3f, 0.3f) } catch (_: Exception) {}
                            }
                            AudioManager.AUDIOFOCUS_GAIN -> {
                                try {
                                    player?.setVolume(1.0f, 1.0f)
                                    if (player?.isPlaying == false) player?.start()
                                } catch (_: Exception) {}
                            }
                        }
                    }
                    .build()
                audioFocusRequest = focusReq
                val result = audioManager.requestAudioFocus(focusReq)
                if (result != AudioManager.AUDIOFOCUS_REQUEST_GRANTED) {
                    android.util.Log.w("AlarmSoundService", "Audio focus not granted; playing anyway")
                }
            } else {
                @Suppress("DEPRECATION")
                val result = audioManager.requestAudioFocus(
                    null, AudioManager.STREAM_ALARM,
                    AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK
                )
                if (result != AudioManager.AUDIOFOCUS_REQUEST_GRANTED) {
                    android.util.Log.w("AlarmSoundService", "Audio focus not granted; playing anyway")
                }
            }

            val afd = ctx.resources.openRawResourceFd(resId) ?: run { mp.release(); return }
            mp.setDataSource(afd.fileDescriptor, afd.startOffset, afd.length)
            afd.close()
            mp.isLooping = true
            mp.prepare()
            player = mp
            mp.start()
        } catch (_: Exception) {
            // BUG 8 FIX: release mp so the OS audio decoder is freed even on error.
            try { mp.release() } catch (_: Exception) {}
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
