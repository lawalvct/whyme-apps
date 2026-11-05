// Shared UI catalogs for web and mobile (I18N01–I18N08, docs/03).
// English is the default for everyone; Igbo is opt-in from Settings.
// Missing Igbo keys fall back to English, never to a blank or the key name.

import enCommon from '../locales/en/common.json';
import enAuth from '../locales/en/auth.json';
import enSettings from '../locales/en/settings.json';
import enSync from '../locales/en/sync.json';
import enErrors from '../locales/en/errors.json';
import igCommon from '../locales/ig/common.json';
import igAuth from '../locales/ig/auth.json';
import igSettings from '../locales/ig/settings.json';
import igSync from '../locales/ig/sync.json';
import igErrors from '../locales/ig/errors.json';

export const defaultLanguage = 'en' as const;

// Native names are shown in the picker. `enabled` mirrors the API's `languages`
// table; the server list from GET /config wins when the app is online.
export const languages = [
  { code: 'en', name: 'English', nativeName: 'English', enabled: true },
  { code: 'ig', name: 'Igbo', nativeName: 'Igbo', enabled: true },
] as const;

export type LanguageCode = (typeof languages)[number]['code'];

export const namespaces = ['common', 'auth', 'settings', 'sync', 'errors'] as const;
export type Namespace = (typeof namespaces)[number];

export const resources = {
  en: { common: enCommon, auth: enAuth, settings: enSettings, sync: enSync, errors: enErrors },
  ig: { common: igCommon, auth: igAuth, settings: igSettings, sync: igSync, errors: igErrors },
} as const;

export function isSupportedLanguage(code: string | null | undefined): code is LanguageCode {
  return languages.some((l) => l.code === code && l.enabled);
}

// API errors carry a stable `code`; clients translate by code so errors from
// queued offline actions still show in the user's language (docs/01 §5.6).
export function errorKey(code: string): string {
  return `errors:${code}`;
}

// Shared i18next options so web and mobile behave the same.
export const i18nextOptions = {
  resources,
  lng: defaultLanguage,
  fallbackLng: defaultLanguage,
  ns: [...namespaces],
  defaultNS: 'common',
  interpolation: { escapeValue: false },
  returnEmptyString: false,
} as const;
