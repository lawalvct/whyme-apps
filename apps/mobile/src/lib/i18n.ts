import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';
import Storage from 'expo-sqlite/kv-store';
import { defaultLanguage, i18nextOptions, isSupportedLanguage, type LanguageCode } from '@whyme/i18n';

const STORAGE_KEY = 'whyme.language';

// Read synchronously so the very first screen (Welcome, before login) is already
// in the chosen language. English until the user picks Igbo (I18N01, I18N02).
function savedLanguage(): LanguageCode {
  try {
    const value = Storage.getItemSync(STORAGE_KEY);
    return isSupportedLanguage(value) ? value : defaultLanguage;
  } catch {
    return defaultLanguage;
  }
}

export const i18n = createInstance();
void i18n.use(initReactI18next).init({ ...i18nextOptions, lng: savedLanguage() });

/** Saved on the device first, so it works offline; synced to the account when signed in. */
export async function setLanguage(code: LanguageCode): Promise<void> {
  Storage.setItemSync(STORAGE_KEY, code);
  await i18n.changeLanguage(code);
}
