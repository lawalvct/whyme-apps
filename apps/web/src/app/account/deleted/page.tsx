import type { Metadata } from 'next';
import { AccountDeletedNotice } from '@/components/account/AccountDeletedNotice';

export const metadata: Metadata = { title: 'Account deleted', robots: { index: false, follow: false } };

/** Shown after an account is deleted; the browser has already forgotten the account. */
export default function AccountDeletedPage() {
  return <AccountDeletedNotice />;
}
