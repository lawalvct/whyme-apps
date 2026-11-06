'use client';

import { isSupportedLanguage, languages as bundledLanguages } from '@whyme/i18n';
import { useConfig } from '@whyme/data';
import { setLanguage, useLanguage, useT } from '@/lib/i18n';

/**
 * Settings → Language. Shows each language by its own name (docs/03 §3). The
 * server's list from /config wins when online; the bundled list covers offline.
 */
export function LanguageSwitcher() {
  const { t } = useT('settings');
  const language = useLanguage();
  const { data: config } = useConfig();

  const options = (config?.languages ?? bundledLanguages.filter((l) => l.enabled).map((l) => ({
    code: l.code,
    native_name: l.nativeName,
  }))).filter((l) => isSupportedLanguage(l.code));

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium text-text">{t('language')}</legend>
      <div className="flex gap-2">
        {options.map((l) => (
          <button
            key={l.code}
            type="button"
            onClick={() => isSupportedLanguage(l.code) && void setLanguage(l.code)}
            aria-pressed={language === l.code}
            className="min-h-12 rounded-lg border border-border px-4 text-base aria-pressed:border-primary aria-pressed:bg-primary-soft aria-pressed:text-primary-pressed"
          >
            {l.native_name}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
