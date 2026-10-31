import type { TaskDto } from '@klindom/shared';
import { groupByDue, groupByRoom } from '../src/tasks/grouping';

const mk = (id: string, nextDueDate: string, rooms: { id: string; name: string }[] = [{ id: 'r1', name: 'Kitchen' }]): TaskDto => ({
  id,
  name: id,
  icon: 'sparkle',
  notes: null,
  rooms: rooms.map((r) => ({ ...r, icon: 'home' as const })),
  intervalCount: 1,
  intervalUnit: 'week',
  dueTime: null,
  assigneeId: null,
  nextDueDate,
  lastCompletedAt: null,
  reminderOffsets: [],
  mutedByMe: false,
  overdue: false,
});

describe('groupByDue', () => {
  it('buckets by calendar date against today 2026-10-31 (week ends Sun 2026-11-01)', () => {
    const groups = groupByDue(
      [mk('later', '2026-11-09'), mk('week', '2026-11-01'), mk('today', '2026-10-31'), mk('overdue', '2026-10-26')],
      '2026-10-31',
    );
    expect(groups.map((g) => [g.key, g.tasks.map((t) => t.id)])).toEqual([
      ['overdue', ['overdue']],
      ['today', ['today']],
      ['week', ['week']],
      ['later', ['later']],
    ]);
  });

  it('leaves empty groups out and orders by due date', () => {
    const groups = groupByDue([mk('b', '2026-12-02'), mk('a', '2026-11-20')], '2026-10-31');
    expect(groups).toHaveLength(1);
    expect(groups[0]!.tasks.map((t) => t.id)).toEqual(['a', 'b']);
  });
});

describe('groupByRoom', () => {
  const rooms = [
    { id: 'r1', name: 'Kitchen' },
    { id: 'r2', name: 'Bedroom' },
    { id: 'r3', name: 'Garage' },
  ];
  it('lists a multi-room task under each room, in room order, skipping empty rooms', () => {
    const both = mk('both', '2026-11-02', [rooms[1]!, rooms[0]!]);
    const groups = groupByRoom([both, mk('k', '2026-11-01')], rooms);
    expect(groups.map((g) => [g.title, g.tasks.map((t) => t.id)])).toEqual([
      ['Kitchen', ['k', 'both']],
      ['Bedroom', ['both']],
    ]);
  });
});
