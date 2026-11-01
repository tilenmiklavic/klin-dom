import { createApp } from '../src/app.js';
import { FixedClock } from '../src/clock.js';
import { runSnapshots } from '../src/jobs/snapshots.js';
import { runJobs } from '../src/jobs/run.js';
import { memoryNotifier } from '../src/push/notifier.js';
import { getTestDb, insertTask, resetDb, setupHome, testDeps } from './helpers.js';

beforeEach(resetDb);

const app = createApp(testDeps());
const depsAt = (iso: string) => ({ db: getTestDb(), clock: new FixedClock(new Date(iso)), notifier: memoryNotifier() });
const rows = () =>
  getTestDb().query<{ date: string; today_done: number; today_total: number; closed: boolean; fresh_pct: number }>(
    `select to_char(date, 'YYYY-MM-DD') as date, today_done, today_total, closed, fresh_pct from daily_rings order by date`,
  );
const setCreated = (homeId: string, iso: string) => getTestDb().query('update homes set created_at = $2 where id = $1', [homeId, iso]);

it("writes yesterday's row once per home after local midnight", async () => {
  const { homeId } = await setupHome(app);
  await setCreated(homeId, '2026-10-01T00:00:00Z');
  const deps = depsAt('2026-11-01T23:05:00Z'); // 00:05 on 2 Nov in Ljubljana (CET)
  expect(await runSnapshots(deps)).toBe(1);
  expect((await rows()).map((r) => r.date)).toEqual(['2026-11-01']);
  expect(await runSnapshots(deps)).toBe(0);
});

it('LA home at 2026-10-31T07:30Z writes 2026-10-30', async () => {
  const { homeId } = await setupHome(app);
  await getTestDb().query(`update homes set timezone = 'America/Los_Angeles', created_at = '2026-10-01T00:00:00Z' where id = $1`, [homeId]);
  expect(await runSnapshots(depsAt('2026-10-31T07:30:00Z'))).toBe(1);
  expect((await rows()).map((r) => r.date)).toEqual(['2026-10-30']);
});

it('no row for days before the home existed', async () => {
  const { homeId } = await setupHome(app);
  await setCreated(homeId, '2026-11-02T10:00:00Z');
  expect(await runSnapshots(depsAt('2026-11-02T12:00:00Z'))).toBe(0);
  expect(await rows()).toEqual([]);
});

it('values match the live rings computed just before midnight', async () => {
  const { owner, homeId } = await setupHome(app);
  await setCreated(homeId, '2026-10-01T00:00:00Z');
  const taskId = await insertTask(homeId, owner.id, { nextDueDate: '2026-11-01' });
  await getTestDb().query(
    `insert into completions (task_id, home_id, user_id, kind, completed_at, due_date, prev_next_due_date, room_ids, interval_count, interval_unit)
     values ($1, $2, $3, 'done', '2026-11-01T15:00:00Z', '2026-11-01', '2026-11-01', '{}', 1, 'day')`,
    [taskId, homeId, owner.id],
  );
  await getTestDb().query(`update tasks set next_due_date = '2026-11-02' where id = $1`, [taskId]);
  expect(await runSnapshots(depsAt('2026-11-01T23:05:00Z'))).toBe(1);
  expect(await rows()).toEqual([{ date: '2026-11-01', today_done: 1, today_total: 1, closed: true, fresh_pct: 100 }]);
});

it('runJobs reports the snapshot count', async () => {
  const { homeId } = await setupHome(app);
  await setCreated(homeId, '2026-10-01T00:00:00Z');
  const summary = await runJobs(depsAt('2026-11-01T23:05:00Z'));
  expect(summary.snapshots).toBe(1);
});
