package com.cookingtimerpro

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.MediaPlayer
import android.os.Build
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class SoundModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "SoundModule"

    private var player: MediaPlayer? = null
    private var audioFocusRequest: AudioFocusRequest? = null
    private val audioManager by lazy {
        reactContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    }

    // Play a sound file from res/raw by name (without extension), looping until stopBell() is called.
    // Falls back to "bell" if the requested file is not found.
    @ReactMethod
    fun playBell(soundFile: String = "bell") {
        try {
            stopPlayer()

            val context = reactContext.applicationContext
            var resId = context.resources.getIdentifier(soundFile, "raw", context.packageName)
            if (resId == 0) {
                // Fallback to bell if requested sound not found
                resId = context.resources.getIdentifier("bell", "raw", context.packageName)
            }
            if (resId == 0) return

            val mp = MediaPlayer()

            val audioAttributes = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                mp.setAudioAttributes(audioAttributes)
            } else {
                @Suppress("DEPRECATION")
                mp.setAudioStreamType(AudioManager.STREAM_ALARM)
            }

            // Request audio focus — stops playing gracefully during phone calls
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val focusRequest = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
                    .setAudioAttributes(audioAttributes)
                    .setAcceptsDelayedFocusGain(false)
                    .setOnAudioFocusChangeListener { focusChange ->
                        when (focusChange) {
                            AudioManager.AUDIOFOCUS_LOSS -> stopPlayer()
                            AudioManager.AUDIOFOCUS_LOSS_TRANSIENT,
                            AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK -> {
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
                audioFocusRequest = focusRequest
                val result = audioManager.requestAudioFocus(focusRequest)
                if (result != AudioManager.AUDIOFOCUS_REQUEST_GRANTED) {
                    android.util.Log.w("SoundModule", "Audio focus not granted; playing anyway")
                }
            } else {
                @Suppress("DEPRECATION")
                val result = audioManager.requestAudioFocus(null, AudioManager.STREAM_ALARM, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
                if (result != AudioManager.AUDIOFOCUS_REQUEST_GRANTED) {
                    android.util.Log.w("SoundModule", "Audio focus not granted; playing anyway")
                }
            }

            val afd = context.resources.openRawResourceFd(resId) ?: run {
                mp.release()
                return
            }
            mp.setDataSource(afd.fileDescriptor, afd.startOffset, afd.length)
            afd.close()
            mp.isLooping = true
            mp.prepare()
            player = mp
            mp.start()
        } catch (e: Exception) {
            player = null
        }
    }

    @ReactMethod
    fun stopBell() {
        stopPlayer()
    }

    private fun stopPlayer() {
        try {
            player?.let {
                if (it.isPlaying) it.stop()
                it.release()
            }
        } catch (_: Exception) {}
        player = null

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                audioFocusRequest?.let { audioManager.abandonAudioFocusRequest(it) }
                audioFocusRequest = null
            } else {
                @Suppress("DEPRECATION")
                audioManager.abandonAudioFocus(null)
            }
        } catch (_: Exception) {}
    }
}
