import { router } from 'expo-router';
import { useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ensureOk, savedKeys, useApi, useSavedListings } from '@whyme/data';
import { useAccount } from './session';

/** Which listings this person saved, and a toggle (signed-out people go to sign-in first). */
export function useSaveToggle() {
  const api = useApi();
  const queryClient = useQueryClient();
  const { status } = useAccount();
  const saved = useSavedListings(status === 'signed_in');
  const ids = new Set((saved.data ?? []).map((l) => l.id));
  const busy = useRef(new Set<string>());

  async function toggle(listingId: string) {
    if (status !== 'signed_in') {
      router.push('/sign-in');
      return;
    }
    // One tap, one request: a second tap while saving is ignored.
    if (busy.current.has(listingId)) return;
    busy.current.add(listingId);
    try {
      const path = { params: { path: { listing: listingId } } };
      ensureOk(ids.has(listingId) ? await api.DELETE('/v1/me/saved/{listing}', path) : await api.PUT('/v1/me/saved/{listing}', path));
      await queryClient.invalidateQueries({ queryKey: savedKeys.all });
    } finally {
      busy.current.delete(listingId);
    }
  }

  return { isSaved: (id: string) => ids.has(id), toggle, saved };
}
