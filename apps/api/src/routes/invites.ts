import { Hono } from 'hono';
import { homeIdOf, requireMember } from '../access.js';
import type { AppDeps, AppEnv } from '../app.js';
import { requireUser } from '../auth/middleware.js';
import { HttpError } from '../errors.js';
import { getHome } from '../repo/homes.js';
import { findActiveInvite, insertInvite, type InviteRow } from '../repo/invites.js';

export function inviteRoutes(deps: AppDeps) {
  const { db } = deps;
  const auth = requireUser(deps);
  const r = new Hono<AppEnv>();

  const toDto = (row: InviteRow) => ({
    id: row.id,
    code: row.code,
    url: `${deps.config.APP_URL}/join/${row.code}`,
    createdAt: row.created_at.toISOString(),
    createdBy: row.created_by,
  });

  r.post('/homes/:id/invites', auth, async (c) => {
    const homeId = c.req.param('id');
    const user = c.get('user');
    await requireMember(db, homeId, user.id);
    return c.json(toDto(await insertInvite(db, homeId, user.id)), 201);
  });

  r.get('/homes/:id/invites', auth, async (c) => {
    const homeId = c.req.param('id');
    await requireMember(db, homeId, c.get('user').id);
    const rows = await db.query<InviteRow>(
      `select id, home_id, code, created_by, created_at from invites
       where home_id = $1 and revoked_at is null order by created_at desc`,
      [homeId],
    );
    return c.json(rows.map(toDto));
  });

  r.delete('/invites/:id', auth, async (c) => {
    const inviteId = c.req.param('id');
    const user = c.get('user');
    const homeId = await homeIdOf(db, 'invites', inviteId);
    const { role } = await requireMember(db, homeId, user.id);
    const [invite] = await db.query<{ created_by: string }>('select created_by from invites where id = $1', [inviteId]);
    if (role !== 'owner' && invite!.created_by !== user.id) {
      throw new HttpError(403, 'forbidden', 'Only the owner or the person who made the invite can revoke it');
    }
    await db.query('update invites set revoked_at = now() where id = $1 and revoked_at is null', [inviteId]);
    return c.body(null, 204);
  });

  // Public: lets the join screen show "Join <home>?" before sign-in.
  r.get('/invites/:code', async (c) => {
    const invite = await findActiveInvite(db, c.req.param('code'));
    if (!invite) throw new HttpError(404, 'not_found', 'This invite is no longer valid');
    return c.json({ homeName: invite.home_name, inviterName: invite.inviter_name });
  });

  r.post('/invites/:code/accept', auth, async (c) => {
    const user = c.get('user');
    const invite = await findActiveInvite(db, c.req.param('code'));
    if (!invite) throw new HttpError(404, 'not_found', 'This invite is no longer valid');
    await db.query(
      `insert into home_members (home_id, user_id, role) values ($1, $2, 'member') on conflict do nothing`,
      [invite.home_id, user.id],
    );
    return c.json(await getHome(db, invite.home_id, user.id));
  });

  return r;
}
