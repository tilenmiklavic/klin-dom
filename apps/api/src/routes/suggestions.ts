import { Hono } from 'hono';
import type { AppDeps, AppEnv } from '../app.js';
import { requireUser } from '../auth/middleware.js';
import { catalog } from '../suggestions.js';

export function suggestionRoutes(deps: AppDeps) {
  const r = new Hono<AppEnv>();
  r.get('/suggestions', requireUser(deps), (c) => c.json(catalog));
  return r;
}
