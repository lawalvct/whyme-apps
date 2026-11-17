import { useQuery } from '@tanstack/react-query';
import type { paths } from '@whyme/api-client';
import { unwrap, useApi } from './api';
import type { ListingKind } from './seller';

/**
 * The website Business Center (PAY03, MON01–MON06): Pro plans, featured listings and job
 * posts, bought through the payment gateway. The Android app shows entitlements only.
 */

type Overview = paths['/v1/me/billing']['get']['responses'][200]['content']['application/json']['data'];

export type BillingSummary = Overview['summary'];
export type PlanSummary = BillingSummary['vendor_plan'];
export type JobCredits = BillingSummary['jobs'];

export type BillingSku =
  | 'vendor_pro_30d'
  | 'provider_pro_30d'
  | 'featured_listing_7d'
  | 'featured_listing_30d'
  | 'job_standard_30d'
  | 'job_featured_30d';

export interface BillingCatalogItem {
  sku: BillingSku;
  kind: 'subscription' | 'featured_placement' | 'job_post';
  /** English, from the API: the website shows its own translated name by SKU. */
  title: string;
  description: string;
  price_kobo: number;
  currency: 'NGN';
  term_days: number;
}

/** The API's resources for these aren't typed by the spec yet (arrays built in the controller). */
export interface BillingSubscription {
  id: string;
  plan: 'vendor_pro' | 'provider_pro';
  status: 'active' | 'expired';
  term_days: number;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string | null;
}

export interface FeaturedPlacement {
  id: string;
  listing_id: string;
  listing_title: string | null;
  listing_slug: string | null;
  listing_status: string | null;
  term_days: number;
  status: 'pending_approval' | 'active' | 'expired' | 'cancelled';
  starts_at: string | null;
  ends_at: string | null;
  created_at: string | null;
}

export interface BillingPurchase {
  id: string;
  number: string;
  sku: BillingSku;
  kind: 'subscription' | 'featured_placement' | 'job_post';
  title: string;
  amount_kobo: number;
  currency: 'NGN';
  term_days: number;
  target_type: 'listing' | 'vacancy' | null;
  target_id: string | null;
  status: 'awaiting_payment' | 'paid' | 'cancelled';
  paid_at: string | null;
  snapshot: { listing_title?: string; vacancy_title?: string } & Record<string, unknown>;
  /** The latest payment's state (awaiting_payment, pending_verification, succeeded, failed…). */
  payment_state: string | null;
  created_at: string | null;
}

export interface BillingOverview {
  catalog: BillingCatalogItem[];
  summary: BillingSummary;
  subscriptions: BillingSubscription[];
  featured_placements: FeaturedPlacement[];
  purchases: BillingPurchase[];
}

export interface StartedPurchase {
  /** Null when nothing needs paying at the gateway (already paid). */
  checkout_url: string | null;
  reference: string;
  purchase: BillingPurchase;
  summary: BillingSummary;
}

export interface CheckedPurchase {
  purchase: BillingPurchase;
  summary: BillingSummary;
}

export interface KeptListings {
  kept_live_ids: string[];
  paused_ids: string[];
  cap: number;
  summary: BillingSummary;
}

export const billingKeys = {
  all: ['me', 'billing'] as const,
  overview: ['me', 'billing', 'overview'] as const,
};

/** Plans, credits, featured placements and recent purchases for the signed-in account. */
export function useBillingOverview(enabled = true) {
  const api = useApi();
  return useQuery({
    queryKey: billingKeys.overview,
    queryFn: async () => unwrap(await api.GET('/v1/me/billing')).data as unknown as BillingOverview,
    enabled,
  });
}

/** POST /me/billing/purchases, then the browser goes to the gateway. One tap, one purchase: the client ID and the Idempotency-Key come from the tap. */
export async function startPurchase(
  api: ReturnType<typeof useApi>,
  input: { sku: BillingSku; listingId?: string | null; vacancyId?: string | null; expectedPriceKobo: number; clientId: string },
): Promise<StartedPurchase> {
  const result = await api.POST('/v1/me/billing/purchases', {
    body: {
      sku: input.sku,
      listing_id: input.listingId ?? null,
      vacancy_id: input.vacancyId ?? null,
      expected_price_kobo: input.expectedPriceKobo,
      client_id: input.clientId,
    },
    headers: { 'Idempotency-Key': input.clientId },
  });
  return unwrap(result).data as unknown as StartedPurchase;
}

/** Asks the API to check a purchase's payment with the gateway (after coming back from it). */
export async function checkPurchase(api: ReturnType<typeof useApi>, purchaseId: string): Promise<CheckedPurchase> {
  const result = await api.POST('/v1/me/billing/purchases/{purchase}/check', { params: { path: { purchase: purchaseId } } });
  return unwrap(result).data as unknown as CheckedPurchase;
}

/** After a Pro plan ends: which listings stay live, up to the plan's cap (MON04). The rest pause, never deleted. */
export async function keepListingsLive(api: ReturnType<typeof useApi>, kind: ListingKind, listingIds: string[]): Promise<KeptListings> {
  const result = await api.POST('/v1/me/billing/keep-listings', { body: { kind, listing_ids: listingIds } });
  return unwrap(result).data as unknown as KeptListings;
}
