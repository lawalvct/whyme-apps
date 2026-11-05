import { describe, expect, it } from 'vitest';
import { classify, createHttpTransport, type OutboxAction } from '../src';

const action: OutboxAction = {
  actionId: '0190b6a0-0000-7000-8000-000000000001',
  accountId: 'user_1',
  entityType: 'service_request',
  localId: 'local_1',
  serverId: null,
  actionType: 'request.submit',
  payloadVersion: 1,
  payload: { title: 'Fix AC' },
  baseVersion: null,
  dependsOn: [],
  state: 'sending',
  attempts: 1,
  nextRetryAt: null,
  lastErrorCode: null,
  lastResponse: null,
  createdAt: 0,
  ackedAt: null,
};

describe('classify', () => {
  it.each([
    [201, { data: { id: 'abc' } }, { kind: 'ok', serverId: 'abc' }],
    [401, { code: 'unauthenticated' }, { kind: 'auth' }],
    [409, { code: 'conflict' }, { kind: 'conflict', code: 'conflict' }],
    [409, { code: 'idempotency_mismatch' }, { kind: 'rejected', code: 'idempotency_mismatch' }],
    [422, { code: 'validation_failed' }, { kind: 'rejected', code: 'validation_failed' }],
    [410, { code: 'job_closed' }, { kind: 'rejected', code: 'job_closed' }],
    [503, null, { kind: 'retryable', code: 'http_503' }],
  ])('maps HTTP %i', (status, body, expected) => {
    expect(classify(status, body, null)).toMatchObject(expected);
  });

  it('honours Retry-After on 429', () => {
    expect(classify(429, { code: 'too_many_requests' }, '30')).toEqual({
      kind: 'retryable',
      code: 'too_many_requests',
      retryAfterMs: 30_000,
    });
  });
});

describe('createHttpTransport', () => {
  it('sends the action ID as the Idempotency-Key with app headers', async () => {
    let seen: { url: string; init: RequestInit } | undefined;
    const transport = createHttpTransport({
      baseUrl: 'https://api.test/api/v1',
      routes: { 'request.submit': (a) => ({ method: 'POST', path: '/service-requests', body: a.payload }) },
      headers: () => ({ 'Accept-Language': 'ig' }),
      fetch: async (url, init) => {
        seen = { url: String(url), init: init! };
        return new Response(JSON.stringify({ data: { id: 'srv_9' } }), { status: 201 });
      },
    });

    const result = await transport.send(action, { serverIdFor: () => null });

    expect(result).toMatchObject({ kind: 'ok', serverId: 'srv_9' });
    expect(seen?.url).toBe('https://api.test/api/v1/service-requests');
    const headers = seen?.init.headers as Record<string, string>;
    expect(headers['Idempotency-Key']).toBe(action.actionId);
    expect(headers['Accept-Language']).toBe('ig');
  });

  it('treats a thrown fetch as a network error', async () => {
    const transport = createHttpTransport({
      baseUrl: 'https://api.test',
      routes: { 'request.submit': () => ({ method: 'POST', path: '/x' }) },
      fetch: async () => {
        throw new TypeError('Failed to fetch');
      },
    });
    expect(await transport.send(action, { serverIdFor: () => null })).toEqual({ kind: 'retryable', code: 'network_error' });
    expect(await transport.isReachable()).toBe(false);
  });
});
