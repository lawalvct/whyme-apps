'use client';

import Link from 'next/link';
import { useOfflineCopy } from '@whyme/data';
import { RequireAccount } from '@/components/auth/RequireAccount';
import { CardGrid } from '@/components/market/CardGrid';
import { ListingCard } from '@/components/market/ListingCard';
import { SaveButton } from '@/components/market/SaveButton';
import { Skeleton } from '@/components/ui/skeleton';
import { routes } from '@/lib/format';
import { useLanguage, useT } from '@/lib/i18n';
import { useSaved } from '@/lib/saved';

/** Saved items (AT05): readable offline from this browser's copy; taken-down listings drop out on the next sync. */
export function SavedView() {
  return (
    <RequireAccount>
      <SavedList />
    </RequireAccount>
  );
}

function SavedList() {
  const { t } = useT('market');
  const { t: tSync } = useT('sync');
  const language = useLanguage();
  const { saved } = useSaved();
  const copyAt = useOfflineCopy('saved', 'listings');

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">{t('savedTitle')}</h1>
        <p className="text-sm text-text-muted">{t('savedHint')}</p>
        {copyAt ? (
          <p role="status" className="text-sm font-semibold text-accent-text">
            {tSync('offlineCopy', { time: new Intl.DateTimeFormat(language === 'ig' ? 'ig-NG' : 'en-NG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(copyAt)) })}
          </p>
        ) : null}
      </header>

      {saved.isPending ? (
        <Skeleton className="h-48 w-full" />
      ) : saved.isError ? (
        <p role="alert" className="rounded-lg bg-surface p-4 text-danger">{t('savedLoadFailed')}</p>
      ) : saved.data.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center">
          <p className="font-semibold">{t('savedEmpty')}</p>
          <Link href={routes.search()} className="mt-2 inline-block text-sm font-semibold text-primary hover:underline">{t('savedBrowse')}</Link>
        </div>
      ) : (
        <CardGrid>
          {saved.data.map((listing) => (
            <div key={listing.id} className="flex flex-col gap-1">
              <ListingCard listing={listing} />
              <SaveButton listing={listing} className="self-start px-1" />
            </div>
          ))}
        </CardGrid>
      )}
    </div>
  );
}
