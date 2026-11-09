'use client';

import Link from 'next/link';
import { parseAsStringLiteral, useQueryState } from 'nuqs';
import { useQueryClient } from '@tanstack/react-query';
import { orderKeys, useOrders, type Order } from '@whyme/data';
import { cn } from '@/components/ui/cn';
import { Skeleton } from '@/components/ui/skeleton';
import { formatNaira, routes } from '@/lib/format';
import { useLanguage, useT } from '@/lib/i18n';
import { useUserEvents } from '@/lib/realtime';
import { useAccount } from '@/lib/session';
import { chatTime } from '@/components/chat/time';
import { FundsStatus, OrderStatus } from './OrderStatus';

const TABS = ['bought', 'sold'] as const;

/** Orders I bought, and orders bought from me (paid ones only), newest first. */
export function OrdersList() {
  const { t } = useT('orders');
  const [tab, setTab] = useQueryState('tab', parseAsStringLiteral(TABS).withDefault('bought'));
  const role = tab === 'sold' ? 'selling' : 'buying';
  const orders = useOrders(role);
  const queryClient = useQueryClient();
  const { user } = useAccount();
  useUserEvents(user?.id, { 'order.updated': () => void queryClient.invalidateQueries({ queryKey: orderKeys.all }) });

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">{t('ordersTitle')}</h1>
        <p className="mt-1 text-sm text-text-muted">{t('ordersIntro')}</p>
      </div>

      <div role="tablist" className="flex gap-2">
        {TABS.map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={tab === name}
            onClick={() => void setTab(name === 'bought' ? null : name)}
            className={cn(
              'min-h-11 rounded-full px-4 text-sm font-semibold',
              tab === name ? 'bg-primary text-on-primary' : 'bg-surface text-text hover:bg-primary-soft',
            )}
          >
            {t(name)}
          </button>
        ))}
      </div>

      {orders.isPending ? (
        <div className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : orders.isError ? (
        <p role="alert" className="rounded-lg bg-surface p-3 text-sm text-danger">
          {t('loadFailed')}
        </p>
      ) : orders.data.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-text-muted">
          {t(tab === 'sold' ? 'emptySold' : 'emptyBought')}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-2xl border border-border">
          {orders.data.map((order) => (
            <OrderRow key={order.id} order={order} />
          ))}
        </ul>
      )}
    </div>
  );
}

function OrderRow({ order }: { order: Order }) {
  const { t } = useT('orders');
  const language = useLanguage();

  return (
    <li>
      <Link href={routes.order(order.id)} className="flex min-h-20 items-center gap-3 p-3 hover:bg-surface focus-visible:outline-2 focus-visible:outline-primary">
        <div className="size-14 shrink-0 overflow-hidden rounded-lg bg-surface">
          {order.thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={order.thumb} alt="" className="size-full object-cover" />
          ) : null}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate font-semibold">{order.title}</p>
            <span className="shrink-0 font-bold">{formatNaira(order.total_kobo)}</span>
          </div>
          <p className="truncate text-xs text-text-muted">
            {order.number} · {order.other_party.name} · {chatTime(order.created_at, language, { yesterday: t('chat:yesterday') })}
          </p>
          <div className="flex flex-wrap gap-1.5">
            <OrderStatus order={order} />
            <FundsStatus order={order} />
          </div>
        </div>
      </Link>
    </li>
  );
}
