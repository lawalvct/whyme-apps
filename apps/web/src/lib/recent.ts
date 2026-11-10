'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import type { PublicListing, Taxonomy } from '@whyme/data';
import { accountRuntime, useAccountRuntime } from './offline';

/**
 * Recently viewed listings (OFF02): kept in the signed-in account's own database,
 * so they open offline and are deleted on sign-out with everything else.
 */

const KIND = 'viewed';
const KEEP = 50;

export async function rememberViewed(listing: PublicListing): Promise<void> {
  const sync = accountRuntime();
  if (!sync) return;
  try {
    await sync.db.cache(KIND, listing.id, listing);
    const all = await sync.db.records.where('kind').equals(KIND).toArray();
    const old = all.sort((a, b) => b.fetchedAt - a.fetchedAt).slice(KEEP);
    if (old.length) await sync.db.records.bulkDelete(old.map((r) => [r.kind, r.id] as [string, string]));
  } catch {
    // Storage full or blocked: browsing still works.
  }
}

export async function clearRecentlyViewed(): Promise<void> {
  await accountRuntime()?.db.records.where('kind').equals(KIND).delete();
}

/** Newest first; undefined while loading, empty when signed out. */
export function useRecentlyViewed(): PublicListing[] | undefined {
  const sync = useAccountRuntime();
  return useLiveQuery(async () => {
    if (!sync) return [];
    const rows = await sync.db.records.where('kind').equals(KIND).toArray();
    return rows.sort((a, b) => b.fetchedAt - a.fetchedAt).map((r) => r.data as PublicListing);
  }, [sync]);
}

/** Everything this device holds to search offline: saved items, then recently viewed (no repeats). */
export function useKeptListings(): PublicListing[] | undefined {
  const sync = useAccountRuntime();
  return useLiveQuery(async () => {
    if (!sync) return [];
    const saved = ((await sync.db.records.get(['saved', 'listings']))?.data as PublicListing[] | undefined) ?? [];
    const viewed = (await sync.db.records.where('kind').equals(KIND).toArray()).sort((a, b) => b.fetchedAt - a.fetchedAt).map((r) => r.data as PublicListing);
    const seen = new Set<string>();
    return [...saved, ...viewed].filter((listing) => (seen.has(listing.id) ? false : (seen.add(listing.id), true)));
  }, [sync]);
}

export interface OfflineFilters {
  q: string;
  kind?: 'product' | 'service';
  category_id?: number;
  location_id?: number;
  /** In kobo. */
  min_price?: number;
  max_price?: number;
}

/** A simple stand-in for the server's search: every word must appear; a parent category or area includes its children. */
export function searchKept(listings: PublicListing[], filters: OfflineFilters, taxonomy: Taxonomy | undefined): PublicListing[] {
  const words = filters.q.toLowerCase().split(/\s+/).filter(Boolean);
  const parentOf = (list: { id: number; parent_id?: number | null }[] | undefined, id: number) => list?.find((x) => x.id === id)?.parent_id ?? null;
  const within = (list: { id: number; parent_id?: number | null }[] | undefined, id: number, wanted: number) => {
    for (let current: number | null = id, depth = 0; current !== null && depth < 5; current = parentOf(list, current), depth++) {
      if (current === wanted) return true;
    }
    return false;
  };

  return listings.filter((listing) => {
    if (filters.kind && listing.kind !== filters.kind) return false;
    if (filters.category_id !== undefined && !within(taxonomy?.categories, listing.category.id, filters.category_id)) return false;
    if (filters.location_id !== undefined && !within(taxonomy?.locations, listing.location.id, filters.location_id)) return false;
    const price = listing.price_kobo;
    if (filters.min_price !== undefined && (price === null || price < filters.min_price)) return false;
    if (filters.max_price !== undefined && (price === null || price > filters.max_price)) return false;
    if (words.length === 0) return true;
    const text = `${listing.title} ${listing.description} ${listing.category.name} ${listing.location.name} ${listing.seller.name}`.toLowerCase();
    return words.every((word) => text.includes(word));
  });
}
