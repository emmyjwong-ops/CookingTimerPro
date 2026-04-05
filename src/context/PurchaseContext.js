import React, {
  createContext,
  useContext,
  useState,
  useEffect,
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

      // Restore check finished
      billingEmitter.addListener('billing:restored', ({owned}) => {
        if (owned) {
          updateSetting('isPremium', true);
        }
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
