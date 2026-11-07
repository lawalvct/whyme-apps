'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys, signedIn, type Me } from '@whyme/data';

/** Only same-site paths, so `?next=` can't send people to another website. */
export function safeNext(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

/** After sign-in or sign-up: remember who it is and go back where they came from. */
export function useAuthDone() {
  const router = useRouter();
  const params = useSearchParams();
  const queryClient = useQueryClient();

  return (user: Me) => {
    queryClient.setQueryData(queryKeys.me, user);
    signedIn(user);
    // Server-rendered pages are public and don't depend on who is signed in, so no refresh is needed.
    router.replace(safeNext(params.get('next')));
  };
}

export function useNextParam(): string | undefined {
  const next = useSearchParams().get('next');
  return next ? safeNext(next) : undefined;
}
