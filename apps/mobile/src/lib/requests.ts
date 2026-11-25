import type { ServiceRequest } from '@whyme/data';

type Tone = 'gold' | 'green' | 'grey' | 'red';

/** A request's status in the reader's own words (the provider and the customer see some steps differently). */
export function requestStatus(request: ServiceRequest, t: (key: string, options?: Record<string, unknown>) => string): { label: string; tone: Tone } {
  const s = request.status;
  const own = request.role === 'provider' ? `requests:statusProvider.${s}` : `requests:statusCustomer.${s}`;
  const label = t(own, { defaultValue: t(`requests:status.${s}`) });
  const tone: Tone = s === 'completed' ? 'green' : s === 'cancelled' || s === 'declined' ? 'grey' : s === 'rejected' ? 'red' : 'gold';
  return { label, tone };
}
