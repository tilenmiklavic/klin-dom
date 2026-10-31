import { z } from 'zod';
import { Hono } from 'hono';
import type { AppDeps, AppEnv } from '../app.js';
import { requireUser } from '../auth/middleware.js';
import { HttpError, parseBody } from '../errors.js';
import { memberCount, removeMembership } from '../repo/homes.js';

const UpdateMeInput = z.object({ displayName: z.string().trim().min(1).max(60) });

export function meRoutes(deps: AppDeps) {
  const { db } = deps;
  const auth = requireUser(deps);
  const r = new Hono<AppEnv>();
  r.post('/me/bootstrap', auth, async (c) => {
    const user = c.get('user');
    const homes = await deps.db.query<{ id: string; name: string; role: string }>(
      `select h.id, h.name, m.role from home_members m join homes h on h.id = m.home_id
       where m.user_id = $1 order by m.joined_at`,
      [user.id],
    );
    return c.json({ user, homes });
  });

  r.patch('/me', auth, async (c) => {
    const user = c.get('user');
    const { displayName } = await parseBody(c, UpdateMeInput);
    await db.query('update users set display_name = $2 where id = $1', [user.id, displayName]);
    return c.json({ ...user, displayName });
  });

  r.delete('/me', auth, async (c) => {
    const user = c.get('user');
    const now = deps.clock.now();
    await db.tx(async (q) => {
      // Lock the user's homes first: a concurrent invite accept (FK key-share on homes) waits,
      // so the counts read below cannot change before the writes.
      const homeIds = (await q.query<{ home_id: string }>('select home_id from home_members where user_id = $1', [user.id])).map((m) => m.home_id);
      await q.query('select id from homes where id = any($1::uuid[]) order by id for update', [homeIds]);
      const memberships = await q.query<{ home_id: string; role: string }>(
        'select home_id, role from home_members where user_id = $1',
        [user.id],
      );
      const counts = new Map<string, number>();
      for (const m of memberships) counts.set(m.home_id, await memberCount(q, m.home_id));
      if (memberships.some((m) => m.role === 'owner' && counts.get(m.home_id)! > 1)) {
        throw new HttpError(409, 'transfer_required', 'Hand your homes over to someone before deleting your account');
      }
      for (const m of memberships) {
        if (counts.get(m.home_id) === 1) await q.query('delete from homes where id = $1', [m.home_id]);
        else await removeMembership(q, m.home_id, user.id);
      }
      await q.query('update invites set revoked_at = $2 where created_by = $1 and revoked_at is null', [user.id, now]);
      await q.query('delete from push_subscriptions where user_id = $1', [user.id]);
      await q.query(
        `update users set display_name = null, email = null, avatar_url = null,
           auth_subject = 'deleted:' || id, deleted_at = $2 where id = $1`,
        [user.id, now],
      );
    });
    return c.body(null, 204);
  });
  return r;
}
