import type { OutboxAction, RouteSpec, SendContext } from '@whyme/sync';
import type { ListingKind } from '@whyme/data';

/**
 * Listing drafts saved offline go through the send queue (docs/01 §6.3, OFF05):
 * photos first (`upload.photo`), then the listing (`listing.create` or
 * `listing.update`), which depends on them and reads their upload IDs when sent,
 * then `listing.submit` if the seller tapped Publish.
 */

/** What the editor saves, in the API's field names (photo IDs are worked out when sent). */
export interface ListingContent {
  category_id: number;
  location_id: number;
  title: string;
  description: string;
  price_kobo: number | null;
  quantity: number | null;
  fulfilment: ('pickup' | 'delivery')[];
  service_area_ids: number[];
  availability_note: string | null;
  refund_policy: { accepts_returns: boolean; return_days: number | null; conditions: string | null } | null;
}

/** A photo already on the server, or one waiting in the queue (by its upload action). */
export type PhotoRef = { id: string; preview?: string | null } | { upload: string; key: string };

export interface ListingDraftPayload {
  kind: ListingKind;
  /** The draft's client ID: a replayed create returns the same listing. */
  client_id: string;
  /** Known when editing a listing that is already on the server. */
  listing_id: string | null;
  /** An earlier, still unconfirmed save of this listing: its reply gives the server ID and version. */
  after: string | null;
  content: ListingContent;
  photos: PhotoRef[];
  savedAt: number;
}

/** "Publish" after a queued save: the save's reply gives the listing and its new version. */
export interface ListingSubmitPayload {
  listing_id: string | null;
  after: string;
}

export interface PhotoUploadPayload {
  client_id: string;
  file: Blob;
  name: string;
  purpose?: 'listing_photo' | 'request_photo';
}

export const LISTING_ENTITY = 'listing';
export const UPLOAD_ENTITY = 'upload';

export function isUploadRef(ref: PhotoRef): ref is { upload: string; key: string } {
  return 'upload' in ref;
}

export function photoIds(photos: PhotoRef[], ctx: SendContext): string[] {
  // A photo whose upload is missing (removed while waiting) is left out rather than blocking the draft.
  return photos.map((ref) => (isUploadRef(ref) ? ctx.serverIdFor(ref.upload) : ref.id)).filter((id): id is string => Boolean(id));
}

export type Route = (action: OutboxAction, ctx: SendContext) => RouteSpec;

/** The record and version to submit, from the reply to the save it follows. */
export function submitTarget(after: string, ctx: SendContext): { id: string | null; version: number | null } {
  const reply = ctx.responseFor(after) as { data?: { id?: string; version?: number } } | null;
  return { id: reply?.data?.id ?? null, version: reply?.data?.version ?? null };
}

export const listingRoutes: Record<string, Route> = {
  'upload.photo': (action) => {
    const payload = action.payload as PhotoUploadPayload;
    if (!(payload.file instanceof Blob)) throw new Error('photo missing');
    const form = new FormData();
    form.append('purpose', payload.purpose ?? 'listing_photo');
    form.append('client_id', payload.client_id);
    form.append('file', payload.file, payload.name);
    return { method: 'POST', path: '/v1/uploads', body: form };
  },

  'listing.create': (action, ctx) => {
    const payload = action.payload as ListingDraftPayload;
    return {
      method: 'POST',
      path: '/v1/me/listings',
      body: { ...payload.content, kind: payload.kind, client_id: payload.client_id, photo_ids: photoIds(payload.photos, ctx) },
    };
  },

  'listing.update': (action, ctx) => {
    const payload = action.payload as ListingDraftPayload;
    const id = payload.listing_id ?? (payload.after ? ctx.serverIdFor(payload.after) : null);
    const version = action.baseVersion ?? (payload.after ? (ctx.responseFor(payload.after) as { data?: { version?: number } } | null)?.data?.version : null);
    if (!id || !version) throw new Error('listing unknown');
    return {
      method: 'PATCH',
      path: `/v1/me/listings/${encodeURIComponent(id)}`,
      body: { ...payload.content, version, photo_ids: photoIds(payload.photos, ctx) },
    };
  },

  'listing.submit': (action, ctx) => {
    const payload = action.payload as ListingSubmitPayload;
    const target = submitTarget(payload.after, ctx);
    const id = target.id ?? payload.listing_id;
    if (!id || !target.version) throw new Error('listing unknown');
    return { method: 'POST', path: `/v1/me/listings/${encodeURIComponent(id)}/submit`, body: { version: target.version } };
  },
};
