'use client';

import { useMe, type Me } from '@whyme/data';

/**
 * Who is signed in, from GET /v1/me with the cookie session. A 401 simply means
 * signed out; it isn't retried.
 */
export function useAccount(): { user: Me | null; status: 'unknown' | 'signed_in' | 'signed_out' } {
  const me = useMe(true);
  if (me.isPending) return { user: null, status: 'unknown' };
  return me.data ? { user: me.data, status: 'signed_in' } : { user: null, status: 'signed_out' };
}
