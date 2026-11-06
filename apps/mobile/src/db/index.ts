import { and, eq } from 'drizzle-orm';
import { drizzle, useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import { deleteDatabaseAsync, openDatabaseAsync } from 'expo-sqlite';
import migrations from '../../drizzle/migrations';
import * as schema from './schema';

/**
 * Opens (and migrates) the signed-in account's database. One file per account,
 * so drafts never leak between accounts on a shared phone (ACC05, docs/01 §6.2).
 */
export async function openAccountDatabase(accountId: string) {
  const name = `whyme_${accountId}.db`;
  // enableChangeListener powers Drizzle's useLiveQuery: screens update when rows change.
  const sqlite = await openDatabaseAsync(name, { enableChangeListener: true });
  // synchronous = FULL: a write that returned has reached storage, so "Saved offline" is true (OFF01).
  await sqlite.execAsync('PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL;');
  const db = drizzle(sqlite, { schema });
  await migrate(db, migrations);
  return { name, sqlite, db };
}

export type AccountDatabase = Awaited<ReturnType<typeof openAccountDatabase>>;

/** Sign-out with "Discard": close and delete this account's database. */
export async function deleteAccountDatabase(account: AccountDatabase): Promise<void> {
  await account.sqlite.closeAsync();
  await deleteDatabaseAsync(account.name);
}

/** Write-through after an online fetch, so the same screen works offline next time. */
export async function cacheRecord(
  { db }: AccountDatabase,
  kind: string,
  id: string,
  data: unknown,
  serverUpdatedAt: string | null = null,
): Promise<void> {
  const row = { kind, id, data, serverUpdatedAt, fetchedAt: Date.now() };
  await db
    .insert(schema.records)
    .values(row)
    .onConflictDoUpdate({ target: [schema.records.kind, schema.records.id], set: row });
}

/** Live read of one cached record: re-renders when it changes (e.g. after a delta sync). */
export function useCachedRecord<T>({ db }: AccountDatabase, kind: string, id: string) {
  const { data } = useLiveQuery(
    db
      .select()
      .from(schema.records)
      .where(and(eq(schema.records.kind, kind), eq(schema.records.id, id))),
    [kind, id],
  );
  const row = data[0];
  return row ? { data: row.data as T, fetchedAt: row.fetchedAt } : null;
}
