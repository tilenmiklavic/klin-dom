import type { HistoryDto } from '@klindom/shared';
import { Hono } from 'hono';
import { requireMember } from '../access.js';
import type { AppDeps, AppEnv } from '../app.js';
import { requireUser } from '../auth/middleware.js';
import { HttpError } from '../errors.js';
import { listAwards } from '../repo/awards.js';
import { loadRings } from '../repo/dashboard.js';

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

export function awardRoutes(deps: AppDeps) {
  const { db, clock } = deps;
  const auth = requireUser(deps);
  const r = new Hono<AppEnv>();

  r.post('/homes/:id/awards/seen', auth, async (c) => {
    const homeId = c.req.param('id');
    const userId = c.get('user').id;
    await requireMember(db, homeId, userId);
    await db.query('update home_members set awards_seen_at = now() where home_id = $1 and user_id = $2', [homeId, userId]);
    return c.body(null, 204);
  });

  r.get('/homes/:id/history', auth, async (c) => {
    const homeId = c.req.param('id');
    await requireMember(db, homeId, c.get('user').id);
    const month = c.req.query('month') ?? '';
    if (!MONTH.test(month)) throw new HttpError(400, 'invalid_input', 'month must be YYYY-MM');
    const days = await db.query<{ date: string; done: number; total: number; closed: boolean }>(
      `select to_char(date, 'YYYY-MM-DD') as date, today_done as done, today_total as total, closed
       from daily_rings
       where home_id = $1 and date >= ($2 || '-01')::date and date < (($2 || '-01')::date + interval '1 month')
       order by date`,
      [homeId, month],
    );
    const { rings, today } = await loadRings(db, homeId, null, 'all', clock.now());
    const body: HistoryDto = {
      month,
      days,
      today: { date: today, done: rings.today.done, total: rings.today.total },
      awards: await listAwards(db, homeId),
    };
    return c.json(body);
  });

  return r;
}
