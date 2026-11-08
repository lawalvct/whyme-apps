import Storage from 'expo-sqlite/kv-store';

/**
 * Small settings kept on the device (chosen language, a copy of /config), readable
 * synchronously at start-up. On phones: SQLite's key-value store.
 */
export const deviceStorage = {
  getItem(key: string): string | null {
    return Storage.getItemSync(key);
  },
  setItem(key: string, value: string): void {
    Storage.setItemSync(key, value);
  },
};
