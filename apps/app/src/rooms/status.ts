import type { IsoDate, TaskDto } from '@klindom/shared';

export type RoomStatus =
  | { kind: 'overdue'; count: number; tone: 'due' }
  | { kind: 'dueToday'; count: number; tone: 'muted' }
  | { kind: 'next'; day: string; tone: 'muted' }
  | { kind: 'fresh'; tone: 'muted' };

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const NEXT_WINDOW_DAYS = 7;

/** Whole days since the epoch for a calendar date, from its parts (no device timezone). */
const dayNumber = (date: IsoDate) => {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
};

/** Share of the room's tasks that are not overdue; 1 when it has none. */
export function roomFreshness(tasks: TaskDto[], today: IsoDate): number {
  if (tasks.length === 0) return 1;
  return tasks.filter((t) => t.nextDueDate >= today).length / tasks.length;
}

/** Overdue count, else due-today count, else the next due weekday within 7 days, else "all fresh". */
export function roomStatus(tasks: TaskDto[], today: IsoDate): RoomStatus {
  const overdue = tasks.filter((t) => t.nextDueDate < today).length;
  if (overdue > 0) return { kind: 'overdue', count: overdue, tone: 'due' };
  const dueToday = tasks.filter((t) => t.nextDueDate === today).length;
  if (dueToday > 0) return { kind: 'dueToday', count: dueToday, tone: 'muted' };
  const next = tasks.map((t) => t.nextDueDate).sort()[0];
  if (next && dayNumber(next) - dayNumber(today) <= NEXT_WINDOW_DAYS) {
    return { kind: 'next', day: WEEKDAYS[(dayNumber(next) + 4) % 7]!, tone: 'muted' };
  }
  return { kind: 'fresh', tone: 'muted' };
}
