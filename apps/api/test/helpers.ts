import type { AppDeps } from '../src/app.js';
import { FixedClock } from '../src/clock.js';
import { loadConfig } from '../src/config.js';
import { createDb, type Db } from '../src/db.js';

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://klindom:klindom@localhost:54329/klindom_test';

let db: (Db & { end(): Promise<void> }) | undefined;

export function getTestDb(): Db {
  db ??= createDb(TEST_DATABASE_URL);
  return db;
}

afterAll(async () => {
  await db?.end();
  db = undefined;
});

export async function resetDb(): Promise<void> {
  const tables = await getTestDb().query<{ tablename: string }>(
    `select tablename from pg_tables where schemaname = 'public' and tablename <> 'schema_migrations'`,
  );
  if (tables.length === 0) return;
  await getTestDb().query(
    `truncate ${tables.map((t) => `"${t.tablename}"`).join(', ')} restart identity cascade`,
  );
}

export function testDeps(overrides: Partial<AppDeps> = {}): AppDeps {
  return {
    clock: new FixedClock(new Date('2026-10-31T09:00:00Z')),
    config: loadConfig({ AUTH_MODE: 'dev', AUTH_DEV_SECRET: 'test-secret', APP_URL: 'http://localhost:8081' }),
    ...overrides,
  };
}
