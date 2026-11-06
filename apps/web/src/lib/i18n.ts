import { useSyncExternalStore } from 'react';
import { createInstance } from 'i18next';
import { initReactI18next, useTranslation } from 'react-i18next';
import { defaultLanguage, i18nextOptions, isSupportedLanguage, type LanguageCode, type Namespace } from '@whyme/i18n';

const STORAGE_KEY = 'whyme.language';

// English for everyone until the user picks Igbo in Settings (I18N01, I18N02).
export const i18n = createInstance();
void i18n.use(initReactI18next).init({ ...i18nextOptions, lng: defaultLanguage });

const listeners = new Set<() => void>();
let current: LanguageCode | null = null;

function readSaved(): LanguageCode {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return isSupportedLanguage(value) ? value : defaultLanguage;
  } catch {
    return defaultLanguage;
  }
}

function getSnapshot(): LanguageCode {
  return (current ??= readSaved());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * The chosen language. Server-rendered pages are always English; during hydration
 * React uses that same value, then re-renders in the saved language, so the
 * HTML never mismatches and public pages stay static for SEO.
 */
export function useLanguage(): LanguageCode {
  return useSyncExternalStore(subscribe, getSnapshot, () => defaultLanguage);
}

/** Use instead of `useTranslation`: renders in the hydration-safe language. */
export function useT(ns?: Namespace) {
  return useTranslation(ns, { lng: useLanguage() });
}

export async function setLanguage(code: LanguageCode): Promise<void> {
  try {
    window.localStorage.setItem(STORAGE_KEY, code);
  } catch {
    // Private mode or blocked storage: the change still applies for this visit.
  }
  current = code;
  document.documentElement.lang = code;
  // Keep the global instance in step for non-React code (e.g. Accept-Language on API calls).
  await i18n.changeLanguage(code);
  listeners.forEach((listener) => listener());
}

/** After hydration: align <html lang> and the global instance with the saved choice. */
export function applySavedLanguage(): void {
  const code = getSnapshot();
  document.documentElement.lang = code;
  if (i18n.language !== code) void i18n.changeLanguage(code);
}
