import pg from 'pg';

export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  tx<T>(fn: (q: Db) => Promise<T>): Promise<T>;
  /** Runs `fn` while holding a session advisory lock; resolves to undefined if someone else holds it. */
  withAdvisoryLock<T>(key: number, fn: () => Promise<T>): Promise<T | undefined>;
}

// Return DATE columns as plain YYYY-MM-DD strings instead of JS Dates.
pg.types.setTypeParser(pg.types.builtins.DATE, (value) => value);

// Lock and unlock must run on the same connection: session advisory locks belong to it.
async function lockedOn<T>(client: pg.PoolClient, key: number, fn: () => Promise<T>): Promise<T | undefined> {
  const [row] = (await client.query<{ locked: boolean }>('select pg_try_advisory_lock($1::bigint) as locked', [key])).rows;
  if (!row?.locked) return undefined;
  try {
    return await fn();
  } finally {
    await client.query('select pg_advisory_unlock($1::bigint)', [key]);
  }
}

function clientDb(client: pg.PoolClient): Db {
  return {
    async query<T>(sql: string, params?: unknown[]) {
      return (await client.query(sql, params)).rows as T[];
    },
    async tx<T>(fn: (q: Db) => Promise<T>) {
      return fn(this);
    },
    withAdvisoryLock: (key, fn) => lockedOn(client, key, fn),
  };
}

export type DatabaseSsl = 'off' | 'require' | 'verify';

/** `require` encrypts without verifying the certificate (Supabase pooler); `verify` also checks the chain. */
function sslOption(mode: DatabaseSsl): pg.PoolConfig['ssl'] {
  if (mode === 'require') return { rejectUnauthorized: false };
  return mode === 'verify' ? true : undefined;
}

/**
 * pg reads `sslmode` from the URL and lets it override the `ssl` option (`require` becomes strict verification),
 * so when DATABASE_SSL manages TLS the URL's own sslmode is dropped.
 */
export function connectionUrl(url: string, mode: DatabaseSsl): string {
  if (mode === 'off') return url;
  const parsed = new URL(url);
  if (!parsed.searchParams.has('sslmode')) return url;
  parsed.searchParams.delete('sslmode');
  return parsed.toString();
}

export function createDb(url: string, opts: { ssl?: DatabaseSsl } = {}): Db & { end(): Promise<void>; pool: pg.Pool } {
  const mode = opts.ssl ?? 'off';
  const pool = new pg.Pool({ connectionString: connectionUrl(url, mode), ssl: sslOption(mode) });
  return {
    pool,
    async query<T>(sql: string, params?: unknown[]) {
      return (await pool.query(sql, params)).rows as T[];
    },
    async tx<T>(fn: (q: Db) => Promise<T>) {
      const client = await pool.connect();
      try {
        await client.query('begin');
        const result = await fn(clientDb(client));
        await client.query('commit');
        return result;
      } catch (err) {
        await client.query('rollback');
        throw err;
      } finally {
        client.release();
      }
    },
    async withAdvisoryLock<T>(key: number, fn: () => Promise<T>) {
      const client = await pool.connect();
      let broken: Error | undefined;
      try {
        return await lockedOn(client, key, fn);
      } catch (err) {
        // On any error the connection is destroyed, not pooled, so a failed unlock can't leave the lock held.
        broken = err as Error;
        throw err;
      } finally {
        client.release(broken);
      }
    },
    end: () => pool.end(),
  };
}
