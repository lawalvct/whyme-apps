import { cacheLife, cacheTag } from 'next/cache';
import { createApiClient } from '@whyme/api-client';
import type { PublicListing, PublicProfile, Taxonomy } from '@whyme/data';

/**
 * Public data for server-rendered pages (SEO, fast first load). Everything here
 * is cached for minutes and tagged, so moderation can also revalidate a page on
 * demand (SAF06). Server HTML is English; client components switch language.
 *
 * Only public endpoints: nothing here sends the visitor's cookies.
 */
const api = createApiClient({
  baseUrl: process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api',
  headers: () => ({ 'Accept-Language': 'en', 'X-Platform': 'web' }),
});

export async function getListing(id: string): Promise<PublicListing | null> {
  'use cache';
  cacheLife('minutes');
  cacheTag(`listing:${id}`);

  const { data, response } = await api.GET('/v1/listings/{listing}', { params: { path: { listing: id } } });
  if (response.status === 404) return null;
  if (!data) throw new Error(`Listing ${id}: HTTP ${response.status}`);
  return data.data;
}

export async function getProfile(id: string): Promise<PublicProfile | null> {
  'use cache';
  cacheLife('minutes');
  cacheTag(`profile:${id}`);

  const { data, response } = await api.GET('/v1/profiles/{profile}', { params: { path: { profile: id } } });
  if (response.status === 404) return null;
  if (!data) throw new Error(`Profile ${id}: HTTP ${response.status}`);
  return data.data;
}

export async function getProfileListings(id: string): Promise<PublicListing[]> {
  'use cache';
  cacheLife('minutes');
  cacheTag(`profile:${id}`);

  const { data } = await api.GET('/v1/profiles/{profile}/listings', { params: { path: { profile: id } } });
  return data?.data ?? [];
}

/**
 * Lists for the home page. An unreachable API (e.g. during a build) gives an
 * empty section rather than a failed page; it refills on the next revalidation.
 */
export async function getLatestListings(kind: 'product' | 'service'): Promise<PublicListing[]> {
  'use cache';
  cacheLife('minutes');
  cacheTag('listings');

  try {
    const { data } = await api.GET('/v1/listings', { params: { query: { kind } } });
    return (data?.data ?? []).slice(0, 8);
  } catch {
    return [];
  }
}

export async function getLatestProfiles(kind: 'business' | 'provider'): Promise<PublicProfile[]> {
  'use cache';
  cacheLife('minutes');
  cacheTag('profiles');

  try {
    const { data } = await api.GET('/v1/profiles', { params: { query: { kind } } });
    return (data?.data ?? []).slice(0, 6);
  } catch {
    return [];
  }
}

export async function getTaxonomy(): Promise<Taxonomy | null> {
  'use cache';
  cacheLife('hours');
  cacheTag('taxonomy');

  try {
    const { data } = await api.GET('/v1/taxonomy');
    return data?.data ?? null;
  } catch {
    return null;
  }
}
