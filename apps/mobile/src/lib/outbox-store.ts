import type { SQLiteDatabase } from 'expo-sqlite';
import type { OutboxAction, OutboxStore } from '@whyme/sync';

/**
 * Mobile outbox in the account's SQLite database (table created by the Drizzle
 * migrations in src/db). The full action is stored as JSON; the indexed columns
 * are for ordering and lookups.
 */
export class SqliteOutboxStore implements OutboxStore {
  constructor(private readonly db: SQLiteDatabase) {}

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
}
