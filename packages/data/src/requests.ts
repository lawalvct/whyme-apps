import { useQuery } from '@tanstack/react-query';
import type { components } from '@whyme/api-client';
import { unwrap, useApi } from './api';
import { useOfflineFetcher } from './offline';

export type ServiceRequest = components['schemas']['ServiceRequestResource'];
export type ServiceQuote = ServiceRequest['quotes'][number];
export type QuoteStatus = ServiceQuote['status'];
export type RequestStatus = components['schemas']['RequestStatus'];
export type PreferredTime = NonNullable<ServiceRequest['preferred_time']>;
export type ServiceRequestAction = components['schemas']['ServiceRequestActionRequest'];
export type StoreServiceRequest = components['schemas']['StoreServiceRequestRequest'];
export type SendServiceQuote = components['schemas']['SendServiceQuoteRequest'];

export const requestKeys = {
  all: ['me', 'requests'] as const,
  counts: ['me', 'requests', 'counts'] as const,
  list: (role: 'customer' | 'provider', status?: RequestStatus) => ['me', 'requests', role, status ?? 'all'] as const,
  request: (id: string) => ['me', 'requests', 'request', id] as const,
};

/**
 * One service request (REQ01, REQ02) with its status history. Kept on the device, so a customer
 * or provider can still read it when the connection drops.
 */
export function useServiceRequest(id: string) {
  const api = useApi();
  const fetchRequest = useOfflineFetcher('service-request', id, async () =>
    unwrap(await api.GET('/v1/requests/{serviceRequest}', { params: { path: { serviceRequest: id } } })).data,
  );
  return useQuery({ queryKey: requestKeys.request(id), queryFn: fetchRequest });
}

/**
 * Requests requested by the customer (`role = 'customer'`) or received by the provider
 * (`role = 'provider'`). Kept on the device for offline reading.
 */
export function useServiceRequests(role: 'customer' | 'provider', status?: RequestStatus) {
  const api = useApi();
  const key = `${role}:${status ?? 'all'}`;
  const fetchRequests = useOfflineFetcher('service-requests', key, async () => {
    const query = { role, ...(status ? { status } : {}) };
    return unwrap(await api.GET('/v1/me/requests', { params: { query } })).data;
  });
  return useQuery({ queryKey: requestKeys.list(role, status), queryFn: fetchRequests });
}

/**
 * Header and Seller Centre badge counts: requests waiting on a customer's confirmation,
 * and requests waiting on a provider to accept, start, or finish.
 */
export function useServiceRequestCounts(enabled: boolean) {
  const api = useApi();
  return useQuery({
    queryKey: requestKeys.counts,
    queryFn: async () => unwrap(await api.GET('/v1/me/requests/counts')).data,
    enabled,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
}
