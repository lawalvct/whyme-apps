import { describe, expect, it } from 'vitest';
import { createStore } from 'zustand';
import { MemoryOutboxStore, SyncEngine, type Transport, type TransportResult } from '@whyme/sync';
import {
  ApiRequestError,
  applyServerErrors,
  createSyncController,
  ensureOk,
  globalSyncStatus,
  isRetryable,
  unwrap,
  type SyncStatusState,
} from '../src';

function freshStatusStore() {
  return createStore<SyncStatusState>(() => ({
    online: true,
    syncing: false,
    lastRunAt: null,
    lastResult: null,
    unsent: 0,
    attention: 0,
  }));
}

function engineWith(results: TransportResult[], reachable = true) {
  const transport: Transport = {
    isReachable: async () => reachable,
    send: async () => results.shift() ?? { kind: 'ok', serverId: 'srv' },
  };
  return new SyncEngine({ store: new MemoryOutboxStore(), transport, accountId: 'u1' });
}

const action = { entityType: 'request', localId: 'l1', actionType: 'request.submit', payload: {} };

describe('createSyncController', () => {
  it('counts unsent and attention items after a run', async () => {
    const engine = engineWith([{ kind: 'rejected', code: 'job_closed' }]);
    const store = freshStatusStore();
    const sync = createSyncController(engine, store);
    await engine.enqueue(action);
    await engine.enqueue({ ...action, localId: 'l2' });

    await sync.run();

    expect(store.getState()).toMatchObject({ syncing: false, lastResult: 'done', unsent: 1, attention: 1 });
    expect(globalSyncStatus(store.getState())).toBe('failed');
  });

  it('shows Online once everything is sent', async () => {
    const engine = engineWith([]);
    const store = freshStatusStore();
    const sync = createSyncController(engine, store);
    await engine.enqueue(action);

    await sync.run();

    expect(store.getState()).toMatchObject({ unsent: 0, attention: 0 });
    expect(globalSyncStatus(store.getState())).toBe('online');
  });

  it('reports Sync failed when the backend is unreachable', async () => {
    const store = freshStatusStore();
    const sync = createSyncController(engineWith([], false), store);

    await sync.run();

    expect(store.getState().lastResult).toBe('unreachable');
    expect(globalSyncStatus(store.getState())).toBe('failed');
  });

  it('shows Offline and sends again when the connection returns', async () => {
    const engine = engineWith([]);
    const store = freshStatusStore();
    const sync = createSyncController(engine, store);
    await engine.enqueue(action);

    sync.setOnline(false);
    expect(globalSyncStatus(store.getState())).toBe('offline');

    sync.setOnline(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    await sync.refresh();
    expect(store.getState()).toMatchObject({ online: true, unsent: 0 });
  });
});

describe('isRetryable', () => {
  it.each([
    [new TypeError('Failed to fetch'), true],
    [new ApiRequestError(503, null), true],
    [new ApiRequestError(429, null), true],
    [new ApiRequestError(401, null), false],
    [new ApiRequestError(422, null), false],
  ])('%s → %s', (error, expected) => {
    expect(isRetryable(error)).toBe(expected);
  });
});

describe('unwrap', () => {
  it('returns data on success and throws the API error shape otherwise', () => {
    expect(unwrap({ data: { ok: 1 }, response: new Response(null, { status: 200 }) })).toEqual({ ok: 1 });

    const failure = () =>
      unwrap({
        error: { code: 'unauthenticated', message: 'Please sign in', retryable: false },
        response: new Response(null, { status: 401 }),
      });
    expect(failure).toThrowError(ApiRequestError);
    try {
      failure();
    } catch (e) {
      expect((e as ApiRequestError).code).toBe('unauthenticated');
    }
  });
});

describe('ensureOk', () => {
  it('accepts an empty 204 and throws the API error otherwise', () => {
    expect(() => ensureOk({ response: new Response(null, { status: 204 }) })).not.toThrow();
    expect(() =>
      ensureOk({ error: { code: 'not_found', message: '', retryable: false }, response: new Response(null, { status: 404 }) }),
    ).toThrowError('not_found');
  });
});

describe('applyServerErrors', () => {
  it("puts the server's field errors on the form", () => {
    const set: Record<string, string | undefined> = {};
    const form = { setError: (name: string, error: { message?: string }) => void (set[name] = error.message) };
    const error = new ApiRequestError(422, {
      code: 'otp_invalid',
      message: 'That code is not correct.',
      fields: { code: ['That code is not correct.'] },
      retryable: false,
    });

    expect(applyServerErrors(form, error)).toBe(true);
    expect(set).toEqual({ code: 'That code is not correct.' });
    expect(applyServerErrors(form, new Error('boom'))).toBe(false);
  });
});
