import { describe, expect, it } from 'vitest';
import {
  MemoryOutboxStore,
  SyncEngine,
  uuidv7,
  type OutboxAction,
  type SendContext,
  type Transport,
  type TransportResult,
} from '../src';

/** A fake API that stores idempotency results like the Laravel middleware does. */
class FakeServer implements Transport {
  reachable = true;
  created: string[] = [];
  /** Commit the write, then drop the response (OFF05 / AT08). */
  loseNextResponse = false;
  nextResults: TransportResult[] = [];
  received: OutboxAction[] = [];
  contexts = new Map<string, SendContext>();
  private idempotency = new Map<string, TransportResult>();

  async isReachable() {
    return this.reachable;
  }

  async send(action: OutboxAction, ctx: SendContext): Promise<TransportResult> {
    this.received.push(action);
    this.contexts.set(action.actionId, ctx);
    const stored = this.idempotency.get(action.actionId);
    if (stored) return stored;
    const scripted = this.nextResults.shift();
    if (scripted) return scripted;

    const id = `srv_${this.created.length + 1}`;
    this.created.push(action.actionId);
    const result: TransportResult = { kind: 'ok', serverId: id };
    this.idempotency.set(action.actionId, result);
    if (this.loseNextResponse) {
      this.loseNextResponse = false;
      throw new Error('socket hang up');
    }
    return result;
  }
}

function setup() {
  let clock = 1_700_000_000_000;
  const store = new MemoryOutboxStore();
  const server = new FakeServer();
  const engine = new SyncEngine({
    store,
    transport: server,
    accountId: 'user_1',
    now: () => clock,
    random: () => 0.5,
    newId: () => uuidv7((clock += 1)),
  });
  return { store, server, engine, advance: (ms: number) => (clock += ms) };
}

const request = { entityType: 'service_request', localId: 'local_1', actionType: 'request.submit', payload: { title: 'Fix AC' } };

