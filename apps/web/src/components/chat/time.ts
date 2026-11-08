/** "14:05" today, "Yesterday", or "7 Nov" (with the year when it isn't this year). */
export function chatTime(iso: string | null | undefined, language: string, labels: { yesterday: string }): string {
  if (!iso) return '';
  const date = new Date(iso);
  const now = new Date();
  const locale = language === 'ig' ? 'ig-NG' : 'en-NG';
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (sameDay(date, now)) return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(date);
  if (sameDay(date, yesterday)) return labels.yesterday;
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  }).format(date);
}

/** Time of day only, for message bubbles. */
export function bubbleTime(iso: string, language: string): string {
  return new Intl.DateTimeFormat(language === 'ig' ? 'ig-NG' : 'en-NG', { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}
