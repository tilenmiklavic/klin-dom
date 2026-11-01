import { createApp } from '../src/app.js';
import { addMember, getTestDb, resetDb, setupHomeWithRooms, signIn, testDeps } from './helpers.js';

beforeEach(resetDb);

const app = createApp(testDeps());

async function setup() {
  const ctx = await setupHomeWithRooms(app);
  const ana = await signIn(app, 'ana', 'Ana');
  await addMember(ctx.homeId, ana.id);
  const create = async (body: Record<string, unknown>) =>
    (await ctx.owner.client.post(`/homes/${ctx.homeId}/tasks`, {
      icon: 'vacuum', roomIds: [ctx.kitchen.id], intervalCount: 1, intervalUnit: 'week', ...body,
    })).json();
  const dishes = await create({ name: 'Dishes', icon: 'dishes', intervalUnit: 'day' });
  const windows = await create({ name: 'Clean windows', icon: 'window', intervalCount: 4, startDate: '2026-10-26', assigneeId: ana.id });
  const fridge = await create({ name: 'Clean fridge', icon: 'sponge', intervalUnit: 'month', startDate: '2026-11-10' });
  return { ...ctx, ana, dishes, windows, fridge };
}

it('returns rings and the due-today list', async () => {
  const { owner, homeId } = await setup();
  const res = await owner.client.get(`/homes/${homeId}/dashboard`);
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.rings).toEqual({
    today: { done: 0, total: 2 },
    week: { done: 0, total: 3 },
    fresh: { notOverdue: 2, total: 3, pct: 67 },
  });
  expect(body.dueToday.map((t: { name: string }) => t.name)).toEqual(['Clean windows', 'Dishes']);
  expect(body.doneToday).toEqual([]);
});

it('scope=mine leaves out tasks assigned to someone else', async () => {
  const { owner, homeId } = await setup();
  const body = await (await owner.client.get(`/homes/${homeId}/dashboard?scope=mine`)).json();
  expect(body.rings.today).toEqual({ done: 0, total: 1 });
  expect(body.dueToday.map((t: { name: string }) => t.name)).toEqual(['Dishes']);
});

it('returns updated rings when a task is completed', async () => {
  const { owner, homeId, dishes } = await setup();
  const res = await owner.client.post(`/tasks/${dishes.id}/complete`, { dueDate: '2026-10-31' });
  const body = await res.json();
  expect(body.rings.today).toEqual({ done: 1, total: 2 });
  const dash = await (await owner.client.get(`/homes/${homeId}/dashboard`)).json();
  expect(dash.doneToday).toEqual([
    expect.objectContaining({ taskName: 'Dishes', taskIcon: 'dishes', roomNames: ['Kitchen'], userName: 'Tilen' }),
  ]);
});

it('hides the dashboard from non-members', async () => {
  const { homeId } = await setup();
  const stranger = await signIn(app, 'stranger');
  expect((await stranger.client.get(`/homes/${homeId}/dashboard`)).status).toBe(404);
});

it('returns streak: closed past days plus a closed today', async () => {
  const { owner, homeId, dishes, windows } = await setup();
  await getTestDb().query(
    `insert into daily_rings (home_id, date, today_done, today_total, closed, week_done, week_total, fresh_pct)
     select $1, d::date, 2, 2, true, 2, 5, 100 from unnest($2::text[]) d`,
    [homeId, ['2026-10-30', '2026-10-29', '2026-10-28']],
  );
  expect((await (await owner.client.get(`/homes/${homeId}/dashboard`)).json()).streak).toBe(3);
  await owner.client.post(`/tasks/${dishes.id}/complete`, { dueDate: '2026-10-31' });
  await owner.client.post(`/tasks/${windows.id}/complete`, { dueDate: '2026-10-26' });
  expect((await (await owner.client.get(`/homes/${homeId}/dashboard`)).json()).streak).toBe(4);
});

it('streak is household-wide whatever the scope', async () => {
  const { owner, homeId, dishes } = await setup();
  // Owner's own ring closes; the household ring stays open because Ana's task is still due.
  await owner.client.post(`/tasks/${dishes.id}/complete`, { dueDate: '2026-10-31' });
  const mine = await (await owner.client.get(`/homes/${homeId}/dashboard?scope=mine`)).json();
  expect(mine.rings.today).toEqual({ done: 1, total: 1 });
  const all = await (await owner.client.get(`/homes/${homeId}/dashboard`)).json();
  expect(all.streak).toBe(0);
  expect(mine.streak).toBe(all.streak);
});
