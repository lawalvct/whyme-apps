import type { OutboxAction, OutboxStore } from '../types';

/** In-memory store for tests. Not durable: never use it in the apps. */
export class MemoryOutboxStore implements OutboxStore {
  readonly rows = new Map<string, OutboxAction>();

  async put(action: OutboxAction): Promise<void> {
    this.rows.set(action.actionId, structuredClone(action));
  }

  async get(actionId: string): Promise<OutboxAction | undefined> {
    const row = this.rows.get(actionId);
    return row ? structuredClone(row) : undefined;
  }

  async list(accountId: string): Promise<OutboxAction[]> {
    return [...this.rows.values()].filter((a) => a.accountId === accountId).map((a) => structuredClone(a));
  }

  async update(actionId: string, patch: Partial<OutboxAction>): Promise<void> {
    const row = this.rows.get(actionId);
    if (row) this.rows.set(actionId, { ...row, ...structuredClone(patch) });
  }

  async delete(actionId: string): Promise<void> {
    this.rows.delete(actionId);
  }
}
