import type { MetadataRoute } from 'next';
import { getSitemapEntries } from '@/lib/server-api';
import { absoluteUrl } from '@/lib/seo';

/** /sitemap.xml: the public pages, so search engines find every published listing and seller page. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { listings, profiles } = await getSitemapEntries();

  return [
    { url: absoluteUrl('/'), changeFrequency: 'daily', priority: 1 },
    { url: absoluteUrl('/search'), changeFrequency: 'daily', priority: 0.8 },
    ...listings.map((entry) => ({
      url: absoluteUrl(`/listings/${entry.slug}`),
      lastModified: entry.updated_at ?? undefined,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),
    ...profiles.map((entry) => ({
      url: absoluteUrl(`/p/${entry.slug}`),
      lastModified: entry.updated_at ?? undefined,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    })),
  ];
}
