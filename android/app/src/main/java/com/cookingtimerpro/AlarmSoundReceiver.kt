package com.cookingtimerpro

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build

/**
 * Receives the exact AlarmManager broadcast when a cooking timer expires.
 * Starts AlarmSoundService to play the looping alarm sound.
 * This runs entirely natively — no JS thread required.
 */
class AlarmSoundReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != AlarmSchedulerModule.ACTION_PLAY_ALARM) return

        val timerId  = intent.getStringExtra("timerId")  ?: return
        val soundFile = intent.getStringExtra("soundFile") ?: "bell"

        val serviceIntent = Intent(context, AlarmSoundService::class.java).apply {
            action = AlarmSoundService.ACTION_PLAY
            putExtra("timerId", timerId)
            putExtra("soundFile", soundFile)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(serviceIntent)
        } else {
            context.startService(serviceIntent)
        }
    }
}
