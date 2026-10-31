import { createApp } from '../src/app.js';
import { addMember, getTestDb, resetDb, setupHome, setupHomeWithRooms, signIn, testDeps } from './helpers.js';

beforeEach(resetDb);

const app = createApp(testDeps());

const vacuum = (roomIds: string[], extra: Record<string, unknown> = {}) => ({
  name: 'Vacuum',
  icon: 'vacuum',
  roomIds,
  intervalCount: 1,
  intervalUnit: 'week',
  ...extra,
});

it('creates a multi-room task due today with a default reminder', async () => {
  const { owner, homeId, kitchen, bath } = await setupHomeWithRooms(app);
  const res = await owner.client.post(`/homes/${homeId}/tasks`, vacuum([kitchen.id, bath.id]));
  expect(res.status).toBe(201);
  const task = await res.json();
  expect(task).toMatchObject({
    name: 'Vacuum',
    nextDueDate: '2026-10-31',
    reminderOffsets: [0],
    assigneeId: null,
    overdue: false,
    mutedByMe: false,
  });
  expect(task.rooms.map((r: { name: string }) => r.name).sort()).toEqual(['Bathroom', 'Kitchen']);
});

it('rejects a room from another home', async () => {
  const { owner, homeId } = await setupHomeWithRooms(app);
  const other = await setupHomeWithRooms(createApp(testDeps()));
  void other;
  const foreign = await getTestDb().query<{ id: string }>('select id from rooms where home_id <> $1 limit 1', [homeId]);
  const res = await owner.client.post(`/homes/${homeId}/tasks`, vacuum([foreign[0]!.id]));
  expect(res.status).toBe(400);
  expect(await res.json()).toMatchObject({ error: { code: 'invalid_room' } });
});

it('rejects an assignee who is not a member', async () => {
  const { owner, homeId, kitchen } = await setupHomeWithRooms(app);
  const stranger = await signIn(app, 'stranger');
  const res = await owner.client.post(`/homes/${homeId}/tasks`, vacuum([kitchen.id], { assigneeId: stranger.id }));
  expect(res.status).toBe(400);
  expect(await res.json()).toMatchObject({ error: { code: 'invalid_assignee' } });
});

it('scope=mine shows my and household tasks but not others', async () => {
  const { owner, homeId, kitchen } = await setupHomeWithRooms(app);
  const ana = await signIn(app, 'ana', 'Ana');
  await addMember(homeId, ana.id);
  await owner.client.post(`/homes/${homeId}/tasks`, vacuum([kitchen.id], { name: 'Household' }));
  await owner.client.post(`/homes/${homeId}/tasks`, vacuum([kitchen.id], { name: 'Mine', assigneeId: owner.id }));
  await owner.client.post(`/homes/${homeId}/tasks`, vacuum([kitchen.id], { name: 'Anas', assigneeId: ana.id }));
  const mine = await (await owner.client.get(`/homes/${homeId}/tasks?scope=mine`)).json();
  expect(mine.map((t: { name: string }) => t.name)).toEqual(['Household', 'Mine']);
  const all = await (await owner.client.get(`/homes/${homeId}/tasks`)).json();
  expect(all).toHaveLength(3);
});

it('recomputes the next due date when the interval changes', async () => {
  const { owner, homeId, kitchen } = await setupHomeWithRooms(app);
  const task = await (await owner.client.post(`/homes/${homeId}/tasks`, vacuum([kitchen.id]))).json();
  await getTestDb().query(`update tasks set last_completed_at = '2026-10-20T08:00:00Z' where id = $1`, [task.id]);
  const res = await owner.client.patch(`/tasks/${task.id}`, { intervalCount: 2 });
  expect(await res.json()).toMatchObject({ intervalCount: 2, nextDueDate: '2026-11-03' });
});

it('keeps the next due date of a never-completed task when the interval changes', async () => {
  const { owner, homeId, kitchen } = await setupHomeWithRooms(app);
  const task = await (await owner.client.post(`/homes/${homeId}/tasks`, vacuum([kitchen.id], { startDate: '2026-11-04' }))).json();
  const res = await owner.client.patch(`/tasks/${task.id}`, { intervalUnit: 'month' });
  expect(await res.json()).toMatchObject({ nextDueDate: '2026-11-04' });
});

it('updates rooms and reminders', async () => {
  const { owner, homeId, kitchen, bath } = await setupHomeWithRooms(app);
  const task = await (await owner.client.post(`/homes/${homeId}/tasks`, vacuum([kitchen.id]))).json();
  const res = await owner.client.patch(`/tasks/${task.id}`, { roomIds: [bath.id], reminderOffsets: [60, 0] });
  const updated = await res.json();
  expect(updated.rooms.map((r: { name: string }) => r.name)).toEqual(['Bathroom']);
  expect(updated.reminderOffsets).toEqual([0, 60]);
});

it('toggles mute for the caller only', async () => {
  const { owner, homeId, kitchen } = await setupHomeWithRooms(app);
  const task = await (await owner.client.post(`/homes/${homeId}/tasks`, vacuum([kitchen.id]))).json();
  expect(await (await owner.client.put(`/tasks/${task.id}/mute`, { muted: true })).json()).toMatchObject({ mutedByMe: true });
  expect(await (await owner.client.put(`/tasks/${task.id}/mute`, { muted: false })).json()).toMatchObject({ mutedByMe: false });
});

it('archives a task', async () => {
  const { owner, homeId, kitchen } = await setupHomeWithRooms(app);
  const task = await (await owner.client.post(`/homes/${homeId}/tasks`, vacuum([kitchen.id]))).json();
  expect((await owner.client.del(`/tasks/${task.id}`)).status).toBe(204);
  expect(await (await owner.client.get(`/homes/${homeId}/tasks`)).json()).toEqual([]);
  expect((await owner.client.get(`/tasks/${task.id}`)).status).toBe(404);
});

it('hides tasks from other homes with 404', async () => {
  const { owner, homeId, kitchen } = await setupHomeWithRooms(app);
  const task = await (await owner.client.post(`/homes/${homeId}/tasks`, vacuum([kitchen.id]))).json();
  const stranger = await signIn(app, 'stranger');
  expect((await stranger.client.get(`/tasks/${task.id}`)).status).toBe(404);
});

it('requires at least one room', async () => {
  const { owner, homeId } = await setupHome(app);
  expect((await owner.client.post(`/homes/${homeId}/tasks`, vacuum([]))).status).toBe(400);
});
