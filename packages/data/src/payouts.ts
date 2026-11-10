import { useQuery } from '@tanstack/react-query';
import type { components, paths } from '@whyme/api-client';
import { unwrap, useApi } from './api';
import { useOfflineFetcher } from './offline';

/** A bank a payout can go to. */
export interface Bank {
  code: string;
  name: string;
}

/** The seller's payout account, masked (GET /v1/me/payout-account). */
export type PayoutAccount = components['schemas']['PayoutAccountResource'];

/** One payout as the seller sees it. */
export type SellerPayout = components['schemas']['SellerPayoutResource'];

/** GET /v1/me/earnings. The generated totals type is too narrow (inferred from zeros), so it's set here. */
export interface Earnings {
  totals: {
    /** Paid orders not yet delivered and confirmed. */
    awaiting_delivery_kobo: number;
    /** A problem was reported, the order was cancelled, or WHY ME is checking it. */
    on_hold_kobo: number;
    /** Confirmed: waiting for WHY ME to release. */
    awaiting_release_kobo: number;
    /** Released and on its way to the seller's bank. */
    being_paid_kobo: number;
    paid_kobo: number;
  };
  payouts: SellerPayout[];
}

/**
 * GET /v1/orders/{order}/payout: what the seller receives for one order and why (the sale,
 * refunds, WHY ME's commission, the Paystack fees WHY ME pays), and whether they can ask now.
 */
export type PayoutBreakdown = paths['/v1/orders/{order}/payout']['get']['responses'][200]['content']['application/json']['data'];

export const payoutKeys = {
  all: ['me', 'payouts'] as const,
  banks: ['banks'] as const,
  account: ['me', 'payouts', 'account'] as const,
  earnings: ['me', 'payouts', 'earnings'] as const,
  // Under the order's key, so an order.updated event refreshes it too.
  order: (id: string) => ['me', 'orders', 'order', id, 'payout'] as const,
};

export function useBanks(enabled = true) {
  const api = useApi();
  return useQuery({
    queryKey: payoutKeys.banks,
    queryFn: async () => unwrap(await api.GET('/v1/banks')).data as Bank[],
    staleTime: 24 * 60 * 60_000,
    enabled,
  });
}

export function usePayoutAccount() {
  const api = useApi();
  const fetcher = useOfflineFetcher('payout-account', 'me', async () => (unwrap(await api.GET('/v1/me/payout-account')).data ?? null) as PayoutAccount | null);
  return useQuery({ queryKey: payoutKeys.account, queryFn: fetcher });
}

export function useEarnings() {
  const api = useApi();
  const fetcher = useOfflineFetcher('earnings', 'me', async () => unwrap(await api.GET('/v1/me/earnings')).data as unknown as Earnings);
  return useQuery({ queryKey: payoutKeys.earnings, queryFn: fetcher });
}

export function usePayoutBreakdown(orderId: string, enabled = true) {
  const api = useApi();
  return useQuery({
    queryKey: payoutKeys.order(orderId),
    queryFn: async () => unwrap(await api.GET('/v1/orders/{order}/payout', { params: { path: { order: orderId } } })).data,
    enabled,
  });
}
