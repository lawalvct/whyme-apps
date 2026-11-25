/** ₦189,000 from kobo. Whole naira unless there are kobo. Grouped by hand so it works on every engine. */
export function formatNaira(kobo: number | null | undefined): string {
  if (kobo == null) return '';
  const naira = kobo / 100;
  const [whole, fraction] = (Number.isInteger(naira) ? String(naira) : naira.toFixed(2)).split('.');
  return `₦${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${fraction ? `.${fraction}` : ''}`;
}

/** "19 Nov 2026": dates as Nigerians write them, in the app's language. */
export function formatDate(iso: string, language: string): string {
  return new Intl.DateTimeFormat(language === 'ig' ? 'ig-NG' : 'en-NG', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Lagos' }).format(new Date(iso));
}

/** "20 Nov 2026, 4:08 pm": when something happened, in Lagos time. */
export function formatDateTime(iso: string, language: string): string {
  return new Intl.DateTimeFormat(language === 'ig' ? 'ig-NG' : 'en-NG', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Lagos' }).format(new Date(iso));
}

/** "18,500" or "18500.50" typed by a seller → kobo. Null when empty, NaN when not a number. */
export function nairaToKobo(input: string): number | null {
  const cleaned = input.replace(/[₦,\s]/g, '');
  if (cleaned === '') return null;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return Number.NaN;
  return Math.round(Number(cleaned) * 100);
}

/** Digits with thousands commas while typing a price. */
export function groupDigits(input: string): string {
  const [whole, fraction] = input.replace(/[^\d.]/g, '').split('.');
  const grouped = (whole ?? '').replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fraction !== undefined ? `${grouped}.${fraction.slice(0, 2)}` : grouped;
}
