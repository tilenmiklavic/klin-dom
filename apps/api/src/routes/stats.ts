import { addInterval, IsoDateSchema, localDate, weekBounds } from '@klindom/shared';
import { Hono } from 'hono';
import { DateTime } from 'luxon';
import { requireMember } from '../access.js';
import type { AppDeps, AppEnv } from '../app.js';
import { requireUser } from '../auth/middleware.js';
import { HttpError, parseWith } from '../errors.js';
import { homeTimezone } from '../repo/homes.js';

function resolveRange(range: string | undefined, from: string | undefined, to: string | undefined, today: string) {
  if (range === 'month') {
    const start = DateTime.fromISO(today).startOf('month');
    return { from: start.toISODate()!, to: start.endOf('month').toISODate()! };
  }
  if (range === 'custom') {
    const f = parseWith(IsoDateSchema, from);
    const t = parseWith(IsoDateSchema, to);
    if (f > t || addInterval(f, 366, 'day') < t) {
      throw new HttpError(400, 'invalid_input', 'Pick a range of up to 366 days');
    }
    return { from: f, to: t };
  }
  const { start, end } = weekBounds(today);
  return { from: start, to: end };
}

export function statsRoutes(deps: AppDeps) {
  const { db, clock } = deps;
  const auth = requireUser(deps);
  const r = new Hono<AppEnv>();

  r.get('/homes/:id/stats', auth, async (c) => {
    const homeId = c.req.param('id');
    await requireMember(db, homeId, c.get('user').id);
    const tz = await homeTimezone(db, homeId);
    const { from, to } = resolveRange(c.req.query('range'), c.req.query('from'), c.req.query('to'), localDate(clock.now(), tz));

    // All done completions in range, with local completion date, as a CTE.
    const base = `
      with done as (
        select c.*, (c.completed_at at time zone $4)::date as local_date
        from completions c
        where c.home_id = $1 and c.kind = 'done'
          and (c.completed_at at time zone $4)::date between $2::date and $3::date
      )`;
    const params = [homeId, from, to, tz];

    const perMember = await db.query<{ userId: string; name: string; done: number; onTime: number }>(
      `${base}
       select d.user_id as "userId",
              case when m.user_id is null or u.deleted_at is not null then 'Former member'
                   else coalesce(u.display_name, 'Someone') end as name,
              count(*)::int as done,
              count(*) filter (where d.local_date <= d.due_date)::int as "onTime"
       from done d join users u on u.id = d.user_id
       left join home_members m on m.home_id = d.home_id and m.user_id = d.user_id
       group by d.user_id, m.user_id, u.deleted_at, u.display_name
       order by done desc, name`,
      params,
    );
    const perRoom = await db.query<{ roomId: string; name: string; done: number }>(
      `${base}
       select r.id as "roomId", r.name, count(*)::int as done
       from done d cross join lateral unnest(d.room_ids) as room_id join rooms r on r.id = room_id
       group by r.id, r.name order by done desc, r.name`,
      params,
    );
    const doneForOthers = await db.query<{ byUserId: string; forUserId: string; count: number }>(
      `${base}
       select user_id as "byUserId", assignee_id_at_time as "forUserId", count(*)::int as count
       from done where assignee_id_at_time is not null and assignee_id_at_time <> user_id
       group by user_id, assignee_id_at_time order by count desc`,
      params,
    );
    const perDay = await db.query<{ date: string; done: number }>(
      `${base}
       select to_char(day, 'YYYY-MM-DD') as date, (select count(*)::int from done where local_date = day) as done
       from generate_series($2::date, $3::date, interval '1 day') as day order by day`,
      params,
    );
    const total = perMember.reduce((sum, m) => sum + m.done, 0);
    return c.json({ from, to, total, perMember, perRoom, doneForOthers, perDay });
  });

  return r;
}
