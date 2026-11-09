import { useQuery } from '@tanstack/react-query';
import type { components } from '@whyme/api-client';
import { unwrap, useApi } from './api';

/** An order as the signed-in buyer or seller sees it (GET /v1/orders/{id}). */
export type Order = components['schemas']['OrderResource'];

export type FulfilmentState = Order['fulfilment_state'];
export type FundsState = Order['funds_state'];
export type PaymentState = NonNullable<Order['payment']>['state'];

/** POST /v1/checkout/quote. The generated type is loose (an array built in PHP), so it's set here. */
export interface CheckoutQuote {
  listing_id: string;
  title: string;
  quantity: number;
  /** Null when the seller doesn't track stock. */
  available_quantity: number | null;
  fulfilment_method: 'pickup' | 'delivery';
  fulfilment_options: ('pickup' | 'delivery')[];
  unit_price_kobo: number;
  subtotal_kobo: number;
  delivery_fee_kobo: number;
  buyer_fee_kobo: number;
  total_kobo: number;
  currency: string;
  terms: { id: number; version: string; title: string };
}

export const orderKeys = {
  all: ['me', 'orders'] as const,
  list: (role: 'buying' | 'selling') => ['me', 'orders', 'list', role] as const,
  counts: ['me', 'orders', 'counts'] as const,
  // Under orders, so an order.updated event refreshes the order's dispute too.
  dispute: (id: string) => ['me', 'orders', 'dispute', id] as const,
  order: (id: string) => ['me', 'orders', 'order', id] as const,
  quote: (listingId: string, quantity: number, method: string) => ['me', 'orders', 'quote', listingId, quantity, method] as const,
};

/** Payment states that will still change on their own (the gateway hasn't given a final answer). */
export function paymentIsOpen(state: PaymentState | undefined): boolean {
  return state === 'awaiting_payment' || state === 'pending_verification' || state === 'unknown' || state === 'created';
}

export function useOrder(id: string, options: { refetchInterval?: number | false } = {}) {
  const api = useApi();
  return useQuery({
    queryKey: orderKeys.order(id),
    queryFn: async () => unwrap(await api.GET('/v1/orders/{order}', { params: { path: { order: id } } })).data,
    refetchInterval: options.refetchInterval,
  });
}

export function useOrders(role: 'buying' | 'selling') {
  const api = useApi();
  return useQuery({
    queryKey: orderKeys.list(role),
    queryFn: async () => unwrap(await api.GET('/v1/me/orders', { params: { query: { role } } })).data,
  });
}

/** What a person can do to an order after checkout (POST /v1/orders/{id}/{action}). */
export type OrderAction = 'accept' | 'decline' | 'dispatch' | 'complete' | 'confirm' | 'cancel';

/**
 * Orders waiting for this person: to accept or send (selling) or to confirm (buying).
 * For the badge on the Orders link; checked every minute while a page is open.
 */
export function useOrderCounts(enabled: boolean) {
  const api = useApi();
  return useQuery({
    queryKey: orderKeys.counts,
    queryFn: async () => unwrap(await api.GET('/v1/me/orders/counts')).data,
    enabled,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
}

/** A "Report a problem" case as the buyer or seller sees it (GET /v1/disputes/{id}). */
export type Dispute = components['schemas']['DisputeResource'];
export type DisputeCategory = Dispute['category'];

export function useDispute(id: string | undefined) {
  const api = useApi();
  return useQuery({
    queryKey: orderKeys.dispute(id ?? ''),
    queryFn: async () => unwrap(await api.GET('/v1/disputes/{dispute}', { params: { path: { dispute: id! } } })).data,
    enabled: Boolean(id),
  });
}
