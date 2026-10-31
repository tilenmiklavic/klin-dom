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
  const send = async (method: string, path: string, body?: unknown): Promise<Response> =>
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

/** Signs in a user (creating the row) and returns their client and id. */
export async function signIn(app: Hono<any>, sub: string, name = sub) {
  const client = authed(app, await tokenFor(sub, { name }));
  const res = await client.post('/me/bootstrap');
  const body = (await res.json()) as { user: { id: string } };
  return { client, id: body.user.id };
}

export async function addMember(homeId: string, userId: string): Promise<void> {
  await getTestDb().query(`insert into home_members (home_id, user_id, role) values ($1, $2, 'member')`, [homeId, userId]);
}

/** Creates a home through the API, owned by a freshly signed-in user. */
export async function setupHome(app: Hono<any>, name = 'Miklavič home') {
  const owner = await signIn(app, 'owner', 'Tilen');
  const res = await owner.client.post('/homes', { name, timezone: 'Europe/Ljubljana' });
  const home = (await res.json()) as { id: string };
  return { owner, homeId: home.id };
}

/** Inserts a task directly (for tests that predate or bypass the tasks API). */
export async function insertTask(homeId: string, createdBy: string, opts: { assigneeId?: string; nextDueDate?: string } = {}) {
  const db = getTestDb();
  const [room] = await db.query<{ id: string }>(
    `insert into rooms (home_id, name, icon) values ($1, 'Kitchen', 'dishes') returning id`,
    [homeId],
  );
  const [task] = await db.query<{ id: string }>(
    `insert into tasks (home_id, name, icon, interval_count, interval_unit, next_due_date, created_by, assignee_id)
     values ($1, 'Dishes', 'dishes', 1, 'day', $2, $3, $4) returning id`,
    [homeId, opts.nextDueDate ?? '2026-10-31', createdBy, opts.assigneeId ?? null],
  );
  await db.query('insert into task_rooms (task_id, room_id) values ($1, $2)', [task!.id, room!.id]);
  return task!.id;
}

/** A home with a Kitchen and a Bathroom, created through the API. */
export async function setupHomeWithRooms(app: Hono<any>) {
  const ctx = await setupHome(app);
  const post = async (body: unknown) => (await ctx.owner.client.post(`/homes/${ctx.homeId}/rooms`, body)).json();
  const kitchen = (await post({ name: 'Kitchen', icon: 'dishes' })) as { id: string };
  const bath = (await post({ name: 'Bathroom', icon: 'spray' })) as { id: string };
  return { ...ctx, kitchen, bath };
}
