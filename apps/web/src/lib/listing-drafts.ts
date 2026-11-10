'use client';

import { liveQuery } from 'dexie';
import { useLiveQuery } from 'dexie-react-hooks';
import type { OutboxAction } from '@whyme/sync';
import type { ListingKind, OwnerListing } from '@whyme/data';
import {
  isUploadRef,
  LISTING_ENTITY,
  recordOf,
  UPLOAD_ENTITY,
  type ListingContent,
  type ListingDraftPayload,
  type PhotoRef,
  type PhotoUploadPayload,
} from './listing-queue';
import { useAccountRuntime } from './offline';
import type { WebSync } from './sync';

/**
 * Listing drafts saved on this device and not yet confirmed by the server (OFF05).
 * The send queue is the only copy: each save is one queued action (changed in place
 * while that's safe, otherwise a follow-up), with its photos as upload actions before it.
 */

export type DraftStatus = 'waiting' | 'sending' | 'needs_auth' | 'conflict' | 'in_review' | 'rejected' | 'photo_rejected';

export interface ListingDraft {
  localId: string;
  kind: ListingKind;
  /** Saves not yet confirmed, oldest first. The last one holds the latest content. */
  unsent: OutboxAction[];
  /** What the seller saved most recently. */
  payload: ListingDraftPayload;
  /** Null once everything was sent. */
  status: DraftStatus | null;
  /** The action that needs the seller (refused, or changed elsewhere), with the server's reply. */
  problem: OutboxAction | null;
  /** The listing as the server last confirmed it through the queue. */
  record: OwnerListing | null;
  /** The listing's server ID, once known. */
  listingId: string | null;
  /** Upload actions by action ID, for restoring photo tiles. */
  uploads: Map<string, OutboxAction>;
}

/** The queue's key for an existing listing: its client ID when it was created with one, so a draft and its later edits match. */
export function draftIdOf(listing: Pick<OwnerListing, 'id' | 'client_id'>): string {
  return listing.client_id ?? listing.id;
}

const byCreated = (a: OutboxAction, b: OutboxAction) => a.createdAt - b.createdAt || (a.actionId < b.actionId ? -1 : 1);

function summarize(all: OutboxAction[]): ListingDraft[] {
  const uploads = new Map(all.filter((a) => a.entityType === UPLOAD_ENTITY).map((a) => [a.actionId, a]));
  const groups = new Map<string, OutboxAction[]>();
  for (const action of all) {
    if (action.entityType !== LISTING_ENTITY) continue;
    groups.set(action.localId, [...(groups.get(action.localId) ?? []), action]);
  }

  return [...groups.entries()].map(([localId, actions]) => {
    actions.sort(byCreated);
    const unsent = actions.filter((a) => a.state !== 'acked');
    const acked = actions.filter((a) => a.state === 'acked').sort((a, b) => (a.ackedAt ?? 0) - (b.ackedAt ?? 0));
    const lastAcked = acked.at(-1);
    const payload = (unsent.at(-1) ?? actions.at(-1))!.payload as ListingDraftPayload;
    const record = recordOf(lastAcked);
    const deps = unsent.flatMap((a) => a.dependsOn.map((id) => uploads.get(id))).filter((a): a is OutboxAction => Boolean(a));

    let status: DraftStatus | null = null;
    let problem: OutboxAction | null = null;
    if (unsent.length > 0) {
      const refusedPhoto = deps.find((a) => a.state === 'rejected');
      const conflict = unsent.find((a) => a.state === 'conflict');
      const rejected = unsent.find((a) => a.state === 'rejected');
      if (conflict) [status, problem] = [conflict.lastErrorCode === 'in_review' ? 'in_review' : 'conflict', conflict];
      else if (rejected) [status, problem] = ['rejected', rejected];
      else if (refusedPhoto) [status, problem] = ['photo_rejected', refusedPhoto];
      else if ([...unsent, ...deps].some((a) => a.state === 'needs_auth')) status = 'needs_auth';
      else if ([...unsent, ...deps].some((a) => a.state === 'sending')) status = 'sending';
      else status = 'waiting';
    }

    return {
      localId,
      kind: payload.kind,
      unsent,
      payload,
      status,
      problem,
      record,
      listingId: payload.listing_id ?? record?.id ?? lastAcked?.serverId ?? null,
      uploads,
    };
  });
}

function useOutbox(): OutboxAction[] | undefined {
  const sync = useAccountRuntime();
  return useLiveQuery(async () => (sync ? sync.db.outbox.where('accountId').equals(sync.accountId).toArray() : []), [sync]);
}

/** Drafts with something still to send, newest first (undefined while loading). */
export function useListingDrafts(): ListingDraft[] | undefined {
  const all = useOutbox();
  if (!all) return undefined;
  return summarize(all)
    .filter((draft) => draft.unsent.length > 0)
    .sort((a, b) => b.payload.savedAt - a.payload.savedAt);
}

/** One draft by its queue key: undefined while loading, null when this device has none. */
export function useListingDraft(localId: string | null): ListingDraft | null | undefined {
  const all = useOutbox();
  if (!localId) return null;
  if (!all) return undefined;
  return summarize(all).find((draft) => draft.localId === localId) ?? null;
}

