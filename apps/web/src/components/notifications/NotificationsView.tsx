'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  markAllNotificationsRead,
  markNotificationRead,
  notificationKeys,
  saveNotificationPreferences,
  useApi,
  useNotificationPreferences,
  useNotifications,
  useOfflineCopy,
  type AppNotification,
  type NotificationPreferences,
  type NotificationPreferencesPatch,
} from '@whyme/data';
import { RequireAccount } from '@/components/auth/RequireAccount';
import { Button } from '@/components/ui/button';
import { cn } from '@/components/ui/cn';
import { Skeleton } from '@/components/ui/skeleton';
import { MarketplaceIcon as Icon } from '@/components/ui/MarketplaceIcon';
import { useLanguage, useT } from '@/lib/i18n';

/**
 * The in-app notifications (NOT01, NOT02): newest first, unread ones marked; opening one marks
 * it read and goes to the order, request or listing it's about. The first page opens offline.
 * Below: the optional categories a person can turn off (money notices are always on).
 */
export function NotificationsView() {
  return (
    <RequireAccount>
      <Inbox />
    </RequireAccount>
  );
}

function Inbox() {
  const { t } = useT('notifications');
  const { t: tSync } = useT('sync');
  const language = useLanguage();
  const api = useApi();
  const queryClient = useQueryClient();
  const list = useNotifications();
  const copyAt = useOfflineCopy('notifications', 'first');
  const [marking, setMarking] = useState(false);
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  const unread = items.some((n) => !n.read_at);
  const format = new Intl.DateTimeFormat(language === 'ig' ? 'ig-NG' : 'en-NG', { dateStyle: 'medium', timeStyle: 'short' });

  async function markAll() {
    if (marking) return;
    setMarking(true);
    try {
      await markAllNotificationsRead(api);
      await queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    } catch {
      // Offline: they stay unread until the next try.
    } finally {
      setMarking(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="mt-1 text-sm text-text-muted">{t('intro')}</p>
          {copyAt ? (
            <p role="status" className="mt-1 text-sm font-semibold text-accent-text">
              {tSync('offlineCopy', { time: format.format(new Date(copyAt)) })}
            </p>
          ) : null}
        </div>
        {unread ? (
          <Button variant="secondary" className="min-h-11 px-3 text-sm" disabled={marking} onClick={() => void markAll()}>
            {marking ? t('common:loading') : t('markAll')}
          </Button>
        ) : null}
      </div>

      {list.isPending ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : list.isError ? (
        <div className="flex flex-col items-start gap-2 rounded-lg bg-surface p-3">
          <p role="alert" className="text-sm text-danger">
            {t('loadFailed')}
          </p>
          <Button variant="secondary" disabled={list.isFetching} onClick={() => void list.refetch()}>
            {t('common:retry')}
          </Button>
        </div>
      ) : items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-text-muted">{t('empty')}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border">
          {items.map((n) => (
            <NotificationRow key={n.id} notification={n} when={n.created_at ? format.format(new Date(n.created_at)) : ''} />
          ))}
        </ul>
      )}

      {list.hasNextPage ? (
        <Button variant="secondary" className="self-center" disabled={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>
          {list.isFetchingNextPage ? t('common:loading') : t('loadMore')}
        </Button>
      ) : null}

      <Preferences />
    </div>
  );
}

function NotificationRow({ notification, when }: { notification: AppNotification; when: string }) {
  const { t } = useT('notifications');
  const api = useApi();
  const router = useRouter();
  const queryClient = useQueryClient();
  const unread = !notification.read_at;

  function open() {
    if (unread) {
      // Marked read in the background: going to the order shouldn't wait for it.
      void markNotificationRead(api, notification.id)
        .then(() => queryClient.invalidateQueries({ queryKey: notificationKeys.all }))
        .catch(() => undefined);
    }
    if (notification.link) router.push(notification.link);
  }

  return (
    <li>
      <button
        type="button"
        onClick={open}
        className={cn(
          'flex min-h-20 w-full items-start gap-3 p-3 text-left hover:bg-surface focus-visible:outline-2 focus-visible:outline-primary',
          unread ? 'bg-primary-soft/40' : '',
        )}
      >
        <span className={cn('mt-1 flex size-9 shrink-0 items-center justify-center rounded-full', unread ? 'bg-primary text-on-primary' : 'bg-surface text-text-muted')}>
          <Icon name="bell" className="size-4" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className={cn('text-sm', unread ? 'font-bold text-text' : 'font-semibold text-text')}>{notification.title}</span>
          <span className="text-sm text-text-muted">{notification.body}</span>
          <span className="text-xs text-text-muted">
            {when}
            {unread ? <span className="ml-2 font-semibold text-primary">· {t('unread')}</span> : null}
          </span>
        </span>
      </button>
    </li>
  );
}

const OPTIONAL = ['requests', 'jobs', 'listings', 'plans'] as const;

/** The optional categories (NOT02). Each switch saves at once; money notices aren't listed: always on. */
function Preferences() {
  const { t } = useT('notifications');
  const api = useApi();
  const queryClient = useQueryClient();
  const preferences = useNotificationPreferences();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function toggle(key: keyof NotificationPreferencesPatch, value: boolean) {
    if (busy) return;
    setBusy(key);
    setMessage(null);
    try {
      const saved = await saveNotificationPreferences(api, { [key]: value });
      queryClient.setQueryData<NotificationPreferences>(notificationKeys.preferences, saved);
      setMessage({ ok: true, text: t('settings.saved') });
    } catch {
      setMessage({ ok: false, text: t('settings.saveFailed') });
    } finally {
      setBusy(null);
    }
  }

  if (!preferences.data) return preferences.isPending ? <Skeleton className="h-48 w-full" /> : null;
  const data = preferences.data;

  return (
    <section aria-labelledby="notification-settings" className="flex flex-col gap-2 rounded-2xl border border-border p-4">
      <h2 id="notification-settings" className="text-lg font-bold">
        {t('settings.title')}
      </h2>
      <p className="text-sm text-text-muted">{t('settings.hint')}</p>
      {OPTIONAL.map((key) => (
        <Switch key={key} label={t(`settings.${key}`)} checked={data[key]} disabled={busy !== null} onChange={(v) => void toggle(key, v)} />
      ))}
      {data.sms_available ? (
        <Switch label={t('settings.sms')} checked={data.sms} disabled={busy !== null} onChange={(v) => void toggle('sms', v)} />
      ) : (
        <p className="text-sm text-text-muted">{t('settings.smsOff')}</p>
      )}
      {message ? (
        <p role={message.ok ? 'status' : 'alert'} className={cn('text-sm', message.ok ? 'text-primary' : 'text-danger')}>
          {message.text}
        </p>
      ) : null}
    </section>
  );
}

function Switch({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex min-h-11 items-center justify-between gap-3 rounded-lg px-1">
      <span className="text-sm">{label}</span>
      <input type="checkbox" role="switch" aria-label={label} className="size-5 shrink-0 accent-primary" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}
