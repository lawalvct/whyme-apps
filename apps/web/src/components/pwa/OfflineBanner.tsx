'use client';

import { useSyncStatus } from '@whyme/data';
import { useT } from '@/lib/i18n';
import { useStoragePersisted } from '@/lib/offline';

/**
 * Says plainly when the site is working from this device's copy (OFF07), and warns when the
 * browser may delete work that hasn't been sent yet (private browsing, low storage; AT50).
 */
export function OfflineBanner() {
  const { t } = useT('sync');
  const online = useSyncStatus((state) => state.online);
  const unsent = useSyncStatus((state) => state.unsent);
  const persisted = useStoragePersisted();

  const atRisk = persisted === false && unsent > 0;
  if (online && !atRisk) return null;

  return (
    <div role="status" className="sticky top-0 z-40 bg-accent-soft px-4 py-2 text-center text-sm font-medium text-text">
      {online ? t('storageNotPersistent') : unsent > 0 ? t('offlineBannerUnsent', { count: unsent }) : t('offlineBanner')}
    </div>
  );
}
