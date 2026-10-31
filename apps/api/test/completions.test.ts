import { createApp } from '../src/app.js';
import { FixedClock } from '../src/clock.js';
import { addMember, getTestDb, resetDb, setupHomeWithRooms, signIn, testDeps } from './helpers.js';

beforeEach(resetDb);

const clock = new FixedClock(new Date('2026-10-31T09:00:00Z'));
const app = createApp(testDeps({ clock }));
beforeEach(() => clock.set(new Date('2026-10-31T09:00:00Z')));

async function setupTask(extra: Record<string, unknown> = {}) {
  const ctx = await setupHomeWithRooms(app);
  const res = await ctx.owner.client.post(`/homes/${ctx.homeId}/tasks`, {
    name: 'Vacuum', icon: 'vacuum', roomIds: [ctx.kitchen.id], intervalCount: 1, intervalUnit: 'week', ...extra,
  });
  return { ...ctx, task: await res.json() };
}

it('completes a task on time and advances it from the completion date', async () => {
  const { owner, task } = await setupTask();
  const res = await owner.client.post(`/tasks/${task.id}/complete`);
  expect(res.status).toBe(201);
  const body = await res.json();
  expect(body.task.nextDueDate).toBe('2026-11-07');
  expect(body.completion).toMatchObject({ kind: 'done', dueDate: '2026-10-31', onTime: true, userName: 'Tilen' });
});

it('counts the next due date from when a late task was actually done', async () => {
  const { owner, task } = await setupTask({ intervalCount: 4, startDate: '2026-10-26' });
  const body = await (await owner.client.post(`/tasks/${task.id}/complete`)).json();
  expect(body.task.nextDueDate).toBe('2026-11-28');
  expect(body.completion.onTime).toBe(false);
});

it('records exactly one completion when two people tick at once', async () => {
  const { owner, homeId, task } = await setupTask();
  const ana = await signIn(app, 'ana', 'Ana');
  await addMember(homeId, ana.id);
  const results = await Promise.all([
    owner.client.post(`/tasks/${task.id}/complete`, { dueDate: '2026-10-31' }),
    ana.client.post(`/tasks/${task.id}/complete`, { dueDate: '2026-10-31' }),
  ]);
  expect(results.map((r) => r.status).sort()).toEqual([200, 201]);
  const rows = await getTestDb().query(`select id from completions where task_id = $1 and kind = 'done'`, [task.id]);
  expect(rows).toHaveLength(1);
  const [after] = await getTestDb().query<{ next_due_date: string }>('select next_due_date from tasks where id = $1', [task.id]);
  expect(after!.next_due_date).toBe('2026-11-07');
});

it('skip moves the task one interval from today without counting as done', async () => {
  const { owner, task } = await setupTask({ startDate: '2026-10-28' });
  const res = await owner.client.post(`/tasks/${task.id}/skip`);
  expect(res.status).toBe(201);
  const body = await res.json();
  expect(body.task).toMatchObject({ nextDueDate: '2026-11-07', lastCompletedAt: null });
  const history = await (await owner.client.get(`/tasks/${task.id}/history`)).json();
  expect(history.map((h: { kind: string }) => h.kind)).toEqual(['skip']);
});

it('undo restores the previous due date and last completion', async () => {
  const { owner, task } = await setupTask();
  const { completion } = await (await owner.client.post(`/tasks/${task.id}/complete`)).json();
  const res = await owner.client.del(`/completions/${completion.id}`);
  expect(res.status).toBe(200);
  expect((await res.json()).task).toMatchObject({ nextDueDate: '2026-10-31', lastCompletedAt: null });
  expect(await (await owner.client.get(`/tasks/${task.id}/history`)).json()).toEqual([]);
});

it('only the latest completion can be undone', async () => {
  const { owner, task } = await setupTask();
  const first = (await (await owner.client.post(`/tasks/${task.id}/complete`)).json()).completion;
  clock.set(new Date('2026-11-07T09:00:00Z'));
  await owner.client.post(`/tasks/${task.id}/complete`);
  const res = await owner.client.del(`/completions/${first.id}`);
  expect(res.status).toBe(409);
  expect(await res.json()).toMatchObject({ error: { code: 'not_latest' } });
});

it('another member cannot undo someone else’s completion', async () => {
  const { owner, homeId, task } = await setupTask();
  const ana = await signIn(app, 'ana', 'Ana');
  const ben = await signIn(app, 'ben', 'Ben');
  await addMember(homeId, ana.id);
  await addMember(homeId, ben.id);
  const { completion } = await (await ana.client.post(`/tasks/${task.id}/complete`)).json();
  expect((await ben.client.del(`/completions/${completion.id}`)).status).toBe(403);
  expect((await owner.client.del(`/completions/${completion.id}`)).status).toBe(200);
});

it('shows a departed member as Former member in history', async () => {
  const { owner, homeId, task } = await setupTask();
  const ana = await signIn(app, 'ana', 'Ana');
  await addMember(homeId, ana.id);
  await ana.client.post(`/tasks/${task.id}/complete`);
  await ana.client.post(`/homes/${homeId}/leave`);
  const history = await (await owner.client.get(`/tasks/${task.id}/history`)).json();
  expect(history[0].userName).toBe('Former member');
});

it('hides tasks of other homes from completing', async () => {
  const { task } = await setupTask();
  const stranger = await signIn(app, 'stranger');
  expect((await stranger.client.post(`/tasks/${task.id}/complete`)).status).toBe(404);
});
