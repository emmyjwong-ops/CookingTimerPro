package com.cookingtimerpro

import android.media.AudioAttributes
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

    @ReactMethod
    fun playBell() {
        try {
            // Stop any currently playing alarm first
            stopPlayer()

            val context = reactContext.applicationContext
            val resId = context.resources.getIdentifier("bell", "raw", context.packageName)
            if (resId == 0) return

            val mp = MediaPlayer()

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                mp.setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                )
            } else {
                @Suppress("DEPRECATION")
                mp.setAudioStreamType(AudioManager.STREAM_ALARM)
            }

            val afd = context.resources.openRawResourceFd(resId) ?: run {
                mp.release()
                return
            }
            mp.setDataSource(afd.fileDescriptor, afd.startOffset, afd.length)
            afd.close()
            mp.isLooping = true   // Keep ringing until stopBell() is called
            mp.prepare()
            mp.start()

            player = mp
        } catch (_: Exception) {}
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
    }
}
