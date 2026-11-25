import * as WebBrowser from 'expo-web-browser';
import { AppState, Platform } from 'react-native';

/**
 * Opens Paystack's checkout page inside the app (a browser sheet, not the phone's browser) and
 * calls `onReturn` once when the person comes back, so the app can ask the API whether the payment
 * went through. On iPhone the sheet's close is the signal; on Android (a Chrome custom tab) and
 * in the web preview the call returns at once, so the app coming back to the front is the signal.
 */
export async function openPayment(url: string, onReturn: () => void): Promise<void> {
  let done = false;
  let away = false;
  const subscription = AppState.addEventListener('change', (state) => {
    if (state !== 'active') away = true;
    else if (away) finish();
  });
  const stop = setTimeout(() => {
    // Nobody came back within 30 minutes: stop listening; the order screen can still check.
    done = true;
    subscription.remove();
  }, 30 * 60_000);

  function finish() {
    if (done) return;
    done = true;
    clearTimeout(stop);
    subscription.remove();
    onReturn();
  }

  const result = await WebBrowser.openBrowserAsync(url);
  if (Platform.OS === 'ios' || result.type === 'cancel' || result.type === 'dismiss') finish();
}
