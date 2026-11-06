import Dexie, { type Table } from 'dexie';
import { outboxSchema, type DexieWithOutbox } from '@whyme/sync/dexie';
import type { OutboxAction } from '@whyme/sync';

/**
 * A record downloaded for offline use: my profile, saved items, recently viewed
 * listings (docs/01 §6.2, §15.1). `kind` + `id` identify it; `data` is the API resource.
 */
export interface CachedRecord {
  kind: string;
  id: string;
  data: unknown;
  serverUpdatedAt: string | null;
  fetchedAt: number;
}

/**
 * The signed-in account's browser database: the outbox plus offline caches.
 * One per account (`whyme_<userId>`), cleared on "Discard and sign out" (ACC05).
 */
export class LocalDb extends Dexie implements DexieWithOutbox {
  outbox!: Table<OutboxAction, string>;
  records!: Table<CachedRecord, [string, string]>;

  constructor(accountId: string) {
    super(`whyme_${accountId}`);
    this.version(1).stores({
      ...outboxSchema,
      records: '[kind+id], kind, fetchedAt',
    });
  }

  /** Write-through after an online fetch, so the same screen works offline next time. */
  async cache(kind: string, id: string, data: unknown, serverUpdatedAt: string | null = null): Promise<void> {
    await this.records.put({ kind, id, data, serverUpdatedAt, fetchedAt: Date.now() });
  }
}
