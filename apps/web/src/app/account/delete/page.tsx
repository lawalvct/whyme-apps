import type { Metadata } from 'next';
import { Suspense } from 'react';
import { DeleteAccountView } from '@/components/account/DeleteAccountView';
import { RequireAccount } from '@/components/auth/RequireAccount';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = { title: 'Delete your account', robots: { index: false, follow: false } };

export default function DeleteAccountPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <RequireAccount>
        <DeleteAccountView />
      </RequireAccount>
    </Suspense>
  );
}
