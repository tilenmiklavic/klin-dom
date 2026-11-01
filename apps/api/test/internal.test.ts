import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { resetDb, testDeps } from './helpers.js';

beforeEach(resetDb);

const devEnv = { AUTH_MODE: 'dev', AUTH_DEV_SECRET: 's', ALLOW_DEV_AUTH: 'true' };
const withSecret = createApp(testDeps({ config: loadConfig({ ...devEnv, CRON_SECRET: 'cron-secret' }) }));
const run = (app: ReturnType<typeof createApp>, authorization?: string) =>
  app.request('/internal/run-reminders', { method: 'POST', headers: authorization ? { authorization } : {} });

it('404 when CRON_SECRET unset', async () => {
  const app = createApp(testDeps());
  const res = await run(app, 'Bearer anything');
  expect(res.status).toBe(404);
  expect(await res.json()).toEqual({ error: { code: 'not_found', message: 'Not found' } });
});

it('401 on wrong secret', async () => {
  expect((await run(withSecret)).status).toBe(401);
  expect((await run(withSecret, 'Bearer wrong')).status).toBe(401);
  expect((await run(withSecret, 'Bearer cron-secret-but-longer')).status).toBe(401);
  expect((await run(withSecret, 'cron-secret')).status).toBe(401);
});

it('200 with summary on right secret', async () => {
  const res = await run(withSecret, 'Bearer cron-secret');
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ ran: true, reminders: { sent: 0, failed: 0, gone: 0 }, snapshots: 0, awards: 0 });
});
