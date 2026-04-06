package com.cookingtimerpro

import android.view.WindowManager
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * Exposes FLAG_KEEP_SCREEN_ON to JS so the "Keep screen on" toggle in
 * SettingsScreen actually prevents the display from sleeping while timers run.
 */
class ScreenWakeModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "ScreenWakeModule"

    @ReactMethod
    fun enable() {
        val activity = reactContext.currentActivity ?: return
        activity.runOnUiThread {
            activity.window?.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        }
    }

    @ReactMethod
    fun disable() {
        val activity = reactContext.currentActivity ?: return
        activity.runOnUiThread {
            activity.window?.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        }
    }
}
