import { Hono } from 'hono';
import type { Clock } from './clock.js';
import type { Config } from './config.js';
import { errorBody, errorHandler } from './errors.js';

export interface AppDeps {
  clock: Clock;
  config: Config;
}

export function createApp(deps: AppDeps): Hono {
  const app = new Hono();
  app.get('/healthz', (c) => c.json({ ok: true }));
  app.notFound((c) => c.json(errorBody('not_found', 'Not found'), 404));
  app.onError(errorHandler);
  return app;
}
