import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { authed, resetDb, testDeps } from './helpers.js';

beforeEach(resetDb);

it('issues a dev token that bootstrap accepts', async () => {
  const app = createApp(testDeps());
  const res = await app.request('/dev/token', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sub: 'dev-1', name: 'Dev Person', email: 'dev@example.com' }),
  });
  expect(res.status).toBe(200);
  const { token } = (await res.json()) as { token: string };
  const boot = await authed(app, token).post('/me/bootstrap');
  expect(boot.status).toBe(200);
  expect((await boot.json()).user).toMatchObject({ displayName: 'Dev Person', email: 'dev@example.com' });
});

it('rejects a dev token request without sub', async () => {
  const res = await createApp(testDeps()).request('/dev/token', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });
  expect(res.status).toBe(400);
});

it('does not exist outside dev mode', async () => {
  const config = loadConfig({ AUTH_MODE: 'jwks', AUTH_JWKS_URL: 'https://example.com/jwks', AUTH_ISSUER: 'https://example.com' });
  const res = await createApp(testDeps({ config })).request('/dev/token', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sub: 'x' }),
  });
  expect(res.status).toBe(404);
});
