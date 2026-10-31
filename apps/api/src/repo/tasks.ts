import { isOverdue, type IconName, type IsoDate, type TaskDto } from '@klindom/shared';
import type { Db } from '../db.js';

interface TaskRow {
  id: string;
  home_id: string;
  name: string;
  icon: IconName;
  notes: string | null;
  interval_count: number;
  interval_unit: 'day' | 'week' | 'month';
  due_time: string | null;
  assignee_id: string | null;
  next_due_date: string;
  last_completed_at: Date | null;
  rooms: { id: string; name: string; icon: IconName }[];
  reminder_offsets: number[];
  muted_by_me: boolean;
}

const SELECT_TASKS = `
  select t.id, t.home_id, t.name, t.icon, t.notes, t.interval_count, t.interval_unit,
         to_char(t.due_time, 'HH24:MI') as due_time, t.assignee_id, t.next_due_date, t.last_completed_at,
         coalesce((select json_agg(json_build_object('id', r.id, 'name', r.name, 'icon', r.icon) order by r.sort_order, r.name)
                   from task_rooms tr join rooms r on r.id = tr.room_id
                   where tr.task_id = t.id and r.archived_at is null), '[]') as rooms,
         coalesce((select array_agg(offset_minutes order by offset_minutes) from task_reminders where task_id = t.id), '{}') as reminder_offsets,
         exists (select 1 from task_reminder_mutes m where m.task_id = t.id and m.user_id = $1) as muted_by_me
  from tasks t`;

export function toTaskDto(row: TaskRow, today: IsoDate): TaskDto {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    notes: row.notes,
    rooms: row.rooms,
    intervalCount: row.interval_count,
    intervalUnit: row.interval_unit,
    dueTime: row.due_time,
    assigneeId: row.assignee_id,
    nextDueDate: row.next_due_date,
    lastCompletedAt: row.last_completed_at?.toISOString() ?? null,
    reminderOffsets: row.reminder_offsets,
    mutedByMe: row.muted_by_me,
    overdue: isOverdue(row.next_due_date, today),
  };
}

export interface TaskQuery {
  homeId: string;
  userId: string;
  scope?: 'all' | 'mine';
  roomId?: string;
  taskId?: string;
}

export async function queryTasks(db: Db, q: TaskQuery, today: IsoDate): Promise<TaskDto[]> {
  const where = ['t.home_id = $2', 't.archived_at is null'];
  const params: unknown[] = [q.userId, q.homeId];
  if (q.scope === 'mine') where.push('(t.assignee_id is null or t.assignee_id = $1)');
  if (q.roomId) {
    params.push(q.roomId);
    where.push(`exists (select 1 from task_rooms tr where tr.task_id = t.id and tr.room_id = $${params.length})`);
  }
  if (q.taskId) {
    params.push(q.taskId);
    where.push(`t.id = $${params.length}`);
  }
  const rows = await db.query<TaskRow>(`${SELECT_TASKS} where ${where.join(' and ')} order by t.next_due_date, t.name`, params);
  return rows.map((row) => toTaskDto(row, today));
}

export async function setTaskRooms(db: Db, taskId: string, roomIds: string[]): Promise<void> {
  await db.query('delete from task_rooms where task_id = $1', [taskId]);
  await db.query('insert into task_rooms (task_id, room_id) select $1, unnest($2::uuid[])', [taskId, roomIds]);
}

export async function setTaskReminders(db: Db, taskId: string, offsets: number[]): Promise<void> {
  await db.query('delete from task_reminders where task_id = $1', [taskId]);
  await db.query('insert into task_reminders (task_id, offset_minutes) select $1, unnest($2::int[])', [taskId, offsets]);
}
