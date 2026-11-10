'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useT } from '@/lib/i18n';

/** On by default in production builds; in development only with NEXT_PUBLIC_ENABLE_SW=1 (stale code otherwise). */
const ENABLED = process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_ENABLE_SW === '1';

/**
 * Registers the service worker (public/sw.js) and offers "New version – Refresh" when one
 * is waiting. It never reloads by itself, so nobody loses a half-written draft (docs/01 §6.6).
 */
export function ServiceWorkerSetup() {
  const { t } = useT('sync');
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const refreshing = useRef(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    if (!ENABLED) {
      // Development: remove one left over from a production run on this address.
      void navigator.serviceWorker.getRegistrations().then((registrations) => registrations.forEach((r) => void r.unregister()));
      return;
    }

    const onControllerChange = () => {
      if (!refreshing.current) return;
      refreshing.current = false;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    let timer: number | undefined;
    void navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then((registration) => {
        const watch = (worker: ServiceWorker | null) => {
          worker?.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) setWaiting(worker);
          });
        };
        if (registration.waiting && navigator.serviceWorker.controller) setWaiting(registration.waiting);
        registration.addEventListener('updatefound', () => watch(registration.installing));
        // Look for a new version every hour while the site is open.
        timer = window.setInterval(() => void registration.update().catch(() => undefined), 60 * 60_000);
      })
      .catch(() => undefined);

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      window.clearInterval(timer);
    };
  }, []);

  if (!waiting) return null;

  return (
    <div role="status" className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md items-center justify-between gap-3 rounded-2xl border border-border bg-background p-4 shadow-lg">
      <p className="text-sm font-medium">{t('updateAvailable')}</p>
      <Button
        onClick={() => {
          refreshing.current = true;
          waiting.postMessage({ type: 'SKIP_WAITING' });
        }}
        className="shrink-0"
      >
        {t('updateRefresh')}
      </Button>
    </div>
  );
}
