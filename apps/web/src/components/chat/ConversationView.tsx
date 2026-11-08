'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiRequestError, chatKeys, ensureOk, unwrap, useApi, type ChatMessage, type Conversation, type MessagePage } from '@whyme/data';
import { errorKey } from '@whyme/i18n';
import { Price } from '@/components/market/Price';
import { Button } from '@/components/ui/button';
import { cn } from '@/components/ui/cn';
import { Skeleton } from '@/components/ui/skeleton';
import { routes } from '@/lib/format';
import { useLanguage, useT } from '@/lib/i18n';
import { bubbleTime } from './time';

const MAX_LENGTH = 2000;

/** A message typed here that the API hasn't confirmed yet. */
type Pending = { clientId: string; body: string; state: 'sending' | 'failed' };

/**
 * One conversation (COM*). New messages are checked every 5 seconds while it's
 * open; sending keeps a stable client ID, so "Try again" never sends twice.
 */
export function ConversationView({ id }: { id: string }) {
  const { t } = useT('chat');
  const api = useApi();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<Pending[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const conversation = useQuery({
    queryKey: chatKeys.conversation(id),
    queryFn: async () => unwrap(await api.GET('/v1/conversations/{conversation}', { params: { path: { conversation: id } } })).data as unknown as Conversation,
  });

  const messages = useInfiniteQuery({
    queryKey: chatKeys.messages(id),
    initialPageParam: null as string | null,
    getNextPageParam: (last: MessagePage) => last.next_before,
    refetchInterval: 5_000,
    queryFn: async ({ pageParam }): Promise<MessagePage> => {
      // `before` isn't in the generated query types.
      const query = (pageParam ? { before: pageParam } : {}) as never;
      return unwrap(await api.GET('/v1/conversations/{conversation}/messages', { params: { path: { conversation: id }, query } })) as unknown as MessagePage;
    },
  });

  // Pages come newest first; show oldest at the top.
  const items = (messages.data?.pages ?? []).flatMap((page) => page.data).reverse();
  const confirmed = new Set(items.filter((m) => m.mine && m.client_id).map((m) => m.client_id));
  const waiting = pending.filter((p) => !confirmed.has(p.clientId));
  const newestTheirs = [...items].reverse().find((m) => !m.mine)?.id;
  const newestId = waiting.at(-1)?.clientId ?? items.at(-1)?.id;

  // Seeing the other side's newest message marks the conversation read.
  useEffect(() => {
    if (!newestTheirs) return;
    void (async () => {
      ensureOk(await api.POST('/v1/conversations/{conversation}/read', { params: { path: { conversation: id } } }));
      void queryClient.invalidateQueries({ queryKey: chatKeys.unread });
      void queryClient.invalidateQueries({ queryKey: chatKeys.inbox });
    })().catch(() => undefined);
  }, [newestTheirs, id, api, queryClient]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [newestId]);

  async function send(body: string, clientId: string = crypto.randomUUID()) {
    setError(null);
    setPending((list) => [...list.filter((p) => p.clientId !== clientId), { clientId, body, state: 'sending' }]);
    try {
      unwrap(
        await api.POST('/v1/conversations/{conversation}/messages', {
          params: { path: { conversation: id } },
          body: { body, client_id: clientId },
        }),
      );
      await queryClient.invalidateQueries({ queryKey: chatKeys.messages(id) });
      setPending((list) => list.filter((p) => p.clientId !== clientId));
      void queryClient.invalidateQueries({ queryKey: chatKeys.inbox });
    } catch (e) {
      if (e instanceof ApiRequestError && e.status === 422) {
        // Refused (e.g. a phone number in it): nothing was stored, so put the text back to fix.
        setPending((list) => list.filter((p) => p.clientId !== clientId));
        setDraft(body);
        setError(e.code === 'content_blocked' ? t('blocked') : t(errorKey(e.code)));
        return;
      }
      setPending((list) => list.map((p) => (p.clientId === clientId ? { ...p, state: 'failed' } : p)));
    }
  }

  function onSubmit(event?: FormEvent) {
    event?.preventDefault();
    const body = draft.trim();
    if (!body || body.length > MAX_LENGTH) return;
    setDraft('');
    void send(body);
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends; Shift+Enter starts a new line.
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      onSubmit();
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
      <Link href={routes.messages} className="text-sm font-semibold text-primary hover:underline">
        ← {t('allMessages')}
      </Link>

      {conversation.data ? <Header conversation={conversation.data} /> : <Skeleton className="h-20 w-full" />}

      <p className="rounded-lg bg-accent-soft p-3 text-xs text-accent-text">{t('safety')}</p>

      <section aria-label={t('messages')} aria-live="polite" className="flex flex-col gap-2 py-2">
        {messages.hasNextPage ? (
          <Button variant="ghost" className="self-center text-sm" disabled={messages.isFetchingNextPage} onClick={() => void messages.fetchNextPage()}>
            {messages.isFetchingNextPage ? t('common:loading') : t('olderMessages')}
          </Button>
        ) : null}

        {messages.isPending ? (
          <Skeleton className="h-32 w-full" />
        ) : messages.isError ? (
          <p role="alert" className="text-sm text-danger">
            {t('loadFailed')}
          </p>
        ) : items.length === 0 && waiting.length === 0 ? (
          <p className="py-6 text-center text-sm text-text-muted">{t('startConversation')}</p>
        ) : null}

        {items.map((message) => (
          <Bubble key={message.id} message={message} />
        ))}
        {waiting.map((p) => (
          <PendingBubble key={p.clientId} pending={p} onRetry={() => void send(p.body, p.clientId)} />
        ))}
        <div ref={endRef} />
      </section>

      <form method="post" onSubmit={onSubmit} className="sticky bottom-0 flex flex-col gap-2 border-t border-border bg-background py-3">
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
        <div className="flex items-end gap-2">
          <label htmlFor="chat-draft" className="sr-only">
            {t('writeMessage')}
          </label>
          <textarea
            id="chat-draft"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            rows={Math.min(5, Math.max(1, draft.split('\n').length))}
            maxLength={MAX_LENGTH}
            placeholder={t('writeMessage')}
            className="min-h-12 flex-1 resize-none rounded-lg border border-border bg-background px-3 py-3 text-base leading-snug focus:border-primary focus:outline-2 focus:outline-primary-soft"
          />
          <Button type="submit" disabled={draft.trim() === ''} className="px-4">
            {t('send')}
          </Button>
        </div>
      </form>
    </div>
  );
}

function Header({ conversation }: { conversation: Conversation }) {
  const { t } = useT('chat');
  const { subject } = conversation;
  const href =
    subject.type === 'listing'
      ? routes.listing({ id: subject.id, title: subject.title })
      : routes.profile({ id: subject.id, display_name: subject.title });

  const body = (
    <>
      <div className="size-14 shrink-0 overflow-hidden rounded-lg bg-surface">
        {subject.thumb ? (
          // Public WebP thumb from the API.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={subject.thumb} alt="" className="size-full object-cover" />
        ) : null}
      </div>
      <div className="min-w-0">
        <h1 className="truncate text-lg font-bold">{conversation.other_party.name}</h1>
        <p className="truncate text-sm text-text-muted">{subject.title}</p>
        {subject.available ? (
          subject.type === 'listing' ? (
            <Price kobo={subject.price_kobo} kind={subject.kind ?? 'product'} className="text-sm font-semibold text-primary" />
          ) : null
        ) : (
          <p className="text-xs text-warning">{t('noLongerAvailable')}</p>
        )}
      </div>
    </>
  );

  return subject.available ? (
    <Link href={href} className="flex items-center gap-3 rounded-2xl border border-border p-3 hover:border-primary">
      {body}
    </Link>
  ) : (
    <div className="flex items-center gap-3 rounded-2xl border border-border p-3">{body}</div>
  );
}

function Bubble({ message }: { message: ChatMessage }) {
  const { t } = useT('chat');
  const language = useLanguage();
  const mine = message.mine;

  return (
    <div className={cn('flex max-w-[85%] flex-col gap-0.5', mine ? 'self-end items-end' : 'self-start items-start')}>
      <p
        className={cn(
          'whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-base',
          mine ? 'rounded-br-sm' : 'rounded-bl-sm',
          message.status !== 'sent'
            ? 'border-2 border-dashed border-warning bg-accent-soft text-text'
            : mine
              ? 'bg-primary text-on-primary'
              : 'bg-surface text-text',
        )}
      >
        {message.body}
      </p>
      <span className="text-xs text-text-muted">{bubbleTime(message.created_at, language)}</span>
      {message.status === 'held' ? <span className="text-xs text-warning">{t('heldNote')}</span> : null}
      {message.status === 'rejected' ? (
        <span role="alert" className="text-xs text-danger">
          {t('rejectedNote', { reason: message.rejection_reason ?? '' })}
        </span>
      ) : null}
    </div>
  );
}

function PendingBubble({ pending, onRetry }: { pending: Pending; onRetry: () => void }) {
  const { t } = useT('chat');
  return (
    <div className="flex max-w-[85%] flex-col items-end gap-0.5 self-end">
      <p className="whitespace-pre-wrap break-words rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-base text-on-primary opacity-60">
        {pending.body}
      </p>
      {pending.state === 'sending' ? (
        <span className="text-xs text-text-muted">{t('sending')}</span>
      ) : (
        <span role="alert" className="flex items-center gap-2 text-xs text-danger">
          {t('notSent')}
          <button type="button" onClick={onRetry} className="min-h-9 font-semibold text-primary underline">
            {t('tryAgain')}
          </button>
        </span>
      )}
    </div>
  );
}
