import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { savedKeys, useSavedListings, type PublicListing } from '@whyme/data';
import { useAccountRuntime } from './offline';
import { useAccount } from './session';

/**
 * Saved items on the website. Saving works offline: the change shows at once, is kept in
 * the account's database, and goes out through the send queue (PUT / DELETE, safe to resend).
 */
export function useSaved() {
  const { user } = useAccount();
  const saved = useSavedListings(Boolean(user));
  const sync = useAccountRuntime();
  const queryClient = useQueryClient();

  const isSaved = useCallback((id: string) => saved.data?.some((listing) => listing.id === id) ?? false, [saved.data]);

  const toggle = useCallback(
    async (listing: PublicListing, save: boolean) => {
      if (!sync) return;
      const list = queryClient.getQueryData<PublicListing[]>(savedKeys.all) ?? [];
      const next = save ? [listing, ...list.filter((item) => item.id !== listing.id)] : list.filter((item) => item.id !== listing.id);
      queryClient.setQueryData(savedKeys.all, next);
      await sync.db.cache('saved', 'listings', next).catch(() => undefined);
      await sync.engine.enqueue({
        entityType: 'saved_listing',
        localId: listing.id,
        actionType: save ? 'saved.add' : 'saved.remove',
        payload: { listing_id: listing.id },
      });
      if (!navigator.onLine) {
        await sync.controller.refresh();
        return;
      }
      const result = await sync.controller.run();
      if (result.status === 'done') void queryClient.invalidateQueries({ queryKey: savedKeys.all });
    },
    [sync, queryClient],
  );

  return { saved, isSaved, toggle, signedIn: Boolean(user) };
}
