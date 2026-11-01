import { PushSubscriptionInput } from '@klindom/shared';
import { Hono } from 'hono';
import type { AppDeps, AppEnv } from '../app.js';
import { requireUser } from '../auth/middleware.js';
import { HttpError, parseBody } from '../errors.js';

export function pushRoutes(deps: AppDeps) {
  const { db, config } = deps;
  const auth = requireUser(deps);
  const r = new Hono<AppEnv>();

  r.get('/push/public-key', (c) => c.json({ publicKey: config.VAPID_PUBLIC_KEY ?? null }));

  // Subscriptions belong to a user, not a home. An endpoint is one browser profile, so re-posting it moves it.
  r.post('/push/subscriptions', auth, async (c) => {
    const user = c.get('user');
    const input = await parseBody(c, PushSubscriptionInput);
    const [row] = await db.query<{ id: string }>(
      `insert into push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
       values ($1, $2, $3, $4, $5)
       on conflict (endpoint) do update
         set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, user_agent = excluded.user_agent
       returning id`,
      [user.id, input.endpoint, input.keys.p256dh, input.keys.auth, input.userAgent ?? null],
    );
    return c.json({ id: row!.id }, 201);
  });

  r.delete('/push/subscriptions/:id', auth, async (c) => {
    const user = c.get('user');
    const id = c.req.param('id');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      throw new HttpError(404, 'not_found', 'Subscription not found');
    }
    const rows = await db.query(`delete from push_subscriptions where id = $1 and user_id = $2 returning id`, [id, user.id]);
    if (rows.length === 0) throw new HttpError(404, 'not_found', 'Subscription not found');
    return c.body(null, 204);
  });

  return r;
}
