const naira = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 });

/** ₦145,000 from 14500000 kobo. Money is always kobo in the API (PAY06). */
export function formatNaira(kobo: number): string {
  return naira.format(kobo / 100);
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
  /**
   * Readable addresses made from the name: /listings/infinix-hot-40i, /p/ada-phones. Links
   * that only know the ID (an order, a chat) use it; the page then redirects to the slug.
   */
  listing: (listing: { id: string; slug?: string | null }) => `/listings/${listing.slug || listing.id}`,
  profile: (profile: { id: string; slug?: string | null }) => `/p/${profile.slug || profile.id}`,
  messages: '/messages',
  saved: '/saved',
  conversation: (id: string) => `/messages/${id}`,
  checkout: (listingId: string) => `/checkout/${listingId}`,
  orders: (tab?: 'sold') => (tab ? `/orders?tab=${tab}` : '/orders'),
  order: (id: string) => `/orders/${id}`,
  sell: '/sell',
  sellPayouts: '/sell/payouts',
  sellProfile: (kind: 'business' | 'provider') => `/sell/profile/${kind}`,
  sellListings: (status?: string) => (status ? `/sell/listings?status=${status}` : '/sell/listings'),
  newListing: (kind: 'product' | 'service') => `/sell/listings/new?kind=${kind}`,
  /** A new listing saved on this device and not yet sent (offline draft). */
  listingDraft: (kind: 'product' | 'service', draftId: string) => `/sell/listings/new?kind=${kind}&draft=${encodeURIComponent(draftId)}`,
  editListing: (id: string) => `/sell/listings/${id}`,
  signIn: (next?: string) => (next ? `/signin?next=${encodeURIComponent(next)}` : '/signin'),
  signUp: (next?: string) => (next ? `/signup?next=${encodeURIComponent(next)}` : '/signup'),
};
