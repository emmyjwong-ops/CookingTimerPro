import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import {NativeModules, NativeEventEmitter, Alert} from 'react-native';
import {useSettings} from './SettingsContext';

const {BillingModule} = NativeModules;
const billingEmitter = BillingModule ? new NativeEventEmitter(BillingModule) : null;

const PurchaseContext = createContext();

export function PurchaseProvider({children}) {
  const {settings, updateSetting} = useSettings();
  const [purchasing, setPurchasing] = useState(false);
  const [displayPrice, setDisplayPrice] = useState('$2.99');
  // Track whether the user explicitly tapped "Restore purchase" so we only
  // show "No purchase found" for intentional restore attempts, not for the
  // automatic billing:restored event that fires on every app launch.
  const userInitiatedRestore = useRef(false);
  const restoreTimeoutRef = useRef(null);
  // Ref to current settings so the billing effect doesn't need `settings` as a
  // dep (which would re-subscribe on every setting change and could flip the
  // dev premium toggle back to true on the next billing:restored event).
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // Connect to Google Play Billing on mount and listen for events
  useEffect(() => {
    if (!BillingModule) {
      return;
    }

    BillingModule.connect();

    const subs = [
      // Real price loaded from Play Store
      billingEmitter.addListener('billing:productLoaded', ({price}) => {
        setDisplayPrice(price);
      }),

      // Purchase completed successfully
      billingEmitter.addListener('billing:success', () => {
        setPurchasing(false);
        updateSetting('isPremium', true);
        Alert.alert(
          '🎉 Premium unlocked!',
          'You now have unlimited timers and all premium features.',
        );
      }),

      // Restore check finished — fires both on explicit restore AND automatically
      // on every app launch when BillingModule.connect() verifies ownership.
      // Only show the "no purchase" alert when the user explicitly tapped Restore.
      billingEmitter.addListener('billing:restored', ({owned}) => {
        if (owned) {
          // Only set isPremium=true if it isn't already — prevents clobbering
          // a developer/test toggle that was manually set, and avoids a
          // redundant state update.
          if (!settingsRef.current.isPremium) {
            updateSetting('isPremium', true);
          }
          if (userInitiatedRestore.current) {
            Alert.alert('✓ Restored', 'Premium has been restored successfully.');
          }
        } else if (userInitiatedRestore.current) {
          Alert.alert(
            'No purchase found',
            'We could not find a previous Premium purchase for this account.',
          );
        }
        userInitiatedRestore.current = false;
      }),

      // User cancelled — no message needed
      billingEmitter.addListener('billing:cancelled', () => {
        setPurchasing(false);
      }),

      // Something went wrong
      billingEmitter.addListener('billing:error', ({message}) => {
        setPurchasing(false);
        Alert.alert('Purchase failed', message || 'Please try again.');
      }),
    ];

    return () => subs.forEach(s => s.remove());
  }, [updateSetting]);

  const buyPremium = useCallback(async () => {
    if (settings.isPremium) {
      return;
    }
    if (!BillingModule) {
      Alert.alert('Not available', 'In-app purchases are not available on this device.');
      return;
    }
    setPurchasing(true);
    BillingModule.purchasePremium();
  }, [settings.isPremium]);

  const restorePurchases = useCallback(() => {
    if (!BillingModule) {
      return;
    }
    userInitiatedRestore.current = true;
    // FIX: clear any previous timeout before creating a new one — prevents
    // double-tap from spawning two parallel timeouts that both clear the flag.
    if (restoreTimeoutRef.current) {
      clearTimeout(restoreTimeoutRef.current);
    }
    // Safety timeout: if billing:restored fires late (connect still in progress),
    // reset the flag so it doesn't affect the next automatic restore check.
    restoreTimeoutRef.current = setTimeout(() => {
      userInitiatedRestore.current = false;
      restoreTimeoutRef.current = null;
    }, 15000);
    BillingModule.restorePurchases();
    Alert.alert('Restore', 'Checking your previous purchases…');
  }, []);

  return (
    <PurchaseContext.Provider
      value={{buyPremium, restorePurchases, purchasing, displayPrice}}>
      {children}
    </PurchaseContext.Provider>
  );
}

export function usePurchase() {
  const ctx = useContext(PurchaseContext);
  if (!ctx) {
    throw new Error('usePurchase must be used within PurchaseProvider');
  }
  return ctx;
}
