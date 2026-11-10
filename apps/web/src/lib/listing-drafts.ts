'use client';

import type { ListingKind, OwnerListing } from '@whyme/data';
import { LISTING_ENTITY, type ListingContent, type ListingDraftPayload, type ListingSubmitPayload } from './listing-queue';
import {
  discardRecordDraft,
  latestRecord,
  queuePhotos,
  saveChain,
  uploadDeps,
  useRecordDraft,
  useRecordDrafts,
  watchRecordDraft,
  type DraftKind,
  type DraftPhoto,
  type DraftStatus,
  type RecordDraft,
} from './record-drafts';
import type { WebSync } from './sync';

/** Listing drafts saved on this device and not yet confirmed (see record-drafts.ts). */

export type { DraftPhoto, DraftStatus };

export const LISTING_DRAFTS: DraftKind = { entity: LISTING_ENTITY, submitType: 'listing.submit' };

export type ListingDraft = RecordDraft<ListingDraftPayload, OwnerListing> & {
  kind: ListingKind;
  /** The listing's server ID, once known. */
  listingId: string | null;
};

function withListing(draft: RecordDraft<ListingDraftPayload, OwnerListing>): ListingDraft {
  return { ...draft, kind: draft.payload.kind, listingId: draft.payload.listing_id ?? draft.record?.id ?? null };
}

/** The queue's key for an existing listing: its client ID when it was created with one, so a draft and its later edits match. */
export function draftIdOf(listing: Pick<OwnerListing, 'id' | 'client_id'>): string {
  return listing.client_id ?? listing.id;
}

/** Drafts with something still to send, newest first (undefined while loading). */
export function useListingDrafts(): ListingDraft[] | undefined {
  return useRecordDrafts<ListingDraftPayload, OwnerListing>(LISTING_DRAFTS)?.map(withListing);
}

/** One draft by its queue key: undefined while loading, null when this device has none. */
export function useListingDraft(localId: string | null): ListingDraft | null | undefined {
  const draft = useRecordDraft<ListingDraftPayload, OwnerListing>(LISTING_DRAFTS, localId);
  return draft ? withListing(draft) : draft;
}

export function watchListingDraft(sync: WebSync, localId: string, onChange: (draft: ListingDraft | null) => void): () => void {
  return watchRecordDraft<ListingDraftPayload, OwnerListing>(sync, LISTING_DRAFTS, localId, (draft) => onChange(draft ? withListing(draft) : null));
}

/**
 * Saves the editor's content into the queue, with a Publish after it when asked. Returns the
 * upload action for each photo that waits for a connection, so the editor doesn't queue it twice.
 */
export async function saveListingDraft(
  sync: WebSync,
  input: {
    localId: string;
    kind: ListingKind;
    listingId: string | null;
    /** The version the edit is based on: the listing as loaded, or the latest after a conflict. */
    baseVersion: number | null;
    content: ListingContent;
    photos: DraftPhoto[];
    publish: boolean;
  },
): Promise<{ uploads: Record<string, string> }> {
  const { refs, uploads } = await queuePhotos(sync, input.photos);
  // An earlier queued save may have created or changed it since the editor loaded it.
  const known = await latestRecord(sync, LISTING_DRAFTS, input.localId);
  const listingId = input.listingId ?? known?.id ?? null;
  const baseVersion = known && known.id === listingId && known.version > (input.baseVersion ?? 0) ? known.version : input.baseVersion;

  await saveChain<ListingDraftPayload>(sync, LISTING_DRAFTS, {
    localId: input.localId,
    firstType: listingId ? 'listing.update' : 'listing.create',
    createType: 'listing.create',
    followUpType: 'listing.update',
    baseVersion,
    payload: (after, previous) => ({
      kind: input.kind,
      client_id: input.localId,
      listing_id: previous?.listing_id ?? listingId,
      after,
      content: input.content,
      photos: refs,
      savedAt: Date.now(),
    }),
    photoDeps: uploadDeps(refs),
    publish: input.publish,
    submitPayload: (after): ListingSubmitPayload => ({ listing_id: listingId, after }),
  });
  return { uploads };
}

/** Throws away what this device still had to send for one listing (its photos too). */
export async function discardListingDraft(sync: WebSync, localId: string): Promise<void> {
  await discardRecordDraft(sync, LISTING_DRAFTS, localId);
}
