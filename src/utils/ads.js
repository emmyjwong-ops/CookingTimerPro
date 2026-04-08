import mobileAds, {
  AdsConsent,
  AdsConsentStatus,
} from 'react-native-google-mobile-ads';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CONSENT_KEY = 'ads_consent_obtained_v1';

let initialized = false;
let consentObtained = false;

export function hasAdsConsent() {
  return consentObtained;
}

/**
 * Loads saved consent flag (from a previous session) so AdBanner can render
 * with the correct requestNonPersonalizedAdsOnly value immediately on mount.
 */
export async function loadSavedConsentFlag() {
  try {
    const stored = await AsyncStorage.getItem(CONSENT_KEY);
    if (stored === '1') {
      consentObtained = true;
    }
  } catch (_) {}
  return consentObtained;
}

/**
 * Request a UMP consent info update, show the consent form if required,
 * then initialize the Mobile Ads SDK. Safe to call multiple times — will
 * only initialize the SDK once.
 */
export async function initializeAdsWithConsent() {
  if (initialized) {
    return;
  }
  try {
    const consentInfo = await AdsConsent.requestInfoUpdate();
    if (consentInfo?.status === AdsConsentStatus.REQUIRED) {
      try {
        await AdsConsent.loadAndShowConsentFormIfRequired();
      } catch (_) {}
    }
    // After the form (if shown) resolves, treat consent as obtained so the
    // BannerAd can drop requestNonPersonalizedAdsOnly.
    consentObtained = true;
    try {
      await AsyncStorage.setItem(CONSENT_KEY, '1');
    } catch (_) {}
  } catch (_) {
    // If UMP fails entirely (e.g. network error), keep consentObtained=false
    // so we fall back to non-personalized ads.
  }

  try {
    await mobileAds().initialize();
    initialized = true;
  } catch (_) {
    // Silently ignore if ads unavailable on this device.
  }
}
