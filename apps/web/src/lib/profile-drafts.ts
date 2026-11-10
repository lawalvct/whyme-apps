'use client';

import type { OwnerProfile, ProfileKind } from '@whyme/data';
import { PROFILE_ENTITY, type ProfileContent, type ProfileDraftPayload, type ProfileSubmitPayload } from './profile-queue';
import {
  latestRecord,
  queuePhotos,
  saveChain,
  uploadDeps,
  useRecordDraft,
  watchRecordDraft,
  type DraftKind,
  type DraftPhoto,
  type RecordDraft,
} from './record-drafts';
import type { WebSync } from './sync';

/** Business and provider page edits saved on this device and not yet confirmed (see record-drafts.ts). */

export const PROFILE_DRAFTS: DraftKind = { entity: PROFILE_ENTITY, submitType: 'profile.submit' };

export type ProfileDraft = RecordDraft<ProfileDraftPayload, OwnerProfile>;

/** Undefined while loading, null when this device has nothing queued for that page. */
export function useProfileDraft(kind: ProfileKind | null): ProfileDraft | null | undefined {
  return useRecordDraft<ProfileDraftPayload, OwnerProfile>(PROFILE_DRAFTS, kind);
}

export function watchProfileDraft(sync: WebSync, kind: ProfileKind, onChange: (draft: ProfileDraft | null) => void): () => void {
  return watchRecordDraft<ProfileDraftPayload, OwnerProfile>(sync, PROFILE_DRAFTS, kind, onChange);
}

/** Saves the page editor's content into the queue (photos and logo too), with a Publish after it when asked. */
export async function saveProfileDraft(
  sync: WebSync,
  input: { kind: ProfileKind; baseVersion: number | null; content: ProfileContent; logo: DraftPhoto[]; photos: DraftPhoto[]; publish: boolean },
): Promise<{ uploads: Record<string, string> }> {
  const logo = await queuePhotos(sync, input.logo);
  const photos = await queuePhotos(sync, input.photos);
  // An earlier queued save may have created or changed the page since the editor loaded it.
  const known = await latestRecord(sync, PROFILE_DRAFTS, input.kind);
  const baseVersion = known && known.version > (input.baseVersion ?? 0) ? known.version : input.baseVersion;

  await saveChain<ProfileDraftPayload>(sync, PROFILE_DRAFTS, {
    localId: input.kind,
    firstType: 'profile.save',
    followUpType: 'profile.save',
    baseVersion,
    payload: (after) => ({ kind: input.kind, after, content: input.content, logo: logo.refs, photos: photos.refs, savedAt: Date.now() }),
    photoDeps: uploadDeps(logo.refs, photos.refs),
    publish: input.publish,
    submitPayload: (after): ProfileSubmitPayload => ({ kind: input.kind, after }),
  });
  return { uploads: { ...logo.uploads, ...photos.uploads } };
}
