import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { DexieOutboxStore } from '../src/adapters/dexie';
import { MemoryOutboxStore, SyncEngine, uuidv7, type Transport } from '../src';

const okTransport: Transport = {
  isReachable: async () => true,
  send: async () => ({ kind: 'ok', serverId: 'srv_1' }),
};

describe('DexieOutboxStore', () => {
  it('survives a "page reload": a new store instance sees the queued action', async () => {
    const first = new SyncEngine({ store: new DexieOutboxStore('user_a'), transport: okTransport, accountId: 'user_a' });
    const action = await first.enqueue({ entityType: 'service_request', localId: 'l1', actionType: 'request.submit', payload: { a: 1 } });

    const reopened = new DexieOutboxStore('user_a');
    expect(await reopened.get(action.actionId)).toMatchObject({ state: 'queued', payload: { a: 1 } });
  });

  it("keeps each account's data in its own database (ACC05)", async () => {
    const a = new DexieOutboxStore('user_x');
    const b = new DexieOutboxStore('user_y');
    const engine = new SyncEngine({ store: a, transport: okTransport, accountId: 'user_x' });
    await engine.enqueue({ entityType: 'msg', localId: 'm1', actionType: 'message.send', payload: {} });

    expect(await a.list('user_x')).toHaveLength(1);
    expect(await b.list('user_x')).toHaveLength(0);
    await a.destroy();
  });

  it('runs the same engine flow as the memory store', async () => {
    for (const store of [new DexieOutboxStore('user_z'), new MemoryOutboxStore()]) {
      const engine = new SyncEngine({ store, transport: okTransport, accountId: 'user_z', newId: () => uuidv7() });
      const action = await engine.enqueue({ entityType: 'x', localId: '1', actionType: 'x.create', payload: {} });
      await engine.run();
      expect(await store.get(action.actionId)).toMatchObject({ state: 'acked', serverId: 'srv_1' });
    }
  });

  it('changes a stored action only while the test still passes', async () => {
    const store = new DexieOutboxStore('user_w');
    const engine = new SyncEngine({ store, transport: okTransport, accountId: 'user_w' });
    const action = await engine.enqueue({ entityType: 'listing', localId: 'l1', actionType: 'listing.create', payload: { title: 'A' } });

    expect(await engine.revise(action.actionId, { payload: { title: 'B' } })).toBe(true);
    expect(await store.updateIf(action.actionId, (a) => a.state === 'sending', { payload: { title: 'C' } })).toBe(false);
    // A photo kept with the draft survives the round trip through IndexedDB.
    const photo = new Blob(['jpeg'], { type: 'image/jpeg' });
    expect(await store.updateIf(action.actionId, (a) => a.state === 'queued', { payload: { title: 'B', photo } })).toBe(true);
    const saved = await store.get(action.actionId);
    expect((saved?.payload as { title: string }).title).toBe('B');
    expect((saved?.payload as { photo: Blob }).photo.size).toBe(4);
    await store.destroy();
  });
});
