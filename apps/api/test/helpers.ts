import { SignJWT } from 'jose';
import type { Hono } from 'hono';
import type { AppDeps } from '../src/app.js';
import { devVerifier } from '../src/auth/verify.js';
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
    config: loadConfig({ AUTH_MODE: 'dev', AUTH_DEV_SECRET: TEST_SECRET, APP_URL: 'http://localhost:8081' }),
    db: getTestDb(),
    verifier: devVerifier(TEST_SECRET),
    ...overrides,
  };
}

const TEST_SECRET = 'test-secret';

export async function tokenFor(sub: string, claims: { email?: string; name?: string } = {}): Promise<string> {
  return new SignJWT({ email: claims.email, user_metadata: { full_name: claims.name } })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(sub)
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(TEST_SECRET));
}

export function authed(app: Hono<any>, token: string) {
  const send = (method: string, path: string, body?: unknown) =>
    app.request(path, {
      method,
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  return {
    get: (path: string) => send('GET', path),
    post: (path: string, body?: unknown) => send('POST', path, body ?? {}),
    patch: (path: string, body: unknown) => send('PATCH', path, body),
    put: (path: string, body: unknown) => send('PUT', path, body),
    del: (path: string, body?: unknown) => send('DELETE', path, body),
  };
}
