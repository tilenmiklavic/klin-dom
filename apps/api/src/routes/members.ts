import { MemberSettingsInput, type MemberSettingsDto } from '@klindom/shared';
import { Hono } from 'hono';
import { requireMember } from '../access.js';
import type { AppDeps, AppEnv } from '../app.js';
import { requireUser } from '../auth/middleware.js';
import { parseBody } from '../errors.js';
import type { Db } from '../db.js';

async function readSettings(db: Db, homeId: string, userId: string): Promise<MemberSettingsDto> {
  const [row] = await db.query<MemberSettingsDto>(
    `select notifications_enabled as "notificationsEnabled",
            to_char(default_reminder_time, 'HH24:MI') as "defaultReminderTime"
       from home_members where home_id = $1 and user_id = $2`,
    [homeId, userId],
  );
  return row!;
}

export function memberRoutes(deps: AppDeps) {
  const { db } = deps;
  const auth = requireUser(deps);
  const r = new Hono<AppEnv>();

  r.get('/homes/:id/members/me', auth, async (c) => {
    const user = c.get('user');
    const homeId = c.req.param('id');
    await requireMember(db, homeId, user.id);
    return c.json(await readSettings(db, homeId, user.id));
  });

  r.patch('/homes/:id/members/me', auth, async (c) => {
    const user = c.get('user');
    const homeId = c.req.param('id');
    await requireMember(db, homeId, user.id);
    const input = await parseBody(c, MemberSettingsInput);
    await db.query(
      `update home_members
          set notifications_enabled = coalesce($3, notifications_enabled),
              default_reminder_time = coalesce($4::time, default_reminder_time)
        where home_id = $1 and user_id = $2`,
      [homeId, user.id, input.notificationsEnabled ?? null, input.defaultReminderTime ?? null],
    );
    return c.json(await readSettings(db, homeId, user.id));
  });

  return r;
}
