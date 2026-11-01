import { createApp } from '../src/app.js';
import { FixedClock } from '../src/clock.js';
import { runReminders } from '../src/jobs/reminders.js';
import { runJobs } from '../src/jobs/run.js';
import { memoryNotifier } from '../src/push/notifier.js';
import { addMember, getTestDb, insertTask, resetDb, setupHome, signIn, testDeps } from './helpers.js';

beforeEach(resetDb);

// 08:00 in Ljubljana (CET): the default reminder time, so an untimed task due today fires now at offset 0.
const NOW = new Date('2026-10-31T07:00:00Z');
const app = createApp(testDeps());

function jobDeps() {
  return { db: getTestDb(), clock: new FixedClock(NOW), notifier: memoryNotifier() };
}

async function subscribe(userId: string, endpoint: string) {
  await getTestDb().query(`insert into push_subscriptions (user_id, endpoint, p256dh, auth) values ($1, $2, 'p', 'a')`, [
    userId,
    endpoint,
  ]);
}

async function remind(taskId: string, offsets: number[] = [0]) {
  await getTestDb().query('insert into task_reminders (task_id, offset_minutes) select $1, unnest($2::int[])', [taskId, offsets]);
}

const logRows = () =>
  getTestDb().query<{ user_id: string; due_date: string; offset_minutes: number }>(
    'select user_id, due_date, offset_minutes from reminder_log order by user_id',
  );

/** Owner and Bob, both members with one subscription each. */
async function household() {
  const { owner, homeId } = await setupHome(app);
  const bob = await signIn(app, 'bob', 'Bob');
  await addMember(homeId, bob.id);
  await subscribe(owner.id, 'https://push.example/owner');
  await subscribe(bob.id, 'https://push.example/bob');
  return { owner, bob, homeId };
}

it('sends to every enabled member for a household task, with copy and url /tasks/<id>', async () => {
  const { owner, homeId } = await household();
  const taskId = await insertTask(homeId, owner.id);
  await remind(taskId);
  const deps = jobDeps();

  expect(await runReminders(deps)).toEqual({ sent: 2, failed: 0, gone: 0 });
  const payload = { title: 'Dishes is due today', body: 'Kitchen', url: `/tasks/${taskId}`, tag: `task-${taskId}` };
  expect([...deps.notifier.sent].sort((a, b) => a.endpoint.localeCompare(b.endpoint))).toEqual([
    { endpoint: 'https://push.example/bob', payload },
    { endpoint: 'https://push.example/owner', payload },
  ]);
  expect(await logRows()).toHaveLength(2);
});

it('assigned task goes to the assignee only', async () => {
  const { owner, bob, homeId } = await household();
  const taskId = await insertTask(homeId, owner.id, { assigneeId: bob.id });
  await remind(taskId);
  const deps = jobDeps();

  await runReminders(deps);
  expect(deps.notifier.sent.map((s) => s.endpoint)).toEqual(['https://push.example/bob']);
});

it('skips members with notifications off, and muted members', async () => {
  const { owner, bob, homeId } = await household();
  const carol = await signIn(app, 'carol', 'Carol');
  await addMember(homeId, carol.id);
  await subscribe(carol.id, 'https://push.example/carol');
  const taskId = await insertTask(homeId, owner.id);
  await remind(taskId);
  await getTestDb().query('update home_members set notifications_enabled = false where user_id = $1', [bob.id]);
  await getTestDb().query('insert into task_reminder_mutes (task_id, user_id) values ($1, $2)', [taskId, carol.id]);
  const deps = jobDeps();

  await runReminders(deps);
  expect(deps.notifier.sent.map((s) => s.endpoint)).toEqual(['https://push.example/owner']);
});

it('an assignee with notifications off gets nothing', async () => {
  const { owner, bob, homeId } = await household();
  const taskId = await insertTask(homeId, owner.id, { assigneeId: bob.id });
  await remind(taskId);
  await getTestDb().query('update home_members set notifications_enabled = false where user_id = $1', [bob.id]);
  const deps = jobDeps();

  expect(await runReminders(deps)).toEqual({ sent: 0, failed: 0, gone: 0 });
  expect(deps.notifier.sent).toEqual([]);
});

it('sends once: a second run in the same minute sends nothing', async () => {
  const { owner, homeId } = await household();
  await remind(await insertTask(homeId, owner.id));
  const deps = jobDeps();

  await runReminders(deps);
  expect(await runReminders(deps)).toEqual({ sent: 0, failed: 0, gone: 0 });
  expect(deps.notifier.sent).toHaveLength(2);
});

it('two concurrent runJobs → each reminder sent exactly once', async () => {
  const { owner, homeId } = await household();
  await remind(await insertTask(homeId, owner.id), [0, 60]);
  const deps = jobDeps();

  const results = await Promise.all([runJobs(deps), runJobs(deps), runJobs(deps)]);
  expect(results.some((r) => r.ran)).toBe(true);
  // Both offsets have fired by 08:00 local (offset 60 at 07:00, inside the grace window): 2 users × 2 offsets.
  const keys = deps.notifier.sent.map((s) => s.endpoint);
  expect(keys.sort()).toEqual([
    'https://push.example/bob',
    'https://push.example/bob',
    'https://push.example/owner',
    'https://push.example/owner',
  ]);
  expect(await logRows()).toHaveLength(4);
});

