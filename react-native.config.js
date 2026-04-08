/**
 * react-native.config.js
 *
 * react-native-google-mobile-ads v16.x is missing `packageInstance` in its own
 * react-native.config.js, so React Native's autolinking never adds it to
 * PackageList.java and the module crashes at runtime with:
 *   "RNGoogleMobileAdsModule could not be found in the native binary"
 *
 * This project-level override provides the missing `packageInstance` so the
 * Gradle autolinking plugin correctly registers the package.
 */
module.exports = {
  dependencies: {
    'react-native-google-mobile-ads': {
      platforms: {
        android: {
          packageImportPath:
            'import io.invertase.googlemobileads.ReactNativeGoogleMobileAdsPackage;',
          packageInstance: 'new ReactNativeGoogleMobileAdsPackage()',
        },
      },
    },
  },
};
