import { Hono } from 'hono';
import type { TokenVerifier } from './auth/verify.js';
import type { Clock } from './clock.js';
import type { Config } from './config.js';
import type { Db } from './db.js';
import { errorBody, errorHandler } from './errors.js';
import { completionRoutes } from './routes/completions.js';
import { homeRoutes } from './routes/homes.js';
import { inviteRoutes } from './routes/invites.js';
import { meRoutes } from './routes/me.js';
import { roomRoutes } from './routes/rooms.js';
import { taskRoutes } from './routes/tasks.js';

export interface AppDeps {
  clock: Clock;
  config: Config;
  db: Db;
  verifier: TokenVerifier;
}

export interface CurrentUser {
  id: string;
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
}

export type AppEnv = { Variables: { user: CurrentUser } };

export function createApp(deps: AppDeps): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  app.get('/healthz', (c) => c.json({ ok: true }));
  app.route('/', meRoutes(deps));
  app.route('/', homeRoutes(deps));
  app.route('/', inviteRoutes(deps));
  app.route('/', roomRoutes(deps));
  app.route('/', taskRoutes(deps));
  app.route('/', completionRoutes(deps));
  app.notFound((c) => c.json(errorBody('not_found', 'Not found'), 404));
  app.onError(errorHandler);
  return app;
}
