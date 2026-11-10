'use client';

import { useEffect, useState } from 'react';
import { useLanguage, useT } from '@/lib/i18n';

/**
 * When this page came from the copy the service worker kept (no connection), the time it
 * was saved; otherwise null. A page fetched just now is also kept on its way in, so only a
 * copy clearly older than this page load counts. Soft navigations (no new document) don't.
 */
export function useKeptPageDate(): number | null {
  const [keptAt, setKeptAt] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
        if (!('caches' in window) || !navigation || navigation.name !== window.location.href) return;
        const kept = await caches.match(window.location.href);
        const date = Date.parse(kept?.headers.get('date') ?? '');
        if (!cancelled && Number.isFinite(date) && date < performance.timeOrigin - 60_000) setKeptAt(date);
      } catch {
        // No Cache API (private mode in some browsers): nothing to say.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return keptAt;
}

/** "Offline copy – last updated …" on a public page opened from the device (OFF02 freshness label). */
export function KeptPageNote({ className }: { className?: string }) {
  const { t } = useT('sync');
  const language = useLanguage();
  const keptAt = useKeptPageDate();
  if (!keptAt) return null;
  const time = new Intl.DateTimeFormat(language === 'ig' ? 'ig-NG' : 'en-NG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(keptAt));
  return (
    <p role="status" className={className ?? 'rounded-lg bg-accent-soft px-3 py-2 text-sm font-semibold text-accent-text'}>
      {t('offlineCopy', { time })}
    </p>
  );
}