it('the reminder_log claim alone prevents double sends (no lock)', async () => {
  const { owner, homeId } = await household();
  await remind(await insertTask(homeId, owner.id));
  const deps = jobDeps();

  const results = await Promise.all([runReminders(deps), runReminders(deps), runReminders(deps)]);
  expect(results.reduce((n, r) => n + r.sent, 0)).toBe(2);
  expect(deps.notifier.sent).toHaveLength(2);
});

it('runJobs returns ran: false while another runner holds the lock', async () => {
  const deps = jobDeps();
  const inner = await getTestDb().withAdvisoryLock(7_301_301, async () => {
    // A second connection cannot take the same session lock.
    return runJobs(deps);
  });
  expect(inner).toEqual({ ran: false });
  expect(await runJobs(deps)).toEqual({ ran: true, reminders: { sent: 0, failed: 0, gone: 0 }, snapshots: 0 });
});

it('5-day-overdue task on first run → nothing sent', async () => {
  const { owner, homeId } = await household();
  await remind(await insertTask(homeId, owner.id, { nextDueDate: '2026-10-26' }), [0, 60, 1440]);
  const deps = jobDeps();

  expect(await runReminders(deps)).toEqual({ sent: 0, failed: 0, gone: 0 });
  expect(deps.notifier.sent).toEqual([]);
  expect(await logRows()).toEqual([]);
});

it('gone deletes the subscription; error keeps it', async () => {
  const { owner, bob, homeId } = await household();
  await remind(await insertTask(homeId, owner.id));
  const deps = jobDeps();
  deps.notifier.failWith.set('https://push.example/owner', 'gone');
  deps.notifier.failWith.set('https://push.example/bob', 'error');

  expect(await runReminders(deps)).toEqual({ sent: 0, failed: 1, gone: 1 });
  const subs = await getTestDb().query<{ user_id: string }>('select user_id from push_subscriptions');
  expect(subs).toEqual([{ user_id: bob.id }]);
  expect((await logRows()).map((r) => r.user_id).sort()).toEqual([owner.id, bob.id].sort());

  // Not retried: the claim stays even though delivery failed.
  deps.notifier.failWith.clear();
  expect(await runReminders(deps)).toEqual({ sent: 0, failed: 0, gone: 0 });
});

it('ok updates last_success_at', async () => {
  const { owner, homeId } = await household();
  await remind(await insertTask(homeId, owner.id));
  await runReminders(jobDeps());
  const rows = await getTestDb().query<{ last_success_at: Date | null }>('select last_success_at from push_subscriptions');
  expect(rows.every((r) => r.last_success_at !== null)).toBe(true);
});

it('recipient with no subscriptions → no log row', async () => {
  const { owner, homeId } = await setupHome(app);
  const bob = await signIn(app, 'bob', 'Bob');
  await addMember(homeId, bob.id);
  await subscribe(owner.id, 'https://push.example/owner');
  const taskId = await insertTask(homeId, owner.id);
  await remind(taskId);
  const deps = jobDeps();

  await runReminders(deps);
  expect((await logRows()).map((r) => r.user_id)).toEqual([owner.id]);

  // Bob turns push on half an hour later, still inside the grace window: he gets it.
  await subscribe(bob.id, 'https://push.example/bob');
  deps.clock.set(new Date('2026-10-31T07:30:00Z'));
  expect(await runReminders(deps)).toEqual({ sent: 1, failed: 0, gone: 0 });
  expect(deps.notifier.sent.map((s) => s.endpoint)).toEqual(['https://push.example/owner', 'https://push.example/bob']);
});

it('completed task (next_due_date advanced) → no send for the old date', async () => {
  const { owner, homeId } = await household();
  const taskId = await insertTask(homeId, owner.id);
  await remind(taskId);
  // Done early this morning: next due tomorrow, whose reminder fires tomorrow at 08:00.
  await getTestDb().query(`update tasks set next_due_date = '2026-11-01' where id = $1`, [taskId]);
  const deps = jobDeps();

  expect(await runReminders(deps)).toEqual({ sent: 0, failed: 0, gone: 0 });
  expect(await logRows()).toEqual([]);
});

it('archived tasks and timed tasks follow their own rules', async () => {
  const { owner, homeId } = await household();
  const archived = await insertTask(homeId, owner.id);
  await remind(archived);
  await getTestDb().query('update tasks set archived_at = now() where id = $1', [archived]);
  // Due 09:00 local, 1 hour before = 08:00 local = now.
  const timed = await insertTask(homeId, owner.id);
  await remind(timed, [60]);
  await getTestDb().query(`update tasks set due_time = '09:00' where id = $1`, [timed]);
  const deps = jobDeps();

  await runReminders(deps);
  expect(new Set(deps.notifier.sent.map((s) => s.payload.url))).toEqual(new Set([`/tasks/${timed}`]));
});
