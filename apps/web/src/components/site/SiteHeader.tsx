'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { chatKeys, queryKeys, sellerKeys, useApi, useUnreadMessages } from '@whyme/data';
import { isSupportedLanguage, languages } from '@whyme/i18n';
import { buttonClass } from '@/components/ui/button';
import { routes } from '@/lib/format';
import { setLanguage, useLanguage, useT } from '@/lib/i18n';
import { useAccount } from '@/lib/session';

export function SiteHeader() {
  const { t } = useT('market');
  const { t: tAuth } = useT('auth');
  const { t: tSeller } = useT('seller');
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
          <AccountArea signInLabel={tAuth('signIn')} sellLabel={t('sell')} sellerLabel={tSeller('centre')} signOutLabel={tAuth('signOut')} />
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

function AccountArea({
  signInLabel,
  sellLabel,
  sellerLabel,
  signOutLabel,
}: {
  signInLabel: string;
  sellLabel: string;
  sellerLabel: string;
  signOutLabel: string;
}) {
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
        <Link href={routes.signUp(routes.sell)} className={buttonClass('accent', 'hidden min-h-11 px-4 sm:inline-flex')}>
          {sellLabel}
        </Link>
      </>
    );
  }

  async function signOut() {
    await api.POST('/v1/auth/logout');
    // Leaving a private page (seller centre, messages): a full load of the home page drops
    // everything the account had in memory (and beats those pages' own sign-in redirect).
    if ([routes.sell, routes.messages].some((path) => window.location.pathname.startsWith(path))) {
      window.location.assign(routes.home);
      return;
    }
    queryClient.removeQueries({ queryKey: sellerKeys.all });
    queryClient.removeQueries({ queryKey: chatKeys.all });
    queryClient.setQueryData(queryKeys.me, null);
    await queryClient.invalidateQueries({ queryKey: queryKeys.me });
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <MessagesLink enabled={Boolean(user.phone_verified_at)} />
      <Link href={routes.sell} className={buttonClass('ghost', 'min-h-11 px-3 text-sm')}>
        {sellerLabel}
      </Link>
      <span className="hidden max-w-32 truncate text-sm font-medium text-text lg:inline">{user.first_name}</span>
      <button type="button" onClick={() => void signOut()} className={buttonClass('secondary', 'min-h-11 px-3 text-sm')}>
        {signOutLabel}
      </button>
    </div>
  );
}

/** Messages, with the unread count (checked every 30 seconds; chat needs a confirmed phone). */
function MessagesLink({ enabled }: { enabled: boolean }) {
  const { t } = useT('chat');
  const unread = useUnreadMessages(enabled).data ?? 0;

  return (
    <Link
      href={routes.messages}
      aria-label={unread > 0 ? t('messagesUnread', { count: unread }) : t('messages')}
      className={buttonClass('ghost', 'relative min-h-11 px-3 text-sm')}
    >
      <svg aria-hidden viewBox="0 0 24 24" className="size-5 fill-none stroke-current" strokeWidth={1.8} strokeLinejoin="round">
        <path d="M4 5h16v11H9l-5 4V5z" />
      </svg>
      <span className="hidden md:inline">{t('messages')}</span>
      {unread > 0 ? (
        <span className="absolute top-1 right-1 min-w-5 rounded-full bg-accent px-1.5 text-center text-xs font-bold text-text">
          {unread > 99 ? '99+' : unread}
        </span>
      ) : null}
    </Link>
  );
}
