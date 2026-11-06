import Dexie, { type DexieOptions, type Table } from 'dexie';
import type { OutboxAction, OutboxStore } from '../types';

/** The outbox table definition, for apps that add their own tables to the same database. */
export const outboxSchema = {
  outbox: 'actionId, accountId, state, createdAt, [entityType+localId]',
} as const;

export type DexieWithOutbox = Dexie & { outbox: Table<OutboxAction, string> };

/**
 * Website outbox in IndexedDB. One database per account (`whyme_<userId>`), the
 * same isolation as mobile's per-account SQLite file (ACC05, docs/01 §6.6).
 *
 * Pass an account ID to open a database with only the outbox, or pass an app's
 * own database (which must include `outboxSchema`) to share it with cache tables.
 */
export class DexieOutboxStore implements OutboxStore {
  readonly db: DexieWithOutbox;

  constructor(accountIdOrDb: string | DexieWithOutbox, options?: DexieOptions) {
    if (typeof accountIdOrDb === 'string') {
      this.db = new Dexie(`whyme_${accountIdOrDb}`, options) as DexieWithOutbox;
      this.db.version(1).stores(outboxSchema);
    } else {
      this.db = accountIdOrDb;
    }
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
