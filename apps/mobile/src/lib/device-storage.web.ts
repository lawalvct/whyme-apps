/**
 * Web build of the mobile app (the browser preview used while developing): the
 * browser's localStorage. SQLite in the browser keeps its files locked to one tab,
 * so a preview that reloads could otherwise fail to read its settings.
 */
export const deviceStorage = {
  getItem(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem(key: string, value: string): void {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Blocked storage: the setting applies until the page reloads.
    }
  },
};
