import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AccountView } from '@/components/account/AccountView';
import { RequireAccount } from '@/components/auth/RequireAccount';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = { title: 'Your account', robots: { index: false, follow: false } };

export default function AccountPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <RequireAccount>
        <AccountView />
      </RequireAccount>
    </Suspense>
  );
}
