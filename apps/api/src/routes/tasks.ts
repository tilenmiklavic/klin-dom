import { addInterval, localDate, MuteInput, TaskInput, UpdateTaskInput } from '@klindom/shared';
import { Hono } from 'hono';
import { homeIdOf, requireMember } from '../access.js';
import type { AppDeps, AppEnv } from '../app.js';
import { requireUser } from '../auth/middleware.js';
import type { Db } from '../db.js';
import { HttpError, parseBody } from '../errors.js';
import { homeTimezone } from '../repo/homes.js';
import { queryTasks, setTaskReminders, setTaskRooms } from '../repo/tasks.js';

async function assertRoomsInHome(db: Db, homeId: string, roomIds: string[]) {
  const [row] = await db.query<{ count: string }>(
    'select count(*) from rooms where home_id = $1 and archived_at is null and id = any($2::uuid[])',
    [homeId, roomIds],
  );
  if (Number(row!.count) !== new Set(roomIds).size) {
    throw new HttpError(400, 'invalid_room', 'Pick rooms from this home');
  }
}

async function assertAssignee(db: Db, homeId: string, assigneeId: string | null | undefined) {
  if (!assigneeId) return;
  const [row] = await db.query('select 1 from home_members where home_id = $1 and user_id = $2', [homeId, assigneeId]);
  if (!row) throw new HttpError(400, 'invalid_assignee', 'Assign the task to someone in this home');
}

export function taskRoutes(deps: AppDeps) {
  const { db, clock } = deps;
  const auth = requireUser(deps);
  const r = new Hono<AppEnv>();

  async function today(homeId: string) {
    return localDate(clock.now(), await homeTimezone(db, homeId));
  }

  async function loadTask(taskId: string, userId: string) {
    const homeId = await homeIdOf(db, 'tasks', taskId);
    await requireMember(db, homeId, userId);
    const [task] = await queryTasks(db, { homeId, userId, taskId }, await today(homeId));
    if (!task) throw new HttpError(404, 'not_found', 'Task not found');
    return { homeId, task };
  }

  r.get('/homes/:id/tasks', auth, async (c) => {
    const homeId = c.req.param('id');
    const userId = c.get('user').id;
    await requireMember(db, homeId, userId);
    const scope = c.req.query('scope') === 'mine' ? 'mine' : 'all';
    return c.json(await queryTasks(db, { homeId, userId, scope, roomId: c.req.query('roomId') }, await today(homeId)));
  });

  r.post('/homes/:id/tasks', auth, async (c) => {
    const homeId = c.req.param('id');
    const userId = c.get('user').id;
    await requireMember(db, homeId, userId);
    const input = await parseBody(c, TaskInput);
    await assertRoomsInHome(db, homeId, input.roomIds);
    await assertAssignee(db, homeId, input.assigneeId);
    const now = await today(homeId);
    const taskId = await db.tx(async (q) => {
      const [row] = await q.query<{ id: string }>(
        `insert into tasks (home_id, name, icon, notes, interval_count, interval_unit, due_time, assignee_id, next_due_date, created_by)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) returning id`,
        [homeId, input.name, input.icon, input.notes ?? null, input.intervalCount, input.intervalUnit,
         input.dueTime ?? null, input.assigneeId ?? null, input.startDate ?? now, userId],
      );
      await setTaskRooms(q, row!.id, input.roomIds);
      await setTaskReminders(q, row!.id, input.reminderOffsets ?? [0]);
      return row!.id;
    });
    const [task] = await queryTasks(db, { homeId, userId, taskId }, now);
    return c.json(task, 201);
  });

  r.get('/tasks/:id', auth, async (c) => {
    return c.json((await loadTask(c.req.param('id'), c.get('user').id)).task);
  });

  r.patch('/tasks/:id', auth, async (c) => {
    const userId = c.get('user').id;
    const { homeId, task } = await loadTask(c.req.param('id'), userId);
    const input = await parseBody(c, UpdateTaskInput);
    if (input.roomIds) await assertRoomsInHome(db, homeId, input.roomIds);
    await assertAssignee(db, homeId, input.assigneeId);

    const tz = await homeTimezone(db, homeId);

    await db.tx(async (q) => {
      // Lock and re-read so a completion that landed meanwhile is never reverted.
      const [fresh] = await q.query<{ interval_count: number; interval_unit: 'day' | 'week' | 'month'; last_completed_at: Date | null }>(
        'select interval_count, interval_unit, last_completed_at from tasks where id = $1 for update',
        [task.id],
      );
      const count = input.intervalCount ?? fresh!.interval_count;
      const unit = input.intervalUnit ?? fresh!.interval_unit;
      const intervalChanged = count !== fresh!.interval_count || unit !== fresh!.interval_unit;
      await q.query(
        `update tasks set name = $2, icon = $3, notes = $4, interval_count = $5, interval_unit = $6,
           due_time = $7, assignee_id = $8 where id = $1`,
        [task.id, input.name ?? task.name, input.icon ?? task.icon,
         input.notes !== undefined ? input.notes : task.notes, count, unit,
         input.dueTime !== undefined ? input.dueTime : task.dueTime,
         input.assigneeId !== undefined ? input.assigneeId : task.assigneeId],
      );
      if (intervalChanged && fresh!.last_completed_at) {
        await q.query('update tasks set next_due_date = $2 where id = $1', [
          task.id, addInterval(localDate(fresh!.last_completed_at, tz), count, unit),
        ]);
      }
      if (input.roomIds) await setTaskRooms(q, task.id, input.roomIds);
      if (input.reminderOffsets) await setTaskReminders(q, task.id, input.reminderOffsets);
    });
    return c.json((await loadTask(task.id, userId)).task);
  });

  r.delete('/tasks/:id', auth, async (c) => {
    const { task } = await loadTask(c.req.param('id'), c.get('user').id);
    await db.query('update tasks set archived_at = now() where id = $1', [task.id]);
    return c.body(null, 204);
  });

  r.put('/tasks/:id/mute', auth, async (c) => {
    const userId = c.get('user').id;
    const { task } = await loadTask(c.req.param('id'), userId);
    const { muted } = await parseBody(c, MuteInput);
    if (muted) {
      await db.query('insert into task_reminder_mutes (task_id, user_id) values ($1, $2) on conflict do nothing', [task.id, userId]);
    } else {
      await db.query('delete from task_reminder_mutes where task_id = $1 and user_id = $2', [task.id, userId]);
    }
    return c.json((await loadTask(task.id, userId)).task);
  });

  return r;
}
