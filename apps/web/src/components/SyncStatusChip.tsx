'use client';

import { globalSyncStatus, useSyncStatus, type GlobalSyncStatus } from '@whyme/data';
import { useT } from '@/lib/i18n';

const STYLES: Record<GlobalSyncStatus, string> = {
  online: 'bg-primary-soft text-primary-pressed',
  syncing: 'bg-accent-soft text-text',
  offline: 'bg-surface text-text-muted',
  failed: 'bg-danger/10 text-danger',
};

/** Global Online / Offline / Syncing / Sync failed indicator (OFF07). */
export function SyncStatusChip() {
  const { t } = useT('sync');
  const status = useSyncStatus(globalSyncStatus);

  return (
    <span role="status" className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${STYLES[status]}`}>
      {t(`global.${status}`)}
    </span>
  );
}
