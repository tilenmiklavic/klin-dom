import { Hono } from 'hono';
import type { AppDeps, AppEnv } from '../app.js';
import { requireUser } from '../auth/middleware.js';

export function meRoutes(deps: AppDeps) {
  const r = new Hono<AppEnv>();
  r.post('/me/bootstrap', requireUser(deps), async (c) => {
    const user = c.get('user');
    const homes = await deps.db.query<{ id: string; name: string; role: string }>(
      `select h.id, h.name, m.role from home_members m join homes h on h.id = m.home_id
       where m.user_id = $1 order by m.joined_at`,
      [user.id],
    );
    return c.json({ user, homes });
  });
  return r;
}
