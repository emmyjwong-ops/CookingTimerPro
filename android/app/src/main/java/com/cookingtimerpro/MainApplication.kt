package com.cookingtimerpro

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import io.invertase.googlemobileads.ReactNativeGoogleMobileAdsPackage

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          add(SoundPackage())
          add(BillingPackage())
          add(PermissionsPackage())
          add(AlarmSchedulerPackage())
          add(ScreenWakePackage())
          // AdMob: registered manually — autolinking skips this library
          // because its codegen CMakeLists.txt does not exist until after build.
          add(ReactNativeGoogleMobileAdsPackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
  }
}
