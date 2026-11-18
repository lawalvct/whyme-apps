import Constants from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { deviceStorage } from './device-storage';

const DEVICE_KEY = 'whyme.device_id';

/**
 * This phone, as the API knows it (one sign-in per device, ACC03). The id is made once and kept
 * on the device, so signing in again replaces the old session instead of adding another.
 */
export function appDevice(): { id: string; platform: 'ios' | 'android' | 'web'; name: string; app_version: string } {
  let id = deviceStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = Crypto.randomUUID();
    deviceStorage.setItem(DEVICE_KEY, id);
  }
  const platform = Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web';
  const name = platform === 'web' ? 'WHY ME app preview' : (Device.modelName ?? (platform === 'ios' ? 'iPhone' : 'Android phone'));
  return { id, platform, name, app_version: Constants.expoConfig?.version ?? '0.0.0' };
}
