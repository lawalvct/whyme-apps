import type { ProfileKind } from '@whyme/data';
import { photoIds, submitTarget, type PhotoRef, type Route } from './listing-queue';

/**
 * Business and provider pages saved offline (OFF05): photo uploads first, then
 * `profile.save` (PUT creates or updates the page), then `profile.submit` if the
 * seller tapped Publish. One page per kind, so the kind is the queue key.
 */

export const PROFILE_ENTITY = 'profile';

/** What the editor saves, in the API's field names (logo and photo IDs are worked out when sent). */
export interface ProfileContent {
  display_name: string;
  category_id: number;
  location_id: number;
  about: string | null;
  availability_note: string | null;
  opening_hours: Record<string, { open: string; close: string }[]> | null;
  service_area_ids: number[];
  years_experience: number | null;
  rate_note: string | null;
}

export interface ProfileDraftPayload {
  kind: ProfileKind;
  /** An earlier, still unconfirmed save: its reply gives the version. */
  after: string | null;
  content: ProfileContent;
  logo: PhotoRef[];
  photos: PhotoRef[];
  savedAt: number;
}

export interface ProfileSubmitPayload {
  kind: ProfileKind;
  after: string;
}

export const profileRoutes: Record<string, Route> = {
  'profile.save': (action, ctx) => {
    const payload = action.payload as ProfileDraftPayload;
    // A new page has no version yet; a follow-up takes it from the save before it.
    const version =
      action.baseVersion ?? (payload.after ? ((ctx.responseFor(payload.after) as { data?: { version?: number } } | null)?.data?.version ?? null) : null);
    if (payload.after && !version) throw new Error('page unknown');
    return {
      method: 'PUT',
      path: `/v1/me/profiles/${payload.kind}`,
      body: { ...payload.content, version, logo_id: photoIds(payload.logo, ctx)[0] ?? null, photo_ids: photoIds(payload.photos, ctx) },
    };
  },

  'profile.submit': (action, ctx) => {
    const payload = action.payload as ProfileSubmitPayload;
    const { version } = submitTarget(payload.after, ctx);
    if (!version) throw new Error('page unknown');
    return { method: 'POST', path: `/v1/me/profiles/${payload.kind}/submit`, body: { version } };
  },
};
