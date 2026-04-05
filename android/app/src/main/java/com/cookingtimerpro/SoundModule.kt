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

    @ReactMethod
    fun playBell() {
        try {
            stopPlayer()

            val context = reactContext.applicationContext
            val resId = context.resources.getIdentifier("bell", "raw", context.packageName)
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

            // Request audio focus so we behave correctly during phone calls
            // and other audio interruptions (API 26+)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val focusRequest = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
                    .setAudioAttributes(audioAttributes)
                    .setAcceptsDelayedFocusGain(false)
                    .setOnAudioFocusChangeListener { focusChange ->
                        when (focusChange) {
                            AudioManager.AUDIOFOCUS_LOSS,
                            AudioManager.AUDIOFOCUS_LOSS_TRANSIENT -> stopPlayer()
                            // DUCK and regain: keep playing at current volume
                        }
                    }
                    .build()
                audioFocusRequest = focusRequest
                audioManager.requestAudioFocus(focusRequest)
            } else {
                @Suppress("DEPRECATION")
                audioManager.requestAudioFocus(null, AudioManager.STREAM_ALARM, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
            }

            val afd = context.resources.openRawResourceFd(resId) ?: run {
                mp.release()
                return
            }
            mp.setDataSource(afd.fileDescriptor, afd.startOffset, afd.length)
            afd.close()
            mp.isLooping = true
            mp.prepare()

            // Assign before start() so stopBell() can always reach it
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

        // Release audio focus when done
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
