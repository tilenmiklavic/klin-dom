import { localDate } from '@klindom/shared';
import { Hono } from 'hono';
import { requireMember } from '../access.js';
import type { AppDeps, AppEnv } from '../app.js';
import { requireUser } from '../auth/middleware.js';
import { SELECT_COMPLETIONS, toCompletionDto } from '../repo/completions.js';
import { loadRings } from '../repo/dashboard.js';
import { loadStreak } from '../repo/streak.js';
import { queryTasks } from '../repo/tasks.js';

export function dashboardRoutes(deps: AppDeps) {
  const { db, clock } = deps;
  const auth = requireUser(deps);
  const r = new Hono<AppEnv>();

  r.get('/homes/:id/dashboard', auth, async (c) => {
    const homeId = c.req.param('id');
    const userId = c.get('user').id;
    await requireMember(db, homeId, userId);
    const scope = c.req.query('scope') === 'mine' ? 'mine' : 'all';
    const now = clock.now();
    const { rings, today, tz } = await loadRings(db, homeId, userId, scope, now);

    const dueToday = (await queryTasks(db, { homeId, userId, scope }, today)).filter((t) => t.nextDueDate <= today);

    const recent = await db.query<Parameters<typeof toCompletionDto>[0] & { task_name: string; task_icon: string; room_names: string[]; assignee_id: string | null }>(
      `select x.*, t.name as task_name, t.icon as task_icon, t.assignee_id,
              coalesce((select array_agg(r.name order by r.sort_order, r.name) from rooms r where r.id = any(cc.room_ids)), '{}') as room_names
       from (${SELECT_COMPLETIONS} where c.home_id = $1 and c.kind = 'done' and c.completed_at >= $2::timestamptz - interval '1 day') x
       join completions cc on cc.id = x.id
       join tasks t on t.id = x.task_id
       where t.archived_at is null
       order by x.completed_at`,
      [homeId, now],
    );
    const doneToday = recent
      .filter((row) => localDate(row.completed_at, tz) === today && row.due_date <= today)
      .filter((row) => scope === 'all' || row.assignee_id === null || row.assignee_id === userId)
      .map((row) => ({ ...toCompletionDto(row, tz), taskName: row.task_name, taskIcon: row.task_icon, roomNames: row.room_names }));

    const streak = await loadStreak(db, homeId, today, rings.today);

    return c.json({ rings, streak, dueToday, doneToday });
  });

  return r;
}