describe('SyncEngine', () => {
  it('persists an action before anything is sent', async () => {
    const { store, server, engine } = setup();
    const action = await engine.enqueue(request);

    expect(server.received).toHaveLength(0);
    expect((await store.get(action.actionId))?.state).toBe('queued');
  });

  it('delivers exactly once when the response is lost after the server committed', async () => {
    const { store, server, engine, advance } = setup();
    const action = await engine.enqueue(request);
    server.loseNextResponse = true;

    expect(await engine.run()).toEqual({ status: 'offline', sent: 0 });
    expect((await store.get(action.actionId))?.state).toBe('retry_wait');

    advance(10 * 60_000);
    expect(await engine.run()).toMatchObject({ status: 'done', sent: 1 });

    const saved = await store.get(action.actionId);
    expect(saved).toMatchObject({ state: 'acked', serverId: 'srv_1', attempts: 2 });
    expect(server.created).toEqual([action.actionId]);
  });

  it('pauses on 401 and keeps the rest of the queue until the user signs in again', async () => {
    const { store, server, engine } = setup();
    const first = await engine.enqueue(request);
    const second = await engine.enqueue({ ...request, localId: 'local_2' });
    server.nextResults.push({ kind: 'auth' });

    expect(await engine.run()).toEqual({ status: 'paused_auth', sent: 0 });
    expect((await store.get(first.actionId))?.state).toBe('needs_auth');
    expect((await store.get(second.actionId))?.state).toBe('queued');

    await engine.resumeAfterAuth();
    expect(await engine.run()).toMatchObject({ status: 'done', sent: 2 });
  });

  it('sends dependencies first and passes their server IDs on', async () => {
    const { server, engine } = setup();
    const upload = await engine.enqueue({ entityType: 'upload', localId: 'photo_1', actionType: 'upload.create', payload: {} });
    const submit = await engine.enqueue({ ...request, dependsOn: [upload.actionId] });

    await engine.run();
    expect(server.received.map((a) => a.actionType)).toEqual(['upload.create', 'request.submit']);
    expect(server.contexts.get(submit.actionId)?.serverIdFor(upload.actionId)).toBe('srv_1');
  });

  it('does not send a dependent action while its dependency is failing', async () => {
    const { server, engine } = setup();
    const upload = await engine.enqueue({ entityType: 'upload', localId: 'photo_1', actionType: 'upload.create', payload: {} });
    await engine.enqueue({ ...request, dependsOn: [upload.actionId] });
    server.nextResults.push({ kind: 'retryable', code: 'http_503' });

    await engine.run();
    expect(server.received.map((a) => a.actionType)).toEqual(['upload.create']);
  });

  it('keeps first-in, first-out order for the same record', async () => {
    const { server, engine } = setup();
    await engine.enqueue({ entityType: 'listing', localId: 'L1', actionType: 'listing.update', payload: { price: 1 } });
    await engine.enqueue({ entityType: 'listing', localId: 'L1', actionType: 'listing.update', payload: { price: 2 } });
    server.nextResults.push({ kind: 'retryable', code: 'http_500' });

    await engine.run();
    expect(server.received.map((a) => (a.payload as { price: number }).price)).toEqual([1]);
  });

  it('requeues actions left "sending" by a crash', async () => {
    const { store, engine } = setup();
    const action = await engine.enqueue(request);
    await store.update(action.actionId, { state: 'sending' });

    expect(await engine.recover()).toBe(1);
    expect((await store.get(action.actionId))?.state).toBe('queued');
  });

  it('keeps a conflicting edit with the server record, then resends after the user amends it', async () => {
    const { store, server, engine } = setup();
    const action = await engine.enqueue({ ...request, actionType: 'listing.update', baseVersion: 3 });
    server.nextResults.push({ kind: 'conflict', code: 'conflict', body: { data: { version: 4 } } });

    await engine.run();
    expect(await store.get(action.actionId)).toMatchObject({ state: 'conflict', lastResponse: { data: { version: 4 } } });

    await engine.amend(action.actionId, { payload: { title: 'Fix AC (edited)' }, baseVersion: 4 });
    await engine.run();
    expect(await store.get(action.actionId)).toMatchObject({ state: 'acked', baseVersion: 4 });
  });

  it('keeps a rejected draft with its reason (e.g. job closed)', async () => {
    const { store, server, engine } = setup();
    const action = await engine.enqueue({ ...request, actionType: 'application.submit' });
    server.nextResults.push({ kind: 'rejected', code: 'job_closed' });

    await engine.run();
    expect(await store.get(action.actionId)).toMatchObject({ state: 'rejected', lastErrorCode: 'job_closed' });
  });

  it('sends nothing when the backend is unreachable', async () => {
    const { server, engine } = setup();
    await engine.enqueue(request);
    server.reachable = false;

    expect(await engine.run()).toEqual({ status: 'unreachable' });
    expect(server.received).toHaveLength(0);
  });

  it('waits for the backoff before retrying, unless the user taps Retry', async () => {
    const { server, engine } = setup();
    const action = await engine.enqueue(request);
    server.nextResults.push({ kind: 'retryable', code: 'http_502' });

    await engine.run();
    await engine.run();
    expect(server.received).toHaveLength(1);

    await engine.retryNow(action.actionId);
    await engine.run();
    expect(server.received).toHaveLength(2);
  });

  it('returns "busy" for overlapping runs', async () => {
    const { engine } = setup();
    await engine.enqueue(request);
    const [a, b] = await Promise.all([engine.run(), engine.run()]);
    expect([a.status, b.status].sort()).toEqual(['busy', 'done']);
  });
});

describe('uuidv7', () => {
  it('has version 7 and sorts by time', () => {
    const a = uuidv7(1_700_000_000_000);
    const b = uuidv7(1_700_000_000_001);
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(a < b).toBe(true);
  });
});
