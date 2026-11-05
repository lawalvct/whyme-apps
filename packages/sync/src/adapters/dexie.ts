import Dexie, { type DexieOptions, type Table } from 'dexie';
import type { OutboxAction, OutboxStore } from '../types';

/**
 * Website outbox in IndexedDB. One database per account (`whyme_<userId>`), the
 * same isolation as mobile's per-account SQLite file (ACC05, docs/01 §6.6).
 */
export class DexieOutboxStore implements OutboxStore {
  readonly db: Dexie & { outbox: Table<OutboxAction, string> };

  constructor(accountId: string, options?: DexieOptions) {
    this.db = new Dexie(`whyme_${accountId}`, options) as Dexie & { outbox: Table<OutboxAction, string> };
    this.db.version(1).stores({
      outbox: 'actionId, accountId, state, createdAt, [entityType+localId]',
    });
  }

  async put(action: OutboxAction): Promise<void> {
    await this.db.outbox.put(action);
  }

  async get(actionId: string): Promise<OutboxAction | undefined> {
    return this.db.outbox.get(actionId);
  }

  async list(accountId: string): Promise<OutboxAction[]> {
    return this.db.outbox.where('accountId').equals(accountId).toArray();
  }

  async update(actionId: string, patch: Partial<OutboxAction>): Promise<void> {
    await this.db.outbox.update(actionId, patch);
  }

  async delete(actionId: string): Promise<void> {
    await this.db.outbox.delete(actionId);
  }

  /** On sign-out with "Discard": remove this account's local data from the browser. */
  async destroy(): Promise<void> {
    await this.db.delete();
  }
}
