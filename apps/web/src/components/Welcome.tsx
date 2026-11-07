'use client';

import Image from 'next/image';
import { useT } from '@/lib/i18n';
import { LanguageSwitcher } from './LanguageSwitcher';
import { SyncStatusChip } from './SyncStatusChip';

/** Phase 0 placeholder home: proves tokens, translations, server data and sync status. */
export function Welcome() {
  const { t } = useT();

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-4 py-16">
      <header className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Image src="/brand/whyme-logo-full.png" alt={t('appName')} width={170} height={40} priority />
          <SyncStatusChip />
        </div>
        <h1 className="text-3xl font-bold text-text">{t('welcome')}</h1>
        <p className="text-text-muted">{t('tagline')}</p>
      </header>
      <LanguageSwitcher />
      <p className="rounded-lg bg-surface p-3 text-sm text-text-muted">{t('sync:savedOffline')}</p>
    </main>
  );
}
