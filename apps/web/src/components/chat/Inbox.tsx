'use client';

import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { chatKeys, unwrap, useApi, useOfflineCopy, useOfflineFetcher, type Conversation } from '@whyme/data';
import { cn } from '@/components/ui/cn';
import { Skeleton } from '@/components/ui/skeleton';
import { routes } from '@/lib/format';
import { useLanguage, useT } from '@/lib/i18n';
import { useRealtimeConnected, useUserEvents } from '@/lib/realtime';
import { useAccount } from '@/lib/session';
import { chatTime } from './time';

/**
 * The inbox (COM*): newest conversation first, unread ones in bold with a count.
 * Checked every 15 seconds while open; Pusher makes it live once configured.
 */
export function Inbox() {
  const { t } = useT('chat');
  const api = useApi();
  const queryClient = useQueryClient();
  const { user } = useAccount();
  const live = useRealtimeConnected();
  useUserEvents(user?.id, {
    'message.delivered': () => {
      void queryClient.invalidateQueries({ queryKey: chatKeys.inbox });
      void queryClient.invalidateQueries({ queryKey: chatKeys.unread });
    },
    'conversation.updated': () => void queryClient.invalidateQueries({ queryKey: chatKeys.inbox }),
  });

  // Kept on the device, so the inbox opens offline.
  const fetchInbox = useOfflineFetcher('inbox', 'all', async () => unwrap(await api.GET('/v1/me/conversations')).data as unknown as Conversation[]);
  const copyAt = useOfflineCopy('inbox', 'all');
  const language = useLanguage();
  const { t: tSync } = useT('sync');
  const inbox = useQuery({
    queryKey: chatKeys.inbox,
    queryFn: fetchInbox,
    // Live updates refresh it at once; the slow check is only a safety net.
    refetchInterval: live ? 120_000 : 15_000,
  });

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">{t('inboxTitle')}</h1>
        <p className="mt-1 text-sm text-text-muted">{t('inboxIntro')}</p>
        {copyAt ? (
          <p role="status" className="mt-1 text-sm font-semibold text-accent-text">
            {tSync('offlineCopy', {
              time: new Intl.DateTimeFormat(language === 'ig' ? 'ig-NG' : 'en-NG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(copyAt)),
            })}
          </p>
        ) : null}
      </div>

      {inbox.isPending ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : inbox.isError ? (
        <p role="alert" className="rounded-lg bg-surface p-3 text-sm text-danger">
          {t('loadFailed')}
        </p>
      ) : inbox.data.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-text-muted">{t('empty')}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border">
          {inbox.data.map((conversation) => (
            <InboxRow key={conversation.id} conversation={conversation} />
          ))}
        </ul>
      )}
    </div>
  );
}

function InboxRow({ conversation }: { conversation: Conversation }) {
  const { t } = useT('chat');
  const language = useLanguage();
  const unread = conversation.unread_count > 0;
  const last = conversation.last_message;

  return (
    <li>
      <Link
        href={routes.conversation(conversation.id)}
        className="flex min-h-20 items-center gap-3 p-3 hover:bg-surface focus-visible:outline-2 focus-visible:outline-primary"
      >
        <div className="size-14 shrink-0 overflow-hidden rounded-lg bg-surface">
          {conversation.subject.thumb ? (
            // Public WebP thumb from the API; next/image adds nothing at this size.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={conversation.subject.thumb} alt="" className="size-full object-cover" />
          ) : null}
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-baseline justify-between gap-2">
            <p className={cn('truncate', unread ? 'font-bold text-text' : 'font-semibold text-text')}>{conversation.other_party.name}</p>
            <span className={cn('shrink-0 text-xs', unread ? 'font-semibold text-primary' : 'text-text-muted')}>
              {chatTime(last?.at, language, { yesterday: t('yesterday') })}
            </span>
          </div>
          <p className="truncate text-xs text-text-muted">
            {conversation.closed ? <span className="mr-1 font-semibold text-danger">{t('closedLabel')} ·</span> : null}
            {conversation.subject.title}
          </p>
          <div className="flex items-center justify-between gap-2">
            <p className={cn('truncate text-sm', unread ? 'font-semibold text-text' : 'text-text-muted')}>
              {last ? (
                <>
                  {last.mine ? t('you') : ''}
                  {last.body ?? t('removedPreview')}
                </>
              ) : (
                t('held')
              )}
            </p>
            {unread ? (
              <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-on-primary">
                {t('unreadCount', { count: conversation.unread_count })}
              </span>
            ) : null}
          </div>
        </div>
      </Link>
    </li>
  );
}
