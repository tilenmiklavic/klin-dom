import { createApp } from '../src/app.js';
import { authed, getTestDb, resetDb, testDeps, tokenFor } from './helpers.js';

beforeEach(resetDb);

const app = () => createApp(testDeps());

it('rejects requests without a token', async () => {
  const res = await app().request('/me/bootstrap', { method: 'POST' });
  expect(res.status).toBe(401);
  expect(await res.json()).toMatchObject({ error: { code: 'unauthorized' } });
});

it('rejects a garbage token', async () => {
  const res = await authed(app(), 'not-a-jwt').post('/me/bootstrap');
  expect(res.status).toBe(401);
});

it('bootstraps a new user from the token', async () => {
  const res = await authed(app(), await tokenFor('u1', { name: 'Tilen', email: 't@example.com' })).post('/me/bootstrap');
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.user).toMatchObject({ displayName: 'Tilen', email: 't@example.com', id: expect.any(String) });
  expect(body.homes).toEqual([]);
});

it('creates only one user row across repeated calls', async () => {
  const token = await tokenFor('u1', { name: 'Tilen' });
  await authed(app(), token).post('/me/bootstrap');
  await authed(app(), token).post('/me/bootstrap');
  const [row] = await getTestDb().query<{ count: string }>('select count(*) from users');
  expect(row!.count).toBe('1');
});

it('rejects a deleted user', async () => {
  const token = await tokenFor('u1', { name: 'Tilen' });
  await authed(app(), token).post('/me/bootstrap');
  await getTestDb().query('update users set deleted_at = now()');
  const res = await authed(app(), token).post('/me/bootstrap');
  expect(res.status).toBe(401);
});

describe('account', () => {
  it('renames the user', async () => {
    const { signIn } = await import('./helpers.js');
    const a = createApp(testDeps());
    const u = await signIn(a, 'u1', 'Tilen');
    const res = await u.client.patch('/me', { displayName: 'Tilen M' });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: u.id, displayName: 'Tilen M' });
    expect((await u.client.patch('/me', { displayName: '' })).status).toBe(400);
  });

  it('refuses to delete an owner who still has other members', async () => {
    const { setupHome, addMember, signIn } = await import('./helpers.js');
    const a = createApp(testDeps());
    const { owner, homeId } = await setupHome(a);
    const other = await signIn(a, 'other', 'Other');
    await addMember(homeId, other.id);
    const res = await owner.client.del('/me');
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: { code: 'transfer_required' } });
    const [row] = await getTestDb().query<{ deleted_at: Date | null; display_name: string }>(
      'select deleted_at, display_name from users where id = $1', [owner.id]);
    expect(row).toMatchObject({ deleted_at: null, display_name: 'Tilen' });
  });

  it('deletes a plain member, tombstones them and lets the identity sign up fresh', async () => {
    const { setupHomeWithRooms, addMember, signIn, tokenFor: tf } = await import('./helpers.js');
    const { insertTask } = await import('./helpers.js');
    const a = createApp(testDeps());
    const { owner, homeId } = await setupHomeWithRooms(a);
    const member = await signIn(a, 'member', 'Mia');
    await addMember(homeId, member.id);
    const taskId = await insertTask(homeId, owner.id);
    expect((await member.client.post(`/tasks/${taskId}/complete`, { dueDate: '2026-10-31' })).status).toBe(201);
    await getTestDb().query(
      `insert into push_subscriptions (user_id, endpoint, p256dh, auth) values ($1, 'https://push/x', 'k', 'a')`, [member.id]);

    expect((await member.client.del('/me')).status).toBe(204);

    const [row] = await getTestDb().query<Record<string, unknown>>('select * from users where id = $1', [member.id]);
    expect(row).toMatchObject({ display_name: null, email: null, avatar_url: null });
    expect(row!.deleted_at).toBeInstanceOf(Date);
    const [subs] = await getTestDb().query<{ count: string }>('select count(*) from push_subscriptions where user_id = $1', [member.id]);
    expect(subs!.count).toBe('0');
    const [mem] = await getTestDb().query<{ count: string }>('select count(*) from home_members where user_id = $1', [member.id]);
    expect(mem!.count).toBe('0');

    const history = (await (await owner.client.get(`/tasks/${taskId}/history`)).json()) as { userName: string }[];
    expect(history[0]!.userName).toBe('Former member');

    expect(row!.auth_subject).toBe(`deleted:${member.id}`);

    const again = await authed(a, await tf('member', { name: 'Mia' })).post('/me/bootstrap');
    expect(again.status).toBe(200);
    const body = await again.json();
    expect(body.user.id).not.toBe(member.id);
    expect(body.homes).toEqual([]);
  });

  it('deletes the home of a sole owner along with the account', async () => {
    const { setupHome } = await import('./helpers.js');
    const a = createApp(testDeps());
    const { owner, homeId } = await setupHome(a);
    expect((await owner.client.del('/me')).status).toBe(204);
    const [row] = await getTestDb().query('select 1 from homes where id = $1', [homeId]);
    expect(row).toBeUndefined();
  });
});
