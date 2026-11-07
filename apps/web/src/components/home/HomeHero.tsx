'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { buttonClass } from '@/components/ui/button';
import { routes } from '@/lib/format';
import { useT } from '@/lib/i18n';

export function HomeHero() {
  const { t } = useT('market');
  const router = useRouter();
  const [query, setQuery] = useState('');

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    router.push(routes.search({ q: query.trim() || undefined }));
  }

  return (
    <section className="rounded-2xl bg-primary px-5 py-10 text-on-primary sm:px-10 sm:py-14">
      <h1 className="max-w-2xl text-3xl font-bold leading-tight sm:text-4xl">{t('heroTitle')}</h1>
      <p className="mt-3 max-w-2xl text-base text-primary-soft sm:text-lg">{t('heroBody')}</p>
      <form role="search" onSubmit={onSubmit} className="mt-6 flex max-w-2xl gap-2">
        <label htmlFor="hero-search" className="sr-only">
          {t('search')}
        </label>
        <input
          id="hero-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="min-h-12 w-full rounded-lg bg-background px-4 text-base text-text placeholder:text-text-muted focus:outline-2 focus:outline-accent"
        />
        <button type="submit" className={buttonClass('accent', 'shrink-0')}>
          {t('search')}
        </button>
      </form>
      <div className="mt-5 flex flex-wrap gap-2 text-sm">
        <Link href={routes.search({ type: 'people', kind: 'provider' })} className="rounded-full bg-primary-pressed px-4 py-2 font-medium hover:bg-background hover:text-primary">
          {t('findAService')}
        </Link>
        <Link href={routes.search({ kind: 'product' })} className="rounded-full bg-primary-pressed px-4 py-2 font-medium hover:bg-background hover:text-primary">
          {t('shopProducts')}
        </Link>
      </div>
    </section>
  );
}
