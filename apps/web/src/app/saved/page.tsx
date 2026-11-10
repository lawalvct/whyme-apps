import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SavedView } from '@/components/pages/SavedView';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = {
  title: 'Saved items',
  robots: { index: false, follow: false },
};

/** Private to the signed-in user: rendered in the browser from the account's copy, never on the server. */
export default function SavedPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <SavedView />
    </Suspense>
  );
}
