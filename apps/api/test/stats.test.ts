import { createApp } from '../src/app.js';
import { FixedClock } from '../src/clock.js';
import { addMember, resetDb, setupHomeWithRooms, signIn, testDeps } from './helpers.js';

beforeEach(resetDb);

const clock = new FixedClock(new Date('2026-10-31T09:00:00Z'));
const app = createApp(testDeps({ clock }));

async function setup() {
  clock.set(new Date('2026-10-31T09:00:00Z'));
  const ctx = await setupHomeWithRooms(app);
  const ana = await signIn(app, 'ana', 'Ana');
  await addMember(ctx.homeId, ana.id);
  const create = async (body: Record<string, unknown>) =>
    (await ctx.owner.client.post(`/homes/${ctx.homeId}/tasks`, {
      icon: 'dishes', intervalCount: 1, intervalUnit: 'day', startDate: '2026-10-26', ...body,
    })).json();
  const k = await create({ name: 'Dishes', roomIds: [ctx.kitchen.id], startDate: '2026-10-27' });
  const b = await create({ name: 'Mop floors', roomIds: [ctx.kitchen.id, ctx.bath.id] });
  const x = await create({ name: 'Surfaces', roomIds: [ctx.kitchen.id], assigneeId: ana.id });
  const completeAt = async (client: typeof ctx.owner.client, taskId: string, iso: string) => {
    clock.set(new Date(iso));
    await client.post(`/tasks/${taskId}/complete`);
  };
  await completeAt(ctx.owner.client, k.id, '2026-10-27T10:00:00Z');
  await completeAt(ctx.owner.client, b.id, '2026-10-28T10:00:00Z');
  await completeAt(ctx.owner.client, x.id, '2026-10-29T10:00:00Z');
  await completeAt(ana.client, k.id, '2026-10-31T10:00:00Z');
  clock.set(new Date('2026-10-31T12:00:00Z'));
  return { ...ctx, ana };
}

it('summarises who did what this week', async () => {
  const { owner, homeId, ana, kitchen, bath } = await setup();
  const res = await owner.client.get(`/homes/${homeId}/stats?range=week`);
  expect(res.status).toBe(200);
  const stats = await res.json();
  expect(stats).toMatchObject({ from: '2026-10-26', to: '2026-11-01', total: 4 });
  expect(stats.perMember).toEqual([
    { userId: owner.id, name: 'Tilen', done: 3, onTime: 1 },
    { userId: ana.id, name: 'Ana', done: 1, onTime: 0 },
  ]);
  expect(stats.perRoom).toEqual([
    { roomId: kitchen.id, name: 'Kitchen', done: 4 },
    { roomId: bath.id, name: 'Bathroom', done: 1 },
  ]);
  expect(stats.doneForOthers).toEqual([{ byUserId: owner.id, forUserId: ana.id, count: 1 }]);
  expect(stats.perDay).toHaveLength(7);
  expect(stats.perDay.find((d: { date: string }) => d.date === '2026-10-30')).toEqual({ date: '2026-10-30', done: 0 });
  expect(stats.perDay.find((d: { date: string }) => d.date === '2026-10-31')).toEqual({ date: '2026-10-31', done: 1 });
});

it('covers the calendar month', async () => {
  const { owner, homeId } = await setup();
  const stats = await (await owner.client.get(`/homes/${homeId}/stats?range=month`)).json();
  expect(stats).toMatchObject({ from: '2026-10-01', to: '2026-10-31', total: 4 });
  expect(stats.perDay).toHaveLength(31);
});

it('rejects custom ranges over 366 days', async () => {
  const { owner, homeId } = await setup();
  const res = await owner.client.get(`/homes/${homeId}/stats?range=custom&from=2025-01-01&to=2026-10-31`);
  expect(res.status).toBe(400);
});

it('hides stats from non-members', async () => {
  const { homeId } = await setup();
  const stranger = await signIn(app, 'stranger');
  expect((await stranger.client.get(`/homes/${homeId}/stats?range=week`)).status).toBe(404);
});
