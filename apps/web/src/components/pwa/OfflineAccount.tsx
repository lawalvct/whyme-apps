'use client';

import { useEffect } from 'react';
import { rememberAccount } from '@/lib/offline';
import { useAccount } from '@/lib/session';

/** Opens the signed-in account's browser database and send queue as soon as we know who it is. */
export function OfflineAccount() {
  const { user } = useAccount();
  useEffect(() => {
    if (user) rememberAccount(user);
  }, [user]);
  return null;
}
