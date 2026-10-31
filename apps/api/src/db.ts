import pg from 'pg';

export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  tx<T>(fn: (q: Db) => Promise<T>): Promise<T>;
}

// Return DATE columns as plain YYYY-MM-DD strings instead of JS Dates.
pg.types.setTypeParser(pg.types.builtins.DATE, (value) => value);

function clientDb(client: pg.PoolClient): Db {
  return {
    async query<T>(sql: string, params?: unknown[]) {
      return (await client.query(sql, params)).rows as T[];
    },
    async tx<T>(fn: (q: Db) => Promise<T>) {
      return fn(this);
    },
  };
}

export function createDb(url: string): Db & { end(): Promise<void> } {
  const pool = new pg.Pool({ connectionString: url });
  return {
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
    end: () => pool.end(),
  };
}
