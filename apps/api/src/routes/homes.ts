import {
  CreateHomeInput,
  DeleteHomeInput,
  TransferHomeInput,
  UpdateHomeInput,
} from '@klindom/shared';
import { Hono } from 'hono';
import { requireMember, requireOwner } from '../access.js';
import type { AppDeps, AppEnv } from '../app.js';
import { requireUser } from '../auth/middleware.js';
import { HttpError, parseBody } from '../errors.js';
import { getHome, insertHome, listMembers, memberCount, removeMembership } from '../repo/homes.js';
import { applySuggestions } from '../suggestions.js';
import { localDate } from '@klindom/shared';

export function homeRoutes(deps: AppDeps) {
  const { db } = deps;
  const auth = requireUser(deps);
  const r = new Hono<AppEnv>();

  r.post('/homes', auth, async (c) => {
    const input = await parseBody(c, CreateHomeInput);
    const user = c.get('user');
    const homeId = await db.tx(async (q) => {
      const id = await insertHome(q, input.name, input.timezone, user.id);
      if (input.suggestions) {
        await applySuggestions(q, id, user.id, input.suggestions, localDate(deps.clock.now(), input.timezone));
      }
      return id;
    });
    return c.json(await getHome(db, homeId, user.id), 201);
  });

  r.get('/homes/:id', auth, async (c) => {
    const user = c.get('user');
    await requireMember(db, c.req.param('id'), user.id);
    return c.json(await getHome(db, c.req.param('id'), user.id));
  });

  r.patch('/homes/:id', auth, async (c) => {
    const user = c.get('user');
    const homeId = c.req.param('id');
    await requireOwner(db, homeId, user.id);
    const input = await parseBody(c, UpdateHomeInput);
    await db.query('update homes set name = coalesce($2, name), timezone = coalesce($3, timezone) where id = $1', [
      homeId,
      input.name ?? null,
      input.timezone ?? null,
    ]);
    return c.json(await getHome(db, homeId, user.id));
  });

  r.delete('/homes/:id', auth, async (c) => {
    const user = c.get('user');
    const homeId = c.req.param('id');
    await requireOwner(db, homeId, user.id);
    const { confirmName } = await parseBody(c, DeleteHomeInput);
    const home = await getHome(db, homeId, user.id);
    if (confirmName !== home.name) throw new HttpError(400, 'confirm_mismatch', 'Type the home name to delete it');
    await db.query('delete from homes where id = $1', [homeId]);
    return c.body(null, 204);
  });

  r.get('/homes/:id/members', auth, async (c) => {
    await requireMember(db, c.req.param('id'), c.get('user').id);
    return c.json(await listMembers(db, c.req.param('id')));
  });

  r.delete('/homes/:id/members/:userId', auth, async (c) => {
    const homeId = c.req.param('id');
    const target = c.req.param('userId');
    const user = c.get('user');
    await requireOwner(db, homeId, user.id);
    if (target === user.id) throw new HttpError(400, 'cannot_remove_self', 'Use leave home instead');
    await requireMember(db, homeId, target);
    await db.tx(async (q) => {
      await removeMembership(q, homeId, target);
      await q.query('update invites set revoked_at = $3 where home_id = $1 and created_by = $2 and revoked_at is null', [
        homeId, target, deps.clock.now(),
      ]);
      await q.query(
        `insert into home_removals (home_id, user_id, removed_at) values ($1, $2, $3)
         on conflict (home_id, user_id) do update set removed_at = excluded.removed_at`,
        [homeId, target, deps.clock.now()],
      );
    });
    return c.body(null, 204);
  });

  r.post('/homes/:id/leave', auth, async (c) => {
    const homeId = c.req.param('id');
    const user = c.get('user');
    const { role } = await requireMember(db, homeId, user.id);
    if (role === 'owner') {
      if ((await memberCount(db, homeId)) > 1) {
        throw new HttpError(409, 'transfer_required', 'Hand the home over to someone before leaving');
      }
      await db.query('delete from homes where id = $1', [homeId]);
      return c.json({ homeDeleted: true });
    }
    await db.tx((q) => removeMembership(q, homeId, user.id));
    return c.json({ homeDeleted: false });
  });

  r.post('/homes/:id/transfer', auth, async (c) => {
    const homeId = c.req.param('id');
    const user = c.get('user');
    await requireOwner(db, homeId, user.id);
    const { userId } = await parseBody(c, TransferHomeInput);
    await requireMember(db, homeId, userId);
    await db.tx(async (q) => {
      await q.query(`update home_members set role = 'member' where home_id = $1 and user_id = $2`, [homeId, user.id]);
      await q.query(`update home_members set role = 'owner' where home_id = $1 and user_id = $2`, [homeId, userId]);
      await q.query('update homes set owner_id = $2 where id = $1', [homeId, userId]);
    });
    return c.json(await getHome(db, homeId, user.id));
  });

  return r;
}
