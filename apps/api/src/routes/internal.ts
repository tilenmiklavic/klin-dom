import { createHash, timingSafeEqual } from 'node:crypto';
import { Hono } from 'hono';
import type { AppDeps, AppEnv } from '../app.js';
import { errorBody } from '../errors.js';
import { runJobs } from '../jobs/run.js';

// Hashing first gives equal-length buffers, so neither the content nor the length of the secret leaks.
function sameSecret(given: string, expected: string): boolean {
  const digest = (s: string) => createHash('sha256').update(s).digest();
  return timingSafeEqual(digest(given), digest(expected));
}

/** Hit every minute by an external cron where no worker runs. No user auth: the cron secret is the auth. */
export function internalRoutes(deps: AppDeps) {
  const r = new Hono<AppEnv>();

  r.post('/internal/run-reminders', async (c) => {
    const secret = deps.config.CRON_SECRET;
    // Unconfigured, the endpoint doesn't exist.
    if (!secret) return c.json(errorBody('not_found', 'Not found'), 404);
    if (!sameSecret(c.req.header('authorization') ?? '', `Bearer ${secret}`)) {
      return c.json(errorBody('unauthorized', 'Invalid cron secret'), 401);
    }
    return c.json(await runJobs(deps));
  });

  return r;
}
