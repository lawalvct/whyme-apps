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
    const result: TransportResult = { kind: 'ok', serverId: id, body: { data: { id, version: 1 } } };
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

  it('changes a draft in place while it has never been sent', async () => {
    const { server, engine } = setup();
    const action = await engine.enqueue(request);

    expect(await engine.revise(action.actionId, { payload: { title: 'Fix AC today' } })).toBe(true);
    await engine.run();
    expect(server.received.map((a) => a.payload)).toEqual([{ title: 'Fix AC today' }]);
  });

  it('refuses to change a draft whose reply may have been lost, so a follow-up goes after it', async () => {
    const { store, server, engine, advance } = setup();
    const create = await engine.enqueue({ ...request, actionType: 'listing.create' });
    server.loseNextResponse = true;
    await engine.run();

    // The server may already hold the first body under this Idempotency-Key.
    expect(await engine.revise(create.actionId, { payload: { title: 'Changed' } })).toBe(false);
    const update = await engine.enqueue({ ...request, actionType: 'listing.update', payload: { title: 'Changed' }, dependsOn: [create.actionId] });

    advance(10 * 60_000);
    await engine.run();
    expect(server.received.map((a) => a.actionType)).toEqual(['listing.create', 'listing.create', 'listing.update']);
    // The follow-up reads the record's server ID and version from the create's reply.
    const ctx = server.contexts.get(update.actionId);
    expect(ctx?.serverIdFor(create.actionId)).toBe('srv_1');
    expect(ctx?.responseFor(create.actionId)).toEqual({ data: { id: 'srv_1', version: 1 } });
    expect((await store.get(update.actionId))?.state).toBe('acked');
  });

  it('lets the user fix a rejected draft and its dependencies, then resends it', async () => {
    const { store, server, engine } = setup();
    const upload = await engine.enqueue({ entityType: 'upload', localId: 'photo_1', actionType: 'upload.create', payload: {} });
    const create = await engine.enqueue({ ...request, dependsOn: [upload.actionId] });
    server.nextResults.push({ kind: 'rejected', code: 'file_too_large' });
    await engine.run();
    expect(server.received).toHaveLength(1);

    // The user removes the photo that was refused: the draft no longer waits for it.
    await engine.discard(upload.actionId);
    expect(await engine.revise(create.actionId, { payload: { title: 'No photo' }, dependsOn: [] })).toBe(true);
    await engine.run();
    expect((await store.get(create.actionId))?.state).toBe('acked');
  });

  it('skips an action another tab discarded after it was listed', async () => {
    const { store, server, engine } = setup();
    const action = await engine.enqueue(request);
    const realGet = store.get.bind(store);
    let calls = 0;
    // Discard it between the engine listing it and claiming it.
    store.updateIf = async (id, test, patch) => {
      if (calls++ === 0) await store.delete(id);
      return MemoryOutboxStore.prototype.updateIf.call(store, id, test, patch);
    };

    expect(await engine.run()).toEqual({ status: 'done', sent: 0, failed: 0 });
    expect(server.received).toHaveLength(0);
    expect(await realGet(action.actionId)).toBeUndefined();
  });

  it('prunes old acked actions but keeps those an unsent action depends on', async () => {
    const { store, server, engine, advance } = setup();
    const done = await engine.enqueue(request);
    const upload = await engine.enqueue({ entityType: 'upload', localId: 'photo_1', actionType: 'upload.create', payload: {} });
    await engine.run();
    const create = await engine.enqueue({ ...request, localId: 'local_2', dependsOn: [upload.actionId] });
    server.reachable = false;

    advance(8 * 24 * 3600_000);
    expect(await engine.prune(7 * 24 * 3600_000)).toBe(1);
    expect(await store.get(done.actionId)).toBeUndefined();
    expect(await store.get(upload.actionId)).toBeDefined();
    expect((await store.get(create.actionId))?.state).toBe('queued');
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
