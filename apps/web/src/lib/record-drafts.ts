'use client';

import { liveQuery } from 'dexie';
import { useLiveQuery } from 'dexie-react-hooks';
import type { OutboxAction } from '@whyme/sync';
import { isUploadRef, UPLOAD_ENTITY, type PhotoRef, type PhotoUploadPayload } from './listing-queue';
import { useAccountRuntime } from './offline';
import type { WebSync } from './sync';

/**
 * Edits saved on this device and not yet confirmed (OFF05), for any record with a
 * version and a "submit for review" step: listings, business and provider pages.
 *
 * The send queue is the only copy. Each record's actions share one queue key, so they
 * go in order: photo uploads first, then the save (changed in place while that's safe,
 * otherwise a follow-up that reads the server ID and version from the earlier reply),
 * then, if the seller tapped Publish, the submit.
 */

export type DraftStatus = 'waiting' | 'sending' | 'needs_auth' | 'conflict' | 'in_review' | 'rejected' | 'photo_rejected';

/** What every queued save carries. */
export interface SavePayloadBase {
  /** An earlier, still unconfirmed save of this record: its reply gives the server ID and version. */
  after: string | null;
  savedAt: number;
}

/** The queue's names for one kind of record. */
export interface DraftKind {
  entity: string;
  /** "Publish" after the save; every other action type of the entity is a save. */
  submitType: string;
}

export interface RecordDraft<P extends SavePayloadBase, R> {
  localId: string;
  /** Saves and submits not yet confirmed, oldest first. */
  unsent: OutboxAction[];
  /** What the seller saved most recently. */
  payload: P;
  /** Publish was tapped and is waiting too. */
  publishQueued: boolean;
  /** Null once everything was sent. */
  status: DraftStatus | null;
  /** The action that needs the seller (refused, or changed elsewhere), with the server's reply. */
  problem: OutboxAction | null;
  /** The record as the server last confirmed it through the queue. */
  record: R | null;
  /** Upload actions by action ID, for restoring photo tiles. */
  uploads: Map<string, OutboxAction>;
}

const byCreated = (a: OutboxAction, b: OutboxAction) => a.createdAt - b.createdAt || (a.actionId < b.actionId ? -1 : 1);

/** Never sent, or refused by the server: safe to change or drop. */
const changeable = (a: OutboxAction) => (a.state === 'queued' && a.attempts === 0) || a.state === 'rejected' || a.state === 'conflict';

/** The saved record in an acked action's reply. */
export function replyRecord<R>(action: OutboxAction | undefined): R | null {
  const body = action?.lastResponse as { data?: unknown } | null | undefined;
  return body?.data && typeof body.data === 'object' && 'id' in body.data ? (body.data as R) : null;
}

function summarize<P extends SavePayloadBase, R>(all: OutboxAction[], kind: DraftKind): RecordDraft<P, R>[] {
  const uploads = new Map(all.filter((a) => a.entityType === UPLOAD_ENTITY).map((a) => [a.actionId, a]));
  const groups = new Map<string, OutboxAction[]>();
  for (const action of all) {
    if (action.entityType !== kind.entity) continue;
    groups.set(action.localId, [...(groups.get(action.localId) ?? []), action]);
  }

  const drafts: RecordDraft<P, R>[] = [];
  for (const [localId, actions] of groups) {
    actions.sort(byCreated);
    const saves = actions.filter((a) => a.actionType !== kind.submitType);
    if (saves.length === 0) continue;
    const unsent = actions.filter((a) => a.state !== 'acked');
    const lastAcked = actions.filter((a) => a.state === 'acked').sort((a, b) => (a.ackedAt ?? 0) - (b.ackedAt ?? 0)).at(-1);
    const payload = (saves.filter((a) => a.state !== 'acked').at(-1) ?? saves.at(-1))!.payload as P;
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

    drafts.push({
      localId,
      unsent,
      payload,
      publishQueued: unsent.some((a) => a.actionType === kind.submitType),
      status,
      problem,
      record: replyRecord<R>(lastAcked),
      uploads,
    });
  }
  return drafts;
}

