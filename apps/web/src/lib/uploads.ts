import { ApiRequestError, unwrap, type ApiClient, type Upload } from '@whyme/data';
import { API_BASE_URL, appHeaders } from './api';

/** Longest edge sent to the API: it keeps 1600 px as the largest size anyway (docs/01 §6.5). */
const MAX_EDGE = 1600;

/**
 * Shrinks a photo in the browser before upload, so a 12 MB phone photo goes
 * up as a few hundred KB on a slow connection. Drawing it on a canvas also
 * drops the EXIF data (including where it was taken); the API re-encodes anyway.
 * Small photos and anything the browser can't decode are sent as they are.
 */
export async function shrinkPhoto(file: File): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return file;
  }

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size < 1_500_000) {
    bitmap.close();
    return file;
  }

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
  return blob ?? file;
}

/**
 * POST /v1/uploads as multipart. The typed client only sends JSON, so this
 * uses fetch with the same cookie session and headers. Returns at once with
 * `status: processing`; `waitForUpload` follows it until it's ready.
 */
export async function uploadPhoto(photo: Blob, clientId: string): Promise<Upload> {
  const form = new FormData();
  form.append('purpose', 'listing_photo');
  form.append('client_id', clientId);
  form.append('file', photo, photo instanceof File ? photo.name : 'photo.jpg');

  const response = await fetch(`${API_BASE_URL}/v1/uploads`, {
    method: 'POST',
    body: form,
    credentials: 'include',
    headers: { Accept: 'application/json', ...appHeaders() },
  });
  const body: unknown = await response.json().catch(() => null);
  return unwrap({ data: (body as { data?: Upload } | null)?.data, error: body, response });
}

/** Polls GET /me/uploads/{id} until the photo is ready or rejected (about a minute at most). */
export async function waitForUpload(api: ApiClient, id: string, signal?: AbortSignal): Promise<Upload> {
  for (let attempt = 0; attempt < 40; attempt++) {
    const upload = unwrap(await api.GET('/v1/me/uploads/{upload}', { params: { path: { upload: id } } })).data;
    if (upload.status !== 'processing') return upload;
    await new Promise((resolve) => setTimeout(resolve, Math.min(1000 + attempt * 250, 3000)));
    if (signal?.aborted) throw new ApiRequestError(0, null);
  }
  throw new ApiRequestError(425, { code: 'photos_processing', message: '', retryable: true });
}
