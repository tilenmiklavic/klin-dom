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
