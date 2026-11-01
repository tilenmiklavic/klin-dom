import { getTestDb, resetDb } from './helpers.js';

const db = getTestDb();

beforeEach(resetDb);

async function seedTask(): Promise<string> {
  const [user] = await db.query<{ id: string }>(
    `insert into users (auth_provider, auth_subject) values ('dev', 'u1') returning id`,
  );
  const [home] = await db.query<{ id: string }>(
    `insert into homes (name, timezone, owner_id) values ('Home', 'Europe/Ljubljana', $1) returning id`,
    [user!.id],
  );
  const [task] = await db.query<{ id: string }>(
    `insert into tasks (home_id, name, icon, interval_count, interval_unit, next_due_date, created_by)
     values ($1, 'Dishes', 'dishes', 1, 'day', '2026-10-31', $2) returning id`,
    [home!.id, user!.id],
  );
  return task!.id;
}

async function insertCompletion(taskId: string, kind: 'done' | 'skip') {
  const [task] = await db.query<{ home_id: string; created_by: string }>(
    'select home_id, created_by from tasks where id = $1',
    [taskId],
  );
  await db.query(
    `insert into completions (task_id, home_id, user_id, kind, completed_at, due_date, prev_next_due_date, room_ids, interval_count, interval_unit)
     values ($1, $2, $3, $4, now(), '2026-10-31', '2026-10-31', '{}', 1, 'day')`,
    [taskId, task!.home_id, task!.created_by, kind],
  );
}

it('starts with an empty database after reset', async () => {
  const [row] = await db.query<{ count: string }>('select count(*) from homes');
  expect(row!.count).toBe('0');
});

it('allows two done completions for the same due date (early completions)', async () => {
  const taskId = await seedTask();
  await insertCompletion(taskId, 'done');
  await expect(insertCompletion(taskId, 'done')).resolves.toBeUndefined();
});

it('every table has RLS enabled', async () => {
  const rows = await db.query<{ relname: string; relrowsecurity: boolean }>(
    `select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r'`,
  );
  expect(rows.length).toBeGreaterThan(0);
  expect(rows.filter((r) => !r.relrowsecurity).map((r) => r.relname)).toEqual([]);
});
