import { createApp } from '../src/app.js';
import { testDeps } from './helpers.js';

it('GET /healthz returns ok', async () => {
  const app = createApp(testDeps());
  const res = await app.request('/healthz');
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ ok: true });
});

it('unknown route returns error shape', async () => {
  const res = await createApp(testDeps()).request('/nope');
  expect(res.status).toBe(404);
  expect(await res.json()).toEqual({ error: { code: 'not_found', message: expect.any(String) } });
});
