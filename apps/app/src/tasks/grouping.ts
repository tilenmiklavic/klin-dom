import { weekBounds, type IsoDate, type TaskDto } from '@klindom/shared';

export type DueGroupKey = 'overdue' | 'today' | 'week' | 'later';
export interface Group {
  key: string;
  title: string;
  tasks: TaskDto[];
}

const byDue = (a: TaskDto, b: TaskDto) => a.nextDueDate.localeCompare(b.nextDueDate) || a.name.localeCompare(b.name);

/** Overdue / Today / This week / Later, in that order, empty groups left out. Compares calendar-date strings only. */
export function groupByDue(tasks: TaskDto[], today: IsoDate): { key: DueGroupKey; tasks: TaskDto[] }[] {
  const { end } = weekBounds(today);
  const buckets: Record<DueGroupKey, TaskDto[]> = { overdue: [], today: [], week: [], later: [] };
  for (const task of [...tasks].sort(byDue)) {
    const d = task.nextDueDate;
    buckets[d < today ? 'overdue' : d === today ? 'today' : d <= end ? 'week' : 'later'].push(task);
  }
  return (['overdue', 'today', 'week', 'later'] as const).filter((k) => buckets[k].length > 0).map((key) => ({ key, tasks: buckets[key] }));
}

/** One section per room, in room order; a task in several rooms appears under each. Rooms without tasks are left out. */
export function groupByRoom(tasks: TaskDto[], rooms: { id: string; name: string }[]): { key: string; title: string; tasks: TaskDto[] }[] {
  const known = new Set(rooms.map((r) => r.id));
  const all = [...rooms, ...tasks.flatMap((t) => t.rooms).filter((r) => !known.has(r.id) && known.add(r.id))];
  return all
    .map((room) => ({ key: room.id, title: room.name, tasks: tasks.filter((t) => t.rooms.some((r) => r.id === room.id)).sort(byDue) }))
    .filter((g) => g.tasks.length > 0);
}