function useOutbox(): OutboxAction[] | undefined {
  const sync = useAccountRuntime();
  return useLiveQuery(async () => (sync ? sync.db.outbox.where('accountId').equals(sync.accountId).toArray() : []), [sync]);
}

/** Records with something still to send, newest first (undefined while loading). */
export function useRecordDrafts<P extends SavePayloadBase, R>(kind: DraftKind): RecordDraft<P, R>[] | undefined {
  const all = useOutbox();
  if (!all) return undefined;
  return summarize<P, R>(all, kind)
    .filter((draft) => draft.unsent.length > 0)
    .sort((a, b) => b.payload.savedAt - a.payload.savedAt);
}

/** One record's draft by its queue key: undefined while loading, null when this device has none. */
export function useRecordDraft<P extends SavePayloadBase, R>(kind: DraftKind, localId: string | null): RecordDraft<P, R> | null | undefined {
  const all = useOutbox();
  if (!localId) return null;
  if (!all) return undefined;
  return summarize<P, R>(all, kind).find((draft) => draft.localId === localId) ?? null;
}

/** Calls `onChange` with the draft now and after every change to the queue. Returns the unsubscribe. */
export function watchRecordDraft<P extends SavePayloadBase, R>(
  sync: WebSync,
  kind: DraftKind,
  localId: string,
  onChange: (draft: RecordDraft<P, R> | null) => void,
): () => void {
  const subscription = liveQuery(() => sync.db.outbox.where('accountId').equals(sync.accountId).toArray()).subscribe({
    next: (all) => onChange(summarize<P, R>(all, kind).find((draft) => draft.localId === localId) ?? null),
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
 * Photos for a queued save: server photos by ID; photos waiting for a connection are queued
 * as uploads (once: a tile that already has its upload action keeps it).
 */
export async function queuePhotos(
  sync: WebSync,
  items: DraftPhoto[],
  purpose: 'listing_photo' | 'request_photo' = 'listing_photo',
): Promise<{ refs: PhotoRef[]; uploads: Record<string, string> }> {
  const uploads: Record<string, string> = {};
  const refs: PhotoRef[] = [];
  for (const item of items) {
    if (item.id && item.state !== 'failed') {
      refs.push({ id: item.id, preview: item.preview?.startsWith('blob:') ? null : item.preview });
    } else if (item.state === 'waiting' && item.file) {
      const payload: PhotoUploadPayload = {
        client_id: item.key,
        file: item.file,
        name: item.file instanceof File ? item.file.name : 'photo.jpg',
        purpose,
      };
      const upload =
        item.upload ?? (await sync.engine.enqueue({ entityType: UPLOAD_ENTITY, localId: item.key, actionType: 'upload.photo', payload })).actionId;
      uploads[item.key] = upload;
      refs.push({ upload, key: item.key });
    }
  }
  return { refs, uploads };
}

export function uploadDeps(...lists: PhotoRef[][]): string[] {
  return lists.flat().filter(isUploadRef).map((ref) => ref.upload);
}

/** The newest version of the record the queue has seen (an acked reply), to base the next save on. */
export async function latestRecord(sync: WebSync, kind: DraftKind, localId: string): Promise<{ id: string; version: number } | null> {
  const actions = await sync.db.outbox.where('[entityType+localId]').equals([kind.entity, localId]).toArray();
  const acked = actions.filter((a) => a.state === 'acked').sort((a, b) => (a.ackedAt ?? 0) - (b.ackedAt ?? 0));
  const record = replyRecord<{ id: string; version: number }>(acked.at(-1));
  return record && typeof record.version === 'number' ? record : null;
}

export interface SaveSpec<P extends SavePayloadBase> {
  localId: string;
  /** Action type when nothing is queued yet (e.g. listing.create or listing.update). */
  firstType: string;
  /** The create type, if the record has one: it never carries a version. */
  createType?: string;
  /** Follow-up save after an earlier one that may already have arrived. */
  followUpType: string;
  /** The version this save is based on: as loaded, or the latest after a conflict. */
  baseVersion: number | null;
  payload: (after: string | null, previous: P | null) => P;
  photoDeps: string[];
  /** Publish once saved; false withdraws a Publish still waiting (the last button tapped wins). */
  publish: boolean;
  submitPayload: (after: string) => unknown;
}

/** Puts one save (and optionally a Publish after it) into the queue. */
export async function saveChain<P extends SavePayloadBase>(sync: WebSync, kind: DraftKind, spec: SaveSpec<P>): Promise<void> {
  const { engine } = sync;
  const unsent = (await engine.unsent()).filter((a) => a.entityType === kind.entity && a.localId === spec.localId);
  const saves = unsent.filter((a) => a.actionType !== kind.submitType);
  const submits = unsent.filter((a) => a.actionType === kind.submitType);
  const replacedDeps = unsent.flatMap((a) => a.dependsOn);
  const deps = (after: string | null) => [...(after ? [after] : []), ...spec.photoDeps];

  let lastSave: string;
  if (saves.length === 0) {
    const create = spec.firstType === spec.createType;
    lastSave = (
      await engine.enqueue({
        entityType: kind.entity,
        localId: spec.localId,
        actionType: spec.firstType,
        payload: spec.payload(null, null),
        baseVersion: create ? null : spec.baseVersion,
        dependsOn: deps(null),
      })
    ).actionId;
  } else {
    const first = saves[0];
    const firstPayload = first.payload as P;
    // An edit refused as out of date is resent against the latest version.
    const firstVersion = first.state === 'conflict' || !firstPayload.after ? (first.actionType === spec.createType ? null : spec.baseVersion) : null;
    if (await engine.revise(first.actionId, { payload: spec.payload(firstPayload.after, firstPayload), baseVersion: firstVersion, dependsOn: deps(firstPayload.after) })) {
      for (const later of saves.slice(1)) await engine.discard(later.actionId);
      lastSave = first.actionId;
    } else {
      // The first is being sent, or may have arrived with its reply lost: add (or update) a follow-up after it.
      const last = saves[saves.length - 1];
      const lastPayload = last.payload as P;
      if (last !== first && (await engine.revise(last.actionId, { payload: spec.payload(lastPayload.after, lastPayload), dependsOn: deps(lastPayload.after) }))) {
        lastSave = last.actionId;
      } else {
        lastSave = (
          await engine.enqueue({
            entityType: kind.entity,
            localId: spec.localId,
            actionType: spec.followUpType,
            payload: spec.payload(last.actionId, lastPayload),
            baseVersion: null,
            dependsOn: deps(last.actionId),
          })
        ).actionId;
      }
    }
  }

  // A Publish still waiting is replaced: it must follow the newest save (or go, for "Save draft").
  let publishStays = false;
  for (const submit of submits) {
    if (changeable(submit)) await engine.discard(submit.actionId);
    else publishStays = true; // already on its way: it can't be called back
  }
  if (spec.publish && !publishStays) {
    await engine.enqueue({
      entityType: kind.entity,
      localId: spec.localId,
      actionType: kind.submitType,
      payload: spec.submitPayload(lastSave),
      dependsOn: [lastSave],
    });
  }

  await dropUnusedUploads(sync, replacedDeps);
  await sync.controller.refresh().catch(() => undefined);
}

/** Throws away what this device still had to send for one record (its photos too). */
export async function discardRecordDraft(sync: WebSync, kind: DraftKind, localId: string): Promise<void> {
  const unsent = (await sync.engine.unsent()).filter((a) => a.entityType === kind.entity && a.localId === localId);
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
