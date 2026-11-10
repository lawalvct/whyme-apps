import { describe, expect, it } from 'vitest';
import { ApiRequestError } from './api';
import { offlineCopyStore, withOfflineCopy, type OfflineCache } from './offline';

function memoryCache(): OfflineCache & { rows: Map<string, { data: unknown; fetchedAt: number }> } {
  const rows = new Map<string, { data: unknown; fetchedAt: number }>();
  return {
    rows,
    async get(kind, id) {
      return rows.get(`${kind}:${id}`);
    },
    async put(kind, id, data) {
      rows.set(`${kind}:${id}`, { data, fetchedAt: 1_700_000_000_000 });
    },
  };
}

describe('withOfflineCopy', () => {
  it('keeps every successful load and returns it unchanged', async () => {
    const cache = memoryCache();
    const result = await withOfflineCopy(cache, 'order', 'o1', async () => ({ id: 'o1', state: 'paid' }))();

    expect(result).toEqual({ id: 'o1', state: 'paid' });
    expect(cache.rows.get('order:o1')?.data).toEqual({ id: 'o1', state: 'paid' });
    expect(offlineCopyStore.getState().copies['order:o1']).toBeUndefined();
  });

  it('returns the kept copy when the connection fails, and marks it as an offline copy', async () => {
    const cache = memoryCache();
    await withOfflineCopy(cache, 'order', 'o2', async () => ({ id: 'o2' }))();

    const offline = await withOfflineCopy(cache, 'order', 'o2', async () => {
      throw new TypeError('Failed to fetch');
    })();

    expect(offline).toEqual({ id: 'o2' });
    expect(offlineCopyStore.getState().copies['order:o2']).toBe(1_700_000_000_000);

    // Back online: the mark goes away.
    await withOfflineCopy(cache, 'order', 'o2', async () => ({ id: 'o2', fresh: true }))();
    expect(offlineCopyStore.getState().copies['order:o2']).toBeUndefined();
  });

  it('never hides a real answer from the server behind an old copy', async () => {
    const cache = memoryCache();
    await withOfflineCopy(cache, 'order', 'o3', async () => ({ id: 'o3' }))();

    await expect(
      withOfflineCopy(cache, 'order', 'o3', async () => {
        throw new ApiRequestError(404, { code: 'not_found', message: 'Not found' } as never);
      })(),
    ).rejects.toBeInstanceOf(ApiRequestError);
  });

  it('fails as before when there is no copy yet, or no cache (signed out)', async () => {
    const offline = async () => {
      throw new TypeError('Failed to fetch');
    };
    await expect(withOfflineCopy(memoryCache(), 'order', 'never', offline)()).rejects.toBeInstanceOf(TypeError);
    await expect(withOfflineCopy(null, 'order', 'never', offline)()).rejects.toBeInstanceOf(TypeError);
  });

  it('still shows fresh data when keeping the copy fails (full storage)', async () => {
    const broken: OfflineCache = {
      get: async () => undefined,
      put: async () => {
        throw new Error('QuotaExceededError');
      },
    };
    await expect(withOfflineCopy(broken, 'order', 'o4', async () => ({ id: 'o4' }))()).resolves.toEqual({ id: 'o4' });
  });
});
