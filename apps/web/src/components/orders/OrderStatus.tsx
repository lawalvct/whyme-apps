'use client';

import type { FulfilmentState, Order } from '@whyme/data';
import { Badge } from '@/components/ui/badge';
import { useT } from '@/lib/i18n';

type T = (key: string, options?: Record<string, unknown>) => string;

/**
 * A fulfilment state in words for whoever is looking (ORD06): "Ready for pickup" or
 * "Sent" depending on the method, and the seller's or buyer's own wording where it differs.
 */
export function fulfilmentLabel(t: T, order: Pick<Order, 'role' | 'fulfilment_method'>, state: FulfilmentState | string): string {
  const own = order.role === 'seller' ? 'fulfilmentSeller' : 'fulfilmentBuyer';
  const candidates = [
    order.fulfilment_method === 'pickup' ? `fulfilmentPickup.${state}` : null,
    `${own}.${state}`,
    `fulfilment.${state}`,
  ].filter((k): k is string => k !== null);
  for (const key of candidates) {
    const text = optional(t, key);
    if (text) return text;
  }
  return state;
}

/** Where the money is, worded for whoever is looking. */
export function fundsLabel(t: T, order: Pick<Order, 'role'>, state: string): string {
  return (order.role === 'seller' ? optional(t, `fundsSeller.${state}`) : undefined) ?? t(`funds.${state}`);
}

/**
 * One step in the order history, in the past tense ("Accepted", "Ready for pickup",
 * "Declined"): who did it is shown next to it.
 */
export function eventLabel(
  t: T,
  order: Pick<Order, 'fulfilment_method'>,
  event: { domain: string; to: string; actor: string },
): string {
  if (event.domain === 'funds') return optional(t, `eventFunds.${event.to}`) ?? t(`funds.${event.to}`);
  if (event.to === 'cancelled' && event.actor === 'seller') return t('event.declined');
  return (order.fulfilment_method === 'pickup' ? optional(t, `eventPickup.${event.to}`) : undefined) ?? optional(t, `event.${event.to}`) ?? event.to;
}

/** A translation that may not exist: i18next hands back the key itself when it's missing. */
function optional(t: T, key: string): string | undefined {
  const text = t(key);
  return text && text !== key ? text : undefined;
}

/** The order's headline status. */
export function OrderStatus({ order }: { order: Order }) {
  const { t } = useT('orders');
  const state = order.fulfilment_state;
  const waitingOnViewer =
    (order.role === 'seller' && (state === 'paid' || state === 'accepted')) ||
    (order.role === 'buyer' && (state === 'dispatched' || state === 'completion_submitted'));
  const tone = state === 'awaiting_payment' || state === 'cancelled' ? 'warning' : waitingOnViewer ? 'accent' : state === 'completed' ? 'neutral' : 'primary';

  return <Badge tone={tone}>{fulfilmentLabel(t, order, state)}</Badge>;
}

/** Where the money is: shown next to the status once it's paid. */
export function FundsStatus({ order }: { order: Order }) {
  const { t } = useT('orders');
  if (order.funds_state === 'awaiting_collection') return null;
  return <Badge tone="primary">{fundsLabel(t, order, order.funds_state)}</Badge>;
}