/** Calls `onChange` with the draft now and after every change to the queue. Returns the unsubscribe. */
export function watchListingDraft(sync: WebSync, localId: string, onChange: (draft: ListingDraft | null) => void): () => void {
  const subscription = liveQuery(() => sync.db.outbox.where('accountId').equals(sync.accountId).toArray()).subscribe({
    next: (all) => onChange(summarize(all).find((draft) => draft.localId === localId) ?? null),
    error: () => undefined,
  });
  return () => subscription.unsubscribe();
}

/** A photo tile as the editor holds it (see PhotoPicker). */
export interface DraftPhoto {
  key: string;
  id: string | null;
  state: string;
  preview: string | null;
  file?: Blob;
  upload?: string;
}

/**
 * Saves the editor's content into the queue. Returns the upload action for each
 * photo that waits for a connection, so the editor doesn't queue it twice.
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
  },
): Promise<{ uploads: Record<string, string> }> {
  const { engine } = sync;
  const uploads: Record<string, string> = {};
  const photos: PhotoRef[] = [];
  for (const item of input.photos) {
    if (item.id && item.state !== 'failed') {
      photos.push({ id: item.id, preview: item.preview?.startsWith('blob:') ? null : item.preview });
    } else if (item.state === 'waiting' && item.file) {
      const payload: PhotoUploadPayload = { client_id: item.key, file: item.file, name: item.file instanceof File ? item.file.name : 'photo.jpg' };
      const upload =
        item.upload ?? (await engine.enqueue({ entityType: UPLOAD_ENTITY, localId: item.key, actionType: 'upload.photo', payload })).actionId;
      uploads[item.key] = upload;
      photos.push({ upload, key: item.key });
    }
  }
  const photoDeps = photos.filter(isUploadRef).map((ref) => ref.upload);

  const all = await engine.unsent();
  const unsent = all.filter((a) => a.entityType === LISTING_ENTITY && a.localId === input.localId);
  const replacedDeps = unsent.flatMap((a) => a.dependsOn);
  const base = (after: string | null, listingId: string | null): ListingDraftPayload => ({
    kind: input.kind,
    client_id: input.localId,
    listing_id: listingId ?? input.listingId,
    after,
    content: input.content,
    photos,
    savedAt: Date.now(),
  });

  if (unsent.length === 0) {
    const update = input.listingId !== null;
    await engine.enqueue({
      entityType: LISTING_ENTITY,
      localId: input.localId,
      actionType: update ? 'listing.update' : 'listing.create',
      payload: base(null, null),
      baseVersion: update ? input.baseVersion : null,
      dependsOn: photoDeps,
    });
  } else {
    const first = unsent[0];
    const firstPayload = first.payload as ListingDraftPayload;
    // An edit refused as out of date is resent against the latest version.
    const firstVersion = first.state === 'conflict' || !firstPayload.after ? (first.actionType === 'listing.create' ? null : input.baseVersion) : null;
    const deps = (after: string | null) => [...(after ? [after] : []), ...photoDeps];

    if (await engine.revise(first.actionId, { payload: base(firstPayload.after, firstPayload.listing_id), baseVersion: firstVersion, dependsOn: deps(firstPayload.after) })) {
      for (const later of unsent.slice(1)) await engine.discard(later.actionId);
    } else {
      // The first is being sent, or may have arrived with its reply lost: add (or update) a follow-up after it.
      const last = unsent[unsent.length - 1];
      const lastPayload = last.payload as ListingDraftPayload;
      const revisedLast =
        last !== first &&
        (await engine.revise(last.actionId, { payload: base(lastPayload.after, lastPayload.listing_id), dependsOn: deps(lastPayload.after) }));
      if (!revisedLast) {
        await engine.enqueue({
          entityType: LISTING_ENTITY,
          localId: input.localId,
          actionType: 'listing.update',
          payload: base(last.actionId, lastPayload.listing_id),
          baseVersion: null,
          dependsOn: deps(last.actionId),
        });
      }
    }
  }

  await dropUnusedUploads(sync, replacedDeps);
  await sync.controller.refresh().catch(() => undefined);
  return { uploads };
}

/** Throws away what this device still had to send for one listing (its photos too). */
export async function discardListingDraft(sync: WebSync, localId: string): Promise<void> {
  const unsent = (await sync.engine.unsent()).filter((a) => a.entityType === LISTING_ENTITY && a.localId === localId);
  for (const action of unsent) await sync.engine.discard(action.actionId);
  await dropUnusedUploads(
    sync,
    unsent.flatMap((a) => a.dependsOn),
  );
  await sync.controller.refresh().catch(() => undefined);
}

/** Unsent uploads among `candidates` that no waiting save needs any more (a photo removed before it was sent). */
async function dropUnusedUploads(sync: WebSync, candidates: string[]): Promise<void> {
  const unsent = await sync.engine.unsent();
  const needed = new Set(unsent.filter((a) => a.entityType !== UPLOAD_ENTITY).flatMap((a) => a.dependsOn));
  for (const action of unsent) {
    if (action.entityType === UPLOAD_ENTITY && candidates.includes(action.actionId) && !needed.has(action.actionId)) {
      await sync.engine.discard(action.actionId);
    }
  }
}
