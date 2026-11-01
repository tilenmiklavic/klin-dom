import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { getTestDb, resetDb, signIn, testDeps } from './helpers.js';

beforeEach(resetDb);

const app = createApp(testDeps());
const sub = (endpoint = 'https://push.example/abc') => ({ endpoint, keys: { p256dh: 'p256', auth: 'authkey' }, userAgent: 'Safari' });
const rows = () => getTestDb().query<{ user_id: string; p256dh: string }>('select user_id, p256dh from push_subscriptions');

it('public key is null when VAPID unset; returned when set (no auth needed)', async () => {
  const res = await app.request('/push/public-key');
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ publicKey: null });

  const withKeys = createApp(
    testDeps({
      config: loadConfig({
        AUTH_MODE: 'dev', AUTH_DEV_SECRET: 's', ALLOW_DEV_AUTH: 'true',
        VAPID_PUBLIC_KEY: 'pub', VAPID_PRIVATE_KEY: 'priv', VAPID_SUBJECT: 'mailto:a@b.si',
      }),
    }),
  );
  expect(await (await withKeys.request('/push/public-key')).json()).toEqual({ publicKey: 'pub' });
});

it('POST /push/subscriptions stores and returns id', async () => {
  const { client, id } = await signIn(app, 'alice');
  const res = await client.post('/push/subscriptions', sub());
  expect(res.status).toBe(201);
  const body = (await res.json()) as { id: string };
  expect(body.id).toMatch(/^[0-9a-f-]{36}$/);
  expect(await rows()).toEqual([{ user_id: id, p256dh: 'p256' }]);
});

it('requires auth to subscribe', async () => {
  const res = await app.request('/push/subscriptions', { method: 'POST', body: JSON.stringify(sub()), headers: { 'content-type': 'application/json' } });
  expect(res.status).toBe(401);
});

it('re-posting the same endpoint as another user moves it to that user', async () => {
  const a = await signIn(app, 'alice');
  const b = await signIn(app, 'bob');
  await a.client.post('/push/subscriptions', sub());
  await b.client.post('/push/subscriptions', sub());
  expect(await rows()).toEqual([{ user_id: b.id, p256dh: 'p256' }]);
});

it('DELETE /push/subscriptions/:id deletes own', async () => {
  const a = await signIn(app, 'alice');
  const { id } = (await (await a.client.post('/push/subscriptions', sub())).json()) as { id: string };
  const res = await a.client.del(`/push/subscriptions/${id}`);
  expect(res.status).toBe(204);
  expect(await rows()).toEqual([]);
});

it("DELETE of someone else's subscription returns 404 and keeps the row", async () => {
  const a = await signIn(app, 'alice');
  const b = await signIn(app, 'bob');
  const { id } = (await (await a.client.post('/push/subscriptions', sub())).json()) as { id: string };
  expect((await b.client.del(`/push/subscriptions/${id}`)).status).toBe(404);
  expect(await rows()).toHaveLength(1);
});

it('invalid body → 400', async () => {
  const a = await signIn(app, 'alice');
  expect((await a.client.post('/push/subscriptions', { endpoint: 'nope', keys: { p256dh: 'x', auth: 'y' } })).status).toBe(400);
  expect((await a.client.post('/push/subscriptions', { endpoint: 'https://x.si/p' })).status).toBe(400);
});

it('rejects push endpoints that are not public https URLs', async () => {
  const a = await signIn(app, 'alice');
  for (const endpoint of ['http://push.example/abc', 'https://127.0.0.1/abc', 'https://[::1]/abc', 'https://localhost/abc', 'https://10.0.0.8:8443/abc']) {
    expect((await a.client.post('/push/subscriptions', sub(endpoint))).status, endpoint).toBe(400);
  }
  expect((await a.client.post('/push/subscriptions', sub('https://fcm.googleapis.com/fcm/send/abc'))).status).toBe(201);
});
