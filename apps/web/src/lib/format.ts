const naira = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });

/** ₦145,000 from 14500000 kobo. Money is always kobo in the API (PAY06). */
export function formatNaira(kobo: number): string {
  return naira.format(kobo / 100);
}

/** Readable links: /listings/{id}/{slug}. The ID decides; the slug is for people and search engines. */
export function slugify(text: string): string {
  return (
    text
      .normalize('NFKD')
      .replace(/\p{Mn}+/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'item'
  );
}

export const routes = {
  home: '/',
  search: (params: Record<string, string | number | undefined> = {}) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') query.set(key, String(value));
    }
    const qs = query.toString();
    return qs ? `/search?${qs}` : '/search';
  },
  listing: (listing: { id: string; title: string }) => `/listings/${listing.id}/${slugify(listing.title)}`,
  profile: (profile: { id: string; slug?: string; display_name?: string }) =>
    `/p/${profile.id}/${profile.slug ?? slugify(profile.display_name ?? '')}`,
  signIn: (next?: string) => (next ? `/signin?next=${encodeURIComponent(next)}` : '/signin'),
  signUp: (next?: string) => (next ? `/signup?next=${encodeURIComponent(next)}` : '/signup'),
};
