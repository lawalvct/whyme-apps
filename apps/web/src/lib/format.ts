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

/** "1500" or "1,500.50" naira typed by a seller → kobo. Null when empty or not a number. */
export function nairaToKobo(input: string): number | null {
  const cleaned = input.replace(/[₦,\s]/g, '');
  if (cleaned === '') return null;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return Number.NaN;
  return Math.round(Number(cleaned) * 100);
}

/** Kobo → "1500" or "1500.50" for an editable price field. */
export function koboToNaira(kobo: number | null | undefined): string {
  if (kobo === null || kobo === undefined) return '';
  return kobo % 100 === 0 ? String(kobo / 100) : (kobo / 100).toFixed(2);
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
  sell: '/sell',
  sellProfile: (kind: 'business' | 'provider') => `/sell/profile/${kind}`,
  sellListings: (status?: string) => (status ? `/sell/listings?status=${status}` : '/sell/listings'),
  newListing: (kind: 'product' | 'service') => `/sell/listings/new?kind=${kind}`,
  editListing: (id: string) => `/sell/listings/${id}`,
  signIn: (next?: string) => (next ? `/signin?next=${encodeURIComponent(next)}` : '/signin'),
  signUp: (next?: string) => (next ? `/signup?next=${encodeURIComponent(next)}` : '/signup'),
};
