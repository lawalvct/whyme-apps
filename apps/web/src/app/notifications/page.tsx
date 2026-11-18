import type { Metadata } from 'next';
import { Suspense } from 'react';
import { NotificationsView } from '@/components/notifications/NotificationsView';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = {
  title: 'Notifications',
  robots: { index: false, follow: false },
};

/** Private to the signed-in user: rendered in the browser, never on the server. */
export default function NotificationsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <NotificationsView />
    </Suspense>
  );
}
