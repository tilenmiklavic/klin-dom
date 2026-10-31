import { addInterval, CompleteInput, localDate, nextDueAfterCompletion } from '@klindom/shared';
import { Hono } from 'hono';
import { homeIdOf, requireMember } from '../access.js';
import type { AppDeps, AppEnv } from '../app.js';
import { requireUser } from '../auth/middleware.js';
import type { Db } from '../db.js';
import { HttpError, parseBody } from '../errors.js';
import { homeTimezone } from '../repo/homes.js';
import { getCompletion, taskHistory } from '../repo/completions.js';
import { queryTasks } from '../repo/tasks.js';

interface LockedTask {
  id: string;
  home_id: string;
  next_due_date: string;
  last_completed_at: Date | null;
  interval_count: number;
  interval_unit: 'day' | 'week' | 'month';
  assignee_id: string | null;
  archived_at: Date | null;
}

async function lockTask(q: Db, taskId: string): Promise<LockedTask> {
  const [task] = await q.query<LockedTask>(
    `select id, home_id, next_due_date, last_completed_at, interval_count, interval_unit, assignee_id, archived_at
     from tasks where id = $1 for update`,
    [taskId],
  );
  if (!task || task.archived_at) throw new HttpError(404, 'not_found', 'Task not found');
  return task;
}

async function insertCompletion(q: Db, task: LockedTask, userId: string, kind: 'done' | 'skip', now: Date): Promise<string> {
  const [row] = await q.query<{ id: string }>(
    `insert into completions (task_id, home_id, user_id, kind, completed_at, due_date, prev_next_due_date,
       prev_last_completed_at, assignee_id_at_time, room_ids, interval_count, interval_unit)
     values ($1, $2, $3, $4, $5, $6, $6, $7, $8,
       coalesce((select array_agg(room_id) from task_rooms where task_id = $1), '{}'), $9, $10)
     returning id`,
    [task.id, task.home_id, userId, kind, now, task.next_due_date, task.last_completed_at, task.assignee_id,
     task.interval_count, task.interval_unit],
  );
  return row!.id;
}

export function completionRoutes(deps: AppDeps) {
  const { db, clock } = deps;
  const auth = requireUser(deps);
  const r = new Hono<AppEnv>();

  async function respond(homeId: string, taskId: string, userId: string, completionId: string | null) {
    const tz = await homeTimezone(db, homeId);
    const [task] = await queryTasks(db, { homeId, userId, taskId }, localDate(clock.now(), tz));
    return { task, completion: completionId ? await getCompletion(db, completionId, tz) : null };
  }

  r.post('/tasks/:id/complete', auth, async (c) => {
    const userId = c.get('user').id;
    const homeId = await homeIdOf(db, 'tasks', c.req.param('id'));
    await requireMember(db, homeId, userId);
    const { dueDate } = await parseBody(c, CompleteInput);
    const tz = await homeTimezone(db, homeId);
    const now = clock.now();

    const result = await db.tx(async (q) => {
      const task = await lockTask(q, c.req.param('id'));
      const [existing] = await q.query<{ id: string }>(
        `select id from completions where task_id = $1 and due_date = $2 and kind = 'done'`,
        [task.id, dueDate ?? task.next_due_date],
      );
      if (existing) return { id: existing.id, created: false };
      const id = await insertCompletion(q, task, userId, 'done', now);
      await q.query('update tasks set last_completed_at = $2, next_due_date = $3 where id = $1', [
        task.id, now, nextDueAfterCompletion(now, tz, task.interval_count, task.interval_unit),
      ]);
      return { id, created: true };
    });
    return c.json(await respond(homeId, c.req.param('id'), userId, result.id), result.created ? 201 : 200);
  });

  r.post('/tasks/:id/skip', auth, async (c) => {
    const userId = c.get('user').id;
    const homeId = await homeIdOf(db, 'tasks', c.req.param('id'));
    await requireMember(db, homeId, userId);
    const tz = await homeTimezone(db, homeId);
    const now = clock.now();
    const id = await db.tx(async (q) => {
      const task = await lockTask(q, c.req.param('id'));
      const completionId = await insertCompletion(q, task, userId, 'skip', now);
      await q.query('update tasks set next_due_date = $2 where id = $1', [
        task.id, addInterval(localDate(now, tz), task.interval_count, task.interval_unit),
      ]);
      return completionId;
    });
    return c.json(await respond(homeId, c.req.param('id'), userId, id), 201);
  });

  r.delete('/completions/:id', auth, async (c) => {
    const userId = c.get('user').id;
    const completionId = c.req.param('id');
    const homeId = await homeIdOf(db, 'completions', completionId);
    const { role } = await requireMember(db, homeId, userId);
    const taskId = await db.tx(async (q) => {
      const [completion] = await q.query<{ task_id: string; user_id: string; prev_next_due_date: string; prev_last_completed_at: Date | null }>(
        'select task_id, user_id, prev_next_due_date, prev_last_completed_at from completions where id = $1',
        [completionId],
      );
      if (completion!.user_id !== userId && role !== 'owner') {
        throw new HttpError(403, 'forbidden', 'Only the person who did it or the owner can undo this');
      }
      await lockTask(q, completion!.task_id);
      const [latest] = await q.query<{ id: string }>(
        'select id from completions where task_id = $1 order by completed_at desc, id desc limit 1',
        [completion!.task_id],
      );
      if (latest!.id !== completionId) throw new HttpError(409, 'not_latest', 'Only the most recent entry can be undone');
      await q.query('update tasks set next_due_date = $2, last_completed_at = $3 where id = $1', [
        completion!.task_id, completion!.prev_next_due_date, completion!.prev_last_completed_at,
      ]);
      await q.query('delete from completions where id = $1', [completionId]);
      return completion!.task_id;
    });
    const { task } = await respond(homeId, taskId, userId, null);
    return c.json({ task });
  });

  r.get('/tasks/:id/history', auth, async (c) => {
    const taskId = c.req.param('id');
    const homeId = await homeIdOf(db, 'tasks', taskId);
    await requireMember(db, homeId, c.get('user').id);
    const limit = Math.min(Number(c.req.query('limit') ?? 50) || 50, 200);
    return c.json(await taskHistory(db, taskId, await homeTimezone(db, homeId), limit));
  });

  return r;
}
