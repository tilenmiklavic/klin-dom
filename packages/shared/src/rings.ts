import { addInterval, weekBounds, type IntervalUnit, type IsoDate } from './dates.js';

export type RingTask = { id: string; nextDueDate: IsoDate; intervalCount: number; intervalUnit: IntervalUnit };
export type RingCompletion = { taskId: string; kind: 'done' | 'skip'; completedLocalDate: IsoDate; dueDate: IsoDate };
export type Rings = {
  today: { done: number; total: number };
  week: { done: number; total: number };
  fresh: { notOverdue: number; total: number; pct: number };
};

/** Occurrences still to come this week, as if each were done on time. An overdue task counts once, then recurs from today. */
function remainingOccurrences(task: RingTask, today: IsoDate, end: IsoDate): number {
  let d = task.nextDueDate;
  if (d > end) return 0;
  let count = 1;
  d = addInterval(d > today ? d : today, task.intervalCount, task.intervalUnit);
  while (d <= end) {
    count += 1;
    d = addInterval(d, task.intervalCount, task.intervalUnit);
  }
  return count;
}

export function computeRings(input: { today: IsoDate; tasks: RingTask[]; completionsThisWeek: RingCompletion[] }): Rings {
  const { today, tasks, completionsThisWeek } = input;
  const { start, end } = weekBounds(today);
  const doneThisWeek = completionsThisWeek.filter(
    (c) => c.kind === 'done' && c.completedLocalDate >= start && c.completedLocalDate <= end,
  );

  const todayDone = doneThisWeek.filter((c) => c.completedLocalDate === today && c.dueDate <= today).length;
  const openToday = tasks.filter((t) => t.nextDueDate <= today).length;

  const weekRemaining = tasks.reduce((sum, t) => sum + remainingOccurrences(t, today, end), 0);

  const notOverdue = tasks.filter((t) => t.nextDueDate >= today).length;
  return {
    today: { done: todayDone, total: todayDone + openToday },
    week: { done: doneThisWeek.length, total: doneThisWeek.length + weekRemaining },
    fresh: { notOverdue, total: tasks.length, pct: tasks.length ? Math.round((100 * notOverdue) / tasks.length) : 100 },
  };
}
