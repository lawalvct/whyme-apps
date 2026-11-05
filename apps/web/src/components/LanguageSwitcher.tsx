'use client';

import { languages, type LanguageCode } from '@whyme/i18n';
import { setLanguage, useLanguage, useT } from '@/lib/i18n';

/** Settings → Language. Shows each language by its own name (docs/03 §3). */
export function LanguageSwitcher() {
  const { t } = useT('settings');
  const language = useLanguage();

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium text-text">{t('language')}</legend>
      <div className="flex gap-2">
        {languages
          .filter((l) => l.enabled)
          .map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => void setLanguage(l.code as LanguageCode)}
              aria-pressed={language === l.code}
              className="min-h-12 rounded-lg border border-border px-4 text-base aria-pressed:border-primary aria-pressed:bg-primary-soft aria-pressed:text-primary-pressed"
            >
              {l.nativeName}
            </button>
          ))}
      </div>
    </fieldset>
  );
}
