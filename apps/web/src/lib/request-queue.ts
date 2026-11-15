'use client';

import type { PreferredTime, ServiceRequest } from '@whyme/data';
import { photoIds, type PhotoRef, type Route } from './listing-queue';
import {
  discardRecordDraft,
  queuePhotos,
  saveChain,
  uploadDeps,
  useRecordDraft,
  useRecordDrafts,
  type DraftKind,
  type DraftPhoto,
  type RecordDraft,
} from './record-drafts';
import type { WebSync } from './sync';

/**
 * Service requests saved offline (REQ03, OFF05, AT06): photos upload first (`upload.photo`
 * with `purpose: 'request_photo'`), then `request.create` sends `POST /v1/requests` with
 * both the offline creation time (`client_created_at`) and `client_id` so replays are
 * idempotent (AT08).
 */

export const REQUEST_ENTITY = 'service_request';

export const REQUEST_DRAFTS: DraftKind = {
  entity: REQUEST_ENTITY,
  submitType: 'request.submit',
};

export interface RequestDraftPayload {
  client_id: string;
  client_created_at: string;
  listing_id?: string;
  profile_id?: string;
  target_name: string;
  location_name: string;
  category_id: number;
  location_id: number;
  title: string;
  description: string;
  preferred_date: string | null;
  preferred_time: PreferredTime | null;
  budget_min_kobo: number | null;
  budget_max_kobo: number | null;
  photos: PhotoRef[];
  after: string | null;
  savedAt: number;
}

export type RequestDraft = RecordDraft<RequestDraftPayload, ServiceRequest>;

export const requestRoutes: Record<string, Route> = {
  'request.create': (action, ctx) => {
    const payload = action.payload as RequestDraftPayload;
    return {
      method: 'POST',
      path: '/v1/requests',
      body: {
        ...(payload.listing_id ? { listing_id: payload.listing_id } : {}),
        ...(payload.profile_id ? { profile_id: payload.profile_id } : {}),
        category_id: payload.category_id,
        location_id: payload.location_id,
        title: payload.title,
        description: payload.description,
        preferred_date: payload.preferred_date,
        preferred_time: payload.preferred_time,
        budget_min_kobo: payload.budget_min_kobo,
        budget_max_kobo: payload.budget_max_kobo,
        photo_ids: photoIds(payload.photos, ctx),
        client_id: payload.client_id,
        client_created_at: payload.client_created_at,
      },
    };
  },
};

export function useRequestDrafts(): RequestDraft[] | undefined {
  return useRecordDrafts<RequestDraftPayload, ServiceRequest>(REQUEST_DRAFTS);
}

export function useRequestDraft(localId: string | null): RequestDraft | null | undefined {
  return useRecordDraft<RequestDraftPayload, ServiceRequest>(REQUEST_DRAFTS, localId);
}

export async function saveRequestDraft(
  sync: WebSync,
  input: {
    localId: string;
    createdAt: string;
    listing_id?: string;
    profile_id?: string;
    target_name: string;
    location_name: string;
    category_id: number;
    location_id: number;
    title: string;
    description: string;
    preferred_date: string | null;
    preferred_time: PreferredTime | null;
    budget_min_kobo: number | null;
    budget_max_kobo: number | null;
    photos: DraftPhoto[];
  },
): Promise<{ uploads: Record<string, string> }> {
  const { refs, uploads } = await queuePhotos(sync, input.photos, 'request_photo');

  await saveChain<RequestDraftPayload>(sync, REQUEST_DRAFTS, {
    localId: input.localId,
    firstType: 'request.create',
    createType: 'request.create',
    followUpType: 'request.create',
    baseVersion: null,
    payload: (after, previous) => ({
      client_id: input.localId,
      client_created_at: previous?.client_created_at ?? input.createdAt,
      ...(input.listing_id ? { listing_id: input.listing_id } : {}),
      ...(input.profile_id ? { profile_id: input.profile_id } : {}),
      target_name: input.target_name,
      location_name: input.location_name,
      category_id: input.category_id,
      location_id: input.location_id,
      title: input.title,
      description: input.description,
      preferred_date: input.preferred_date,
      preferred_time: input.preferred_time,
      budget_min_kobo: input.budget_min_kobo,
      budget_max_kobo: input.budget_max_kobo,
      photos: refs,
      after,
      savedAt: Date.now(),
    }),
    photoDeps: uploadDeps(refs),
    publish: false,
    submitPayload: () => ({}),
  });

  if (navigator.onLine) void sync.controller.run().catch(() => undefined);
  return { uploads };
}

export async function discardRequestDraft(sync: WebSync, localId: string): Promise<void> {
  await discardRecordDraft(sync, REQUEST_DRAFTS, localId);
}
