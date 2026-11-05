import * as SQLite from 'expo-sqlite';
import type { OutboxAction, OutboxStore } from '@whyme/sync';

/**
 * Mobile outbox in SQLite. One database file per account (`whyme_<userId>.db`),
 * so drafts never leak between accounts on a shared phone (ACC05, docs/01 §6.2).
 * The full action is stored as JSON; the indexed columns are for ordering and lookups.
 */
export class SqliteOutboxStore implements OutboxStore {
  private constructor(
    private readonly db: SQLite.SQLiteDatabase,
    readonly databaseName: string,
  ) {}

  static async open(accountId: string): Promise<SqliteOutboxStore> {
    const databaseName = `whyme_${accountId}.db`;
    const db = await SQLite.openDatabaseAsync(databaseName);
    // synchronous = FULL: a write that returned has reached storage, so "Saved offline" is true (OFF01).
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = FULL;
      CREATE TABLE IF NOT EXISTS outbox (
        action_id TEXT PRIMARY KEY NOT NULL,
        account_id TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        local_id TEXT NOT NULL,
        state TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        data TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS outbox_account_created ON outbox (account_id, created_at);
    `);
    return new SqliteOutboxStore(db, databaseName);
  }

  async put(action: OutboxAction): Promise<void> {
    await this.db.runAsync(
      'INSERT OR REPLACE INTO outbox (action_id, account_id, entity_type, local_id, state, created_at, data) VALUES (?, ?, ?, ?, ?, ?, ?)',
      action.actionId,
      action.accountId,
      action.entityType,
      action.localId,
      action.state,
      action.createdAt,
      JSON.stringify(action),
    );
  }

  async get(actionId: string): Promise<OutboxAction | undefined> {
    const row = await this.db.getFirstAsync<{ data: string }>('SELECT data FROM outbox WHERE action_id = ?', actionId);
    return row ? (JSON.parse(row.data) as OutboxAction) : undefined;
  }

  async list(accountId: string): Promise<OutboxAction[]> {
    const rows = await this.db.getAllAsync<{ data: string }>(
      'SELECT data FROM outbox WHERE account_id = ? ORDER BY created_at',
      accountId,
    );
    return rows.map((row) => JSON.parse(row.data) as OutboxAction);
  }

  async update(actionId: string, patch: Partial<OutboxAction>): Promise<void> {
    await this.db.withTransactionAsync(async () => {
      const current = await this.get(actionId);
      if (current) await this.put({ ...current, ...patch });
    });
  }

  async delete(actionId: string): Promise<void> {
    await this.db.runAsync('DELETE FROM outbox WHERE action_id = ?', actionId);
  }

  /** Sign-out with "Discard": remove this account's local database. */
  async destroy(): Promise<void> {
    await this.db.closeAsync();
    await SQLite.deleteDatabaseAsync(this.databaseName);
  }
}
