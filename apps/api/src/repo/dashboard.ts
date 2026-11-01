import { computeRings, localDate, type IsoDate, type RingCompletion, type RingTask, type Rings } from '@klindom/shared';
import type { Db } from '../db.js';
import { homeTimezone } from './homes.js';

export type Scope = 'all' | 'mine';

const scopeFilter = (alias: string) => `(${alias}.assignee_id is null or ${alias}.assignee_id = $2)`;

export async function loadRings(db: Db, homeId: string, userId: string | null, scope: Scope, now: Date): Promise<{ rings: Rings; today: IsoDate; tz: string }> {
  const tz = await homeTimezone(db, homeId);
  const today = localDate(now, tz);
  // Scope 'all' ignores $2 (null for system callers such as the snapshot job), but the parameter must stay typed.
  const mine = scope === 'mine' ? `and ${scopeFilter('t')}` : 'and $2::uuid is not distinct from $2::uuid';
  const tasks = await db.query<{ id: string; next_due_date: string; interval_count: number; interval_unit: RingTask['intervalUnit'] }>(
    `select t.id, t.next_due_date, t.interval_count, t.interval_unit from tasks t
     where t.home_id = $1 and t.archived_at is null ${mine}`,
    [homeId, userId],
  );
  // Eight days back always covers the current Monday-first week in any timezone.
  const completions = await db.query<{ task_id: string; kind: 'done' | 'skip'; completed_at: Date; due_date: string }>(
    `select c.task_id, c.kind, c.completed_at, c.due_date from completions c join tasks t on t.id = c.task_id
     where c.home_id = $1 and c.completed_at >= $3::timestamptz - interval '8 days' and c.completed_at <= $3::timestamptz and t.archived_at is null ${mine}`,
    [homeId, userId, now],
  );
  const rings = computeRings({
    today,
    tasks: tasks.map((t) => ({ id: t.id, nextDueDate: t.next_due_date, intervalCount: t.interval_count, intervalUnit: t.interval_unit })),
    completionsThisWeek: completions.map<RingCompletion>((c) => ({
      taskId: c.task_id,
      kind: c.kind,
      dueDate: c.due_date,
      completedLocalDate: localDate(c.completed_at, tz),
    })),
  });
  return { rings, today, tz };
}
