import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * The signed-in account's database (`whyme_<userId>.db`), one per account (ACC05).
 * Drizzle owns the schema; changes go through `pnpm db:generate` migrations.
 */

/** @whyme/sync outbox: the full action is JSON in `data`; the other columns are for lookups. */
export const outbox = sqliteTable(
  'outbox',
  {
    actionId: text('action_id').primaryKey(),
    accountId: text('account_id').notNull(),
    entityType: text('entity_type').notNull(),
    localId: text('local_id').notNull(),
    state: text('state').notNull(),
    createdAt: integer('created_at').notNull(),
    data: text('data').notNull(),
  },
  (t) => [index('outbox_account_created').on(t.accountId, t.createdAt)],
);

/**
 * Records downloaded for offline use: my profile, saved items, recently viewed
 * listings, my requests (docs/01 §6.2, §15.1). Screens read these with live queries.
 */
export const records = sqliteTable(
  'records',
  {
    kind: text('kind').notNull(),
    id: text('id').notNull(),
    data: text('data', { mode: 'json' }).notNull(),
    serverUpdatedAt: text('server_updated_at'),
    fetchedAt: integer('fetched_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.kind, t.id] }), index('records_kind').on(t.kind)],
);
