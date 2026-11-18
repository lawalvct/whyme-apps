import type { ImagePickerAsset } from 'expo-image-picker';
import { Platform } from 'react-native';
import { ApiRequestError, unwrap, type Upload } from '@whyme/data';
import { API_BASE_URL, appHeaders } from './api';

/**
 * Sends one photo to the API's private quarantine (POST /uploads); the listing then points at it
 * by id. On a phone the file goes as { uri, name, type }; in the web preview as the picked File.
 */
export async function uploadPhoto(asset: ImagePickerAsset, clientId: string): Promise<Upload> {
  const form = new FormData();
  form.append('purpose', 'listing_photo');
  form.append('client_id', clientId);
  const name = asset.fileName ?? `photo-${clientId}.jpg`;
  if (Platform.OS === 'web' && asset.file) {
    form.append('file', asset.file, name);
  } else {
    form.append('file', { uri: asset.uri, name, type: asset.mimeType ?? 'image/jpeg' } as unknown as Blob);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/v1/uploads`, { method: 'POST', body: form, headers: { Accept: 'application/json', ...(await appHeaders()) } });
  } catch {
    throw new ApiRequestError(0, { code: 'network_error', message: '', retryable: true });
  }
  const body: unknown = await response.json().catch(() => null);
  return unwrap<Upload>({ data: (body as { data?: Upload } | null)?.data, error: body, response });
}
