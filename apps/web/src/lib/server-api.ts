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

/** A listing by its address: the slug, an older slug, or the ID (older links). */
export async function getListing(key: string): Promise<PublicListing | null> {
  'use cache';
  cacheLife('minutes');
  cacheTag(`listing:${key}`);

  const { data, response } = await api.GET('/v1/listings/{listing}', { params: { path: { listing: key } } });
  if (response.status === 404) return null;
  if (!data) throw new Error(`Listing ${key}: HTTP ${response.status}`);
  cacheTag(`listing:${data.data.id}`);
  return data.data;
}

/** A business or provider page by its address: the slug, an older slug, or the ID. */
export async function getProfile(key: string): Promise<PublicProfile | null> {
  'use cache';
  cacheLife('minutes');
  cacheTag(`profile:${key}`);

  const { data, response } = await api.GET('/v1/profiles/{profile}', { params: { path: { profile: key } } });
  if (response.status === 404) return null;
  if (!data) throw new Error(`Profile ${key}: HTTP ${response.status}`);
  cacheTag(`profile:${data.data.id}`);
  return data.data;
}

/**
 * Every published listing and seller page, for sitemap.xml. An unreachable API gives an
 * empty list rather than a failed sitemap; it refills on the next revalidation.
 */
export async function getSitemapEntries(): Promise<{ listings: SitemapEntry[]; profiles: SitemapEntry[] }> {
  'use cache';
  cacheLife('hours');
  cacheTag('listings');
  cacheTag('profiles');

  try {
    const { data } = await api.GET('/v1/sitemap');
    return data?.data ?? { listings: [], profiles: [] };
  } catch {
    return { listings: [], profiles: [] };
  }
}

export interface SitemapEntry {
  slug: string;
  updated_at: string | null;
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
  cacheLife('minutes');
  cacheTag('taxonomy');

  try {
    const { data } = await api.GET('/v1/taxonomy');
    return data?.data ?? null;
  } catch {
    return null;
  }
}

export interface PublishedTerms {
  type: string;
  version: string;
  title: string;
  body: string;
  published_at: string | null;
}

/** The current published terms of one kind (English on the server), or null before they are published. */
export async function getTerms(type: 'platform' | 'seller' | 'buyer' | 'privacy'): Promise<PublishedTerms | null> {
  'use cache';
  // Minutes, not hours: newly published terms should show soon after they are published.
  cacheLife('minutes');
  cacheTag('terms');

  const { data, response } = await api.GET('/v1/terms/{type}', { params: { path: { type } } });
  if (response.status === 404) return null;
  if (!data) throw new Error(`Terms ${type}: HTTP ${response.status}`);
  return data.data;
}
