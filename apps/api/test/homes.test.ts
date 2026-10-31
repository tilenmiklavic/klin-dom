import { createApp } from '../src/app.js';
import { addMember, getTestDb, insertTask, resetDb, setupHome, signIn, testDeps } from './helpers.js';

beforeEach(resetDb);

const app = createApp(testDeps());

it('creates a home with the creator as owner', async () => {
  const owner = await signIn(app, 'owner', 'Tilen');
  const res = await owner.client.post('/homes', { name: 'Miklavič home', timezone: 'Europe/Ljubljana' });
  expect(res.status).toBe(201);
  const home = await res.json();
  expect(home).toMatchObject({ name: 'Miklavič home', timezone: 'Europe/Ljubljana', role: 'owner', ownerId: owner.id });
  const boot = await (await owner.client.post('/me/bootstrap')).json();
  expect(boot.homes).toEqual([{ id: home.id, name: 'Miklavič home', role: 'owner' }]);
});

it('rejects an invalid timezone', async () => {
  const owner = await signIn(app, 'owner');
  const res = await owner.client.post('/homes', { name: 'Home', timezone: 'Mars/Base' });
  expect(res.status).toBe(400);
  expect(await res.json()).toMatchObject({ error: { code: 'invalid_input' } });
});

it('hides a home from non-members with 404', async () => {
  const { homeId } = await setupHome(app);
  const stranger = await signIn(app, 'stranger');
  expect((await stranger.client.get(`/homes/${homeId}`)).status).toBe(404);
});

it('lets only the owner rename the home', async () => {
  const { owner, homeId } = await setupHome(app);
  const member = await signIn(app, 'ana', 'Ana');
  await addMember(homeId, member.id);
  expect((await member.client.patch(`/homes/${homeId}`, { name: 'X' })).status).toBe(403);
  const res = await owner.client.patch(`/homes/${homeId}`, { name: 'Our place' });
  expect(res.status).toBe(200);
  expect(await res.json()).toMatchObject({ name: 'Our place' });
});

it('requires the home name to delete it', async () => {
  const { owner, homeId } = await setupHome(app);
  await insertTask(homeId, owner.id);
  const wrong = await owner.client.del(`/homes/${homeId}`, { confirmName: 'nope' });
  expect(wrong.status).toBe(400);
  expect(await wrong.json()).toMatchObject({ error: { code: 'confirm_mismatch' } });
  expect((await owner.client.del(`/homes/${homeId}`, { confirmName: 'Miklavič home' })).status).toBe(204);
  const [rooms] = await getTestDb().query<{ count: string }>('select count(*) from rooms');
  expect(rooms!.count).toBe('0');
});

it('lists members', async () => {
  const { owner, homeId } = await setupHome(app);
  const ana = await signIn(app, 'ana', 'Ana');
  await addMember(homeId, ana.id);
  const members = await (await owner.client.get(`/homes/${homeId}/members`)).json();
  expect(members.map((m: { displayName: string; role: string }) => [m.displayName, m.role])).toEqual([
    ['Tilen', 'owner'],
    ['Ana', 'member'],
  ]);
});

it('returns assigned tasks to the household when a member leaves', async () => {
  const { owner, homeId } = await setupHome(app);
  const ana = await signIn(app, 'ana', 'Ana');
  await addMember(homeId, ana.id);
  const taskId = await insertTask(homeId, owner.id, { assigneeId: ana.id });
  expect((await ana.client.post(`/homes/${homeId}/leave`)).status).toBe(200);
  const [task] = await getTestDb().query<{ assignee_id: string | null }>('select assignee_id from tasks where id = $1', [taskId]);
  expect(task!.assignee_id).toBeNull();
  expect((await ana.client.get(`/homes/${homeId}`)).status).toBe(404);
});

it('lets the owner remove a member, but not themselves', async () => {
  const { owner, homeId } = await setupHome(app);
  const ana = await signIn(app, 'ana', 'Ana');
  await addMember(homeId, ana.id);
  expect((await owner.client.del(`/homes/${homeId}/members/${owner.id}`)).status).toBe(400);
  expect((await ana.client.del(`/homes/${homeId}/members/${owner.id}`)).status).toBe(403);
  expect((await owner.client.del(`/homes/${homeId}/members/${ana.id}`)).status).toBe(204);
  expect((await ana.client.get(`/homes/${homeId}`)).status).toBe(404);
});

it('requires the owner to transfer ownership before leaving', async () => {
  const { owner, homeId } = await setupHome(app);
  const ana = await signIn(app, 'ana', 'Ana');
  await addMember(homeId, ana.id);
  const blocked = await owner.client.post(`/homes/${homeId}/leave`);
  expect(blocked.status).toBe(409);
  expect(await blocked.json()).toMatchObject({ error: { code: 'transfer_required' } });
  expect((await owner.client.post(`/homes/${homeId}/transfer`, { userId: ana.id })).status).toBe(200);
  expect(await (await ana.client.get(`/homes/${homeId}`)).json()).toMatchObject({ role: 'owner', ownerId: ana.id });
  expect((await owner.client.post(`/homes/${homeId}/leave`)).status).toBe(200);
});

it('deletes the home when its sole owner leaves', async () => {
  const { owner, homeId } = await setupHome(app);
  const res = await owner.client.post(`/homes/${homeId}/leave`);
  expect(await res.json()).toEqual({ homeDeleted: true });
  const [row] = await getTestDb().query<{ count: string }>('select count(*) from homes');
  expect(row!.count).toBe('0');
});
