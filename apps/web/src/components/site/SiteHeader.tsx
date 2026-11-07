'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys, useApi } from '@whyme/data';
import { isSupportedLanguage, languages } from '@whyme/i18n';
import { buttonClass } from '@/components/ui/button';
import { routes } from '@/lib/format';
import { setLanguage, useLanguage, useT } from '@/lib/i18n';
import { useAccount } from '@/lib/session';

export function SiteHeader() {
  const { t } = useT('market');
  const { t: tAuth } = useT('auth');
  const router = useRouter();
  const [query, setQuery] = useState('');

  function onSearch(event: FormEvent) {
    event.preventDefault();
    router.push(routes.search({ q: query.trim() || undefined }));
  }

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <Link href={routes.home} className="shrink-0" aria-label="WHY ME">
          <Image src="/brand/whyme-logo-full.png" alt="WHY ME" width={136} height={32} priority />
        </Link>

        <form role="search" onSubmit={onSearch} className="order-last flex w-full gap-2 md:order-none md:w-auto md:flex-1">
          <label htmlFor="site-search" className="sr-only">
            {t('search')}
          </label>
          <input
            id="site-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="min-h-11 w-full rounded-lg border border-border bg-surface px-3 text-base focus:border-primary focus:bg-background focus:outline-2 focus:outline-primary-soft"
          />
          <button type="submit" className={buttonClass('primary', 'min-h-11 px-4')}>
            {t('search')}
          </button>
        </form>

        <div className="ml-auto flex items-center gap-2">
          <LanguageToggle />
          <AccountArea signInLabel={tAuth('signIn')} sellLabel={t('sell')} signOutLabel={tAuth('signOut')} />
        </div>
      </div>
    </header>
  );
}

function LanguageToggle() {
  const { t } = useT('market');
  const language = useLanguage();
  return (
    <div role="group" aria-label={t('language')} className="flex rounded-lg border border-border p-0.5">
      {languages
        .filter((l) => l.enabled)
        .map((l) => (
          <button
            key={l.code}
            type="button"
            lang={l.code}
            aria-pressed={language === l.code}
            onClick={() => isSupportedLanguage(l.code) && void setLanguage(l.code)}
            className="min-h-9 rounded-md px-2.5 text-sm font-medium text-text-muted aria-pressed:bg-primary-soft aria-pressed:text-primary-pressed"
          >
            {l.nativeName}
          </button>
        ))}
    </div>
  );
}

function AccountArea({ signInLabel, sellLabel, signOutLabel }: { signInLabel: string; sellLabel: string; signOutLabel: string }) {
  const { user, status } = useAccount();
  const api = useApi();
  const queryClient = useQueryClient();
  const router = useRouter();

  if (status === 'unknown') return <span className="inline-block h-11 w-24" aria-hidden />;

  if (!user) {
    return (
      <>
        <Link href={routes.signIn()} className={buttonClass('ghost', 'min-h-11 px-3')}>
          {signInLabel}
        </Link>
        <Link href={routes.signUp()} className={buttonClass('accent', 'hidden min-h-11 px-4 sm:inline-flex')}>
          {sellLabel}
        </Link>
      </>
    );
  }

  async function signOut() {
    await api.POST('/v1/auth/logout');
    queryClient.setQueryData(queryKeys.me, null);
    await queryClient.invalidateQueries({ queryKey: queryKeys.me });
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <span className="hidden max-w-40 truncate text-sm font-medium text-text sm:inline">{user.name}</span>
      <button type="button" onClick={() => void signOut()} className={buttonClass('secondary', 'min-h-11 px-3 text-sm')}>
        {signOutLabel}
      </button>
    </div>
  );
}
