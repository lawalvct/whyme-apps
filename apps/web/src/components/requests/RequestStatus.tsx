'use client';

import type { RequestStatus, ServiceRequest } from '@whyme/data';
import { Badge } from '@/components/ui/badge';
import { formatNaira } from '@/lib/format';
import { useT } from '@/lib/i18n';

type T = (key: string, options?: Record<string, unknown>) => string;

function optional(t: T, key: string, options?: Record<string, unknown>): string | undefined {
  const text = t(key, options);
  return text && text !== key ? text : undefined;
}

/**
 * The service request's status worded for the customer or the provider (REQ02).
 */
export function requestStatusLabel(t: T, request: Pick<ServiceRequest, 'role'>, status: RequestStatus | string): string {
  const own = request.role === 'provider' ? 'statusProvider' : 'statusCustomer';
  return optional(t, `${own}.${status}`) ?? optional(t, `status.${status}`) ?? status;
}

/**
 * One step in the request's status history, including versioned quotes.
 */
export function requestEventLabel(
  t: T,
  event: { to: string; actor: string; quote_version?: number | null; amount_kobo?: number | null },
): string {
  const options =
    event.amount_kobo != null
      ? { version: event.quote_version ?? undefined, amount: formatNaira(event.amount_kobo) }
      : undefined;
  return optional(t, `event.${event.to}`, options) ?? event.to;
}

export function RequestStatusBadge({ request }: { request: ServiceRequest }) {
  const { t } = useT('requests');
  const status = request.status;
  const quoteWaitingOnCustomer =
    (status === 'submitted' || status === 'accepted') &&
    request.accepted_quote_id === null &&
    request.latest_quote?.status === 'sent';
  const waitingOnViewer =
    (request.role === 'provider' &&
      (status === 'submitted' ||
        status === 'in_progress' ||
        (status === 'accepted' && !quoteWaitingOnCustomer))) ||
    (request.role === 'customer' && (status === 'completion_submitted' || quoteWaitingOnCustomer));
  const tone =
    status === 'held' || status === 'declined' || status === 'cancelled' || status === 'rejected'
      ? 'warning'
      : waitingOnViewer
        ? 'accent'
        : status === 'completed'
          ? 'neutral'
          : 'primary';

  return <Badge tone={tone}>{requestStatusLabel(t, request, status)}</Badge>;
}
