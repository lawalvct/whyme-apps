'use client';

import { useEffect, type ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import { applySavedLanguage, i18n } from '@/lib/i18n';

export function I18nProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    applySavedLanguage();
  }, []);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
