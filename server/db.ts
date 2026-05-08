import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { AsyncLocalStorage } from "async_hooks";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export const db = drizzle(pool, { schema });

/**
 * Per-request AsyncLocalStorage holding a dedicated PoolClient that is inside
 * an open transaction with `app.current_user_id` set LOCAL (transaction-scoped).
 * The setting is automatically cleared when the transaction commits or rolls back,
 * so no user ID can leak to a later request that reuses the same pooled connection.
 */
export const requestClientStorage = new AsyncLocalStorage<pg.PoolClient>();

/**
 * Returns a Drizzle instance backed by the request-scoped PoolClient when
 * running inside a setUserContext middleware context, or the shared pool
 * otherwise. Use this instead of the bare `db` export for any query that
 * must respect Row-Level Security policies.
 */
export function getDb() {
  const client = requestClientStorage.getStore();
  if (client) {
    return drizzle(client as unknown as pg.Client, { schema });
  }
  return db;
}

/**
 * Checks out a connection from the pool, opens a transaction, sets
 * `app.current_user_id` as a transaction-LOCAL variable (equivalent to
 * SET LOCAL — automatically cleared on COMMIT/ROLLBACK), runs the callback
 * inside that context, and commits/releases afterwards.
 *
 * Using is_local=true means the setting cannot outlive the transaction,
 * eliminating any possibility of cross-request user-ID leakage via
 * connection reuse in the pool.
 */
export async function withUserContext<T>(
  userId: string,
  callback: () => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT set_config('app.current_user_id', $1, true)",
      [userId],
    );
    const result = await requestClientStorage.run(client, callback);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
