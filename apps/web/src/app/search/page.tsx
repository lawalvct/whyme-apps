import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SearchView } from '@/components/pages/SearchView';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = {
  title: 'Search',
  // Results change by the minute and depend on the query: listing pages are what get indexed.
  robots: { index: false, follow: true },
};

/** Search and browse. Runs in the browser: filters are in the URL and results need a connection. */
export default function SearchPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <SearchView />
    </Suspense>
  );
}
