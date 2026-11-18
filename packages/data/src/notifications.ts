import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { components, paths } from '@whyme/api-client';
import { unwrap, useApi } from './api';
import { useOfflineFetcher } from './offline';

/**
 * The in-app notifications (NOT01, NOT02): the record of what WHY ME told the person. Texts and
 * push are best-effort copies; this list is always there, and the first page opens offline.
 */

export type AppNotification = components['schemas']['NotificationResource'];
export type NotificationPreferences = paths['/v1/me/notification-preferences']['get']['responses'][200]['content']['application/json']['data'];
export type NotificationPreferencesPatch = Partial<Pick<NotificationPreferences, 'requests' | 'jobs' | 'listings' | 'plans' | 'sms'>>;

interface NotificationPage {
  items: AppNotification[];
  next: string | null;
}

export const notificationKeys = {
  all: ['me', 'notifications'] as const,
  list: ['me', 'notifications', 'list'] as const,
  unread: ['me', 'notifications', 'unread'] as const,
  preferences: ['me', 'notifications', 'preferences'] as const,
};

function cursorOf(next: string | null | undefined): string | null {
  return next ? new URL(next, 'http://localhost').searchParams.get('cursor') : null;
}

/** Newest first, 20 at a time. */
export function useNotifications(enabled = true) {
  const api = useApi();
  const fetchPage = async (cursor: string | null): Promise<NotificationPage> => {
    // The cursor isn't in the generated query types.
    const query = (cursor ? { cursor } : {}) as never;
    const body = unwrap(await api.GET('/v1/me/notifications', { params: { query } }));
    return { items: body.data, next: (body as { links?: { next?: string | null } }).links?.next ?? null };
  };
  const firstPage = useOfflineFetcher('notifications', 'first', () => fetchPage(null));
  return useInfiniteQuery({
    queryKey: notificationKeys.list,
    initialPageParam: null as string | null,
    getNextPageParam: (last: NotificationPage) => cursorOf(last.next),
    queryFn: ({ pageParam }) => (pageParam ? fetchPage(pageParam) : firstPage()),
    enabled,
  });
}

/** For the bell. Checked every minute; a live signal refreshes it at once when Pusher is on. */
export function useUnreadNotifications(enabled: boolean) {
  const api = useApi();
  return useQuery({
    queryKey: notificationKeys.unread,
    queryFn: async () => Number(unwrap(await api.GET('/v1/me/notifications/unread')).data.count) || 0,
    enabled,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
}

export async function markNotificationRead(api: ReturnType<typeof useApi>, id: string): Promise<AppNotification> {
  return unwrap(await api.POST('/v1/me/notifications/{notification}/read', { params: { path: { notification: id } } })).data;
}

export async function markAllNotificationsRead(api: ReturnType<typeof useApi>): Promise<void> {
  unwrap(await api.POST('/v1/me/notifications/read-all'));
}

export function useNotificationPreferences(enabled = true) {
  const api = useApi();
  return useQuery({
    queryKey: notificationKeys.preferences,
    queryFn: async () => unwrap(await api.GET('/v1/me/notification-preferences')).data,
    enabled,
  });
}

export async function saveNotificationPreferences(api: ReturnType<typeof useApi>, patch: NotificationPreferencesPatch): Promise<NotificationPreferences> {
  return unwrap(await api.PUT('/v1/me/notification-preferences', { body: patch })).data;
}
