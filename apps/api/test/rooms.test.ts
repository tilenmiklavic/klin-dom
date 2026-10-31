import { createApp } from '../src/app.js';
import { getTestDb, resetDb, setupHome, signIn, testDeps } from './helpers.js';

beforeEach(resetDb);

const app = createApp(testDeps());

async function withRooms() {
  const ctx = await setupHome(app);
  const kitchen = await (await ctx.owner.client.post(`/homes/${ctx.homeId}/rooms`, { name: 'Kitchen', icon: 'dishes' })).json();
  const bath = await (await ctx.owner.client.post(`/homes/${ctx.homeId}/rooms`, { name: 'Bathroom', icon: 'spray' })).json();
  return { ...ctx, kitchen, bath };
}

async function linkTask(homeId: string, userId: string, roomIds: string[]) {
  const db = getTestDb();
  const [task] = await db.query<{ id: string }>(
    `insert into tasks (home_id, name, icon, interval_count, interval_unit, next_due_date, created_by)
     values ($1, 'Mop floors', 'bucket', 2, 'week', '2026-10-31', $2) returning id`,
    [homeId, userId],
  );
  for (const roomId of roomIds) await db.query('insert into task_rooms values ($1, $2)', [task!.id, roomId]);
  return task!.id;
}

it('creates, lists, renames and orders rooms', async () => {
  const { owner, homeId, kitchen, bath } = await withRooms();
  expect(kitchen).toMatchObject({ name: 'Kitchen', icon: 'dishes', sortOrder: 1 });
  expect(bath.sortOrder).toBe(2);
  expect((await owner.client.patch(`/rooms/${kitchen.id}`, { name: 'Kitchen & dining' })).status).toBe(200);
  expect((await owner.client.post(`/homes/${homeId}/rooms/order`, { roomIds: [bath.id, kitchen.id] })).status).toBe(200);
  const list = await (await owner.client.get(`/homes/${homeId}/rooms`)).json();
  expect(list.map((r: { name: string }) => r.name)).toEqual(['Bathroom', 'Kitchen & dining']);
});

it('rejects an unknown icon', async () => {
  const { owner, homeId } = await setupHome(app);
  const res = await owner.client.post(`/homes/${homeId}/rooms`, { name: 'Attic', icon: 'rocket' });
  expect(res.status).toBe(400);
});

it('rejects a reorder containing a foreign room', async () => {
  const { owner, homeId, kitchen } = await withRooms();
  const res = await owner.client.post(`/homes/${homeId}/rooms/order`, { roomIds: [kitchen.id, crypto.randomUUID()] });
  expect(res.status).toBe(400);
});

it('hides rooms from other homes with 404', async () => {
  const { kitchen } = await withRooms();
  const stranger = await signIn(app, 'stranger');
  expect((await stranger.client.patch(`/rooms/${kitchen.id}`, { name: 'Mine' })).status).toBe(404);
});

it('archives a room whose tasks have another room', async () => {
  const { owner, homeId, kitchen, bath } = await withRooms();
  const taskId = await linkTask(homeId, owner.id, [kitchen.id, bath.id]);
  expect((await owner.client.del(`/rooms/${kitchen.id}`)).status).toBe(204);
  const list = await (await owner.client.get(`/homes/${homeId}/rooms`)).json();
  expect(list.map((r: { name: string }) => r.name)).toEqual(['Bathroom']);
  const links = await getTestDb().query('select room_id from task_rooms where task_id = $1', [taskId]);
  expect(links).toEqual([{ room_id: bath.id }]);
});

it('refuses to archive the only room of a task', async () => {
  const { owner, homeId, kitchen } = await withRooms();
  await linkTask(homeId, owner.id, [kitchen.id]);
  const res = await owner.client.del(`/rooms/${kitchen.id}`);
  expect(res.status).toBe(409);
  expect(await res.json()).toMatchObject({ error: { code: 'room_has_tasks' } });
});
