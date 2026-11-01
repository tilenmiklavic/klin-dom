import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { TokenVerifier } from './auth/verify.js';
import type { Clock } from './clock.js';
import type { Config } from './config.js';
import type { Db } from './db.js';
import type { Notifier } from './push/notifier.js';
import { errorBody, errorHandler } from './errors.js';
import { completionRoutes } from './routes/completions.js';
import { dashboardRoutes } from './routes/dashboard.js';
import { devRoutes } from './routes/dev.js';
import { homeRoutes } from './routes/homes.js';
import { inviteRoutes } from './routes/invites.js';
import { memberRoutes } from './routes/members.js';
import { meRoutes } from './routes/me.js';
import { pushRoutes } from './routes/push.js';
import { roomRoutes } from './routes/rooms.js';
import { statsRoutes } from './routes/stats.js';
import { suggestionRoutes } from './routes/suggestions.js';
import { taskRoutes } from './routes/tasks.js';

export interface AppDeps {
  clock: Clock;
  config: Config;
  db: Db;
  notifier: Notifier;
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
  app.use(
    '*',
    cors({
      origin: deps.config.APP_URL,
      allowHeaders: ['Authorization', 'Content-Type'],
      allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      maxAge: 600,
    }),
  );
  app.get('/healthz', (c) => c.json({ ok: true }));
  if (deps.config.AUTH_MODE === 'dev') app.route('/', devRoutes(deps));
  app.route('/', meRoutes(deps));
  app.route('/', homeRoutes(deps));
  app.route('/', memberRoutes(deps));
  app.route('/', pushRoutes(deps));
  app.route('/', inviteRoutes(deps));
  app.route('/', roomRoutes(deps));
  app.route('/', taskRoutes(deps));
  app.route('/', completionRoutes(deps));
  app.route('/', dashboardRoutes(deps));
  app.route('/', statsRoutes(deps));
  app.route('/', suggestionRoutes(deps));
  app.notFound((c) => c.json(errorBody('not_found', 'Not found'), 404));
  app.onError(errorHandler);
  return app;
}
