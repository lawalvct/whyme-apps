'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import type { PublicListing } from '@whyme/data';
import { cn } from '@/components/ui/cn';
import { MarketplaceIcon } from '@/components/ui/MarketplaceIcon';
import { routes } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { useSaved } from '@/lib/saved';

/**
 * Save a listing to look at later, also offline (AT05). Signed-out visitors are sent to
 * sign in and come back. One tap, one change: the button is locked while it's recorded.
 */
export function SaveButton({ listing, className }: { listing: PublicListing; className?: string }) {
  const { t } = useT('market');
  const { isSaved, toggle, signedIn } = useSaved();
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const saved = isSaved(listing.id);

  if (!signedIn) {
    return (
      <Link href={routes.signIn(routes.listing(listing))} className={cn('inline-flex min-h-11 items-center gap-2 text-sm font-semibold', className)}>
        <MarketplaceIcon name="heart" className="size-4" aria-hidden />
        {t('save')}
      </Link>
    );
  }

  async function onClick() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      await toggle(listing, !saved);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void onClick()}
      disabled={busy}
      aria-pressed={saved}
      className={cn('inline-flex min-h-11 items-center gap-2 text-sm font-semibold disabled:opacity-60', saved && 'text-primary', className)}
    >
      <MarketplaceIcon name="heart" className="size-4" aria-hidden fill={saved ? 'currentColor' : 'none'} />
      {t(saved ? 'saved' : 'save')}
    </button>
  );
}
