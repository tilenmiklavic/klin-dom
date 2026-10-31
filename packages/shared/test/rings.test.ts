import { computeRings, type RingCompletion, type RingTask } from '../src/rings.js';

const today = '2026-10-31'; // Saturday; week 2026-10-26..2026-11-01

const task = (id: string, nextDueDate: string, intervalCount = 1, intervalUnit: RingTask['intervalUnit'] = 'day'): RingTask => ({
  id, nextDueDate, intervalCount, intervalUnit,
});
const done = (taskId: string, dueDate: string, completedLocalDate = today): RingCompletion => ({
  taskId, kind: 'done', dueDate, completedLocalDate,
});

it('has empty rings and a fresh home with no tasks', () => {
  expect(computeRings({ today, tasks: [], completionsThisWeek: [] })).toEqual({
    today: { done: 0, total: 0 },
    week: { done: 0, total: 0 },
    fresh: { notOverdue: 0, total: 0, pct: 100 },
  });
});

it('counts a daily task due today once today and twice for the rest of the week', () => {
  const rings = computeRings({ today, tasks: [task('a', today)], completionsThisWeek: [] });
  expect(rings.today).toEqual({ done: 0, total: 1 });
  expect(rings.week).toEqual({ done: 0, total: 2 });
});

it('fills today when the daily task is done', () => {
  const rings = computeRings({ today, tasks: [task('a', '2026-11-01')], completionsThisWeek: [done('a', today)] });
  expect(rings.today).toEqual({ done: 1, total: 1 });
  expect(rings.week).toEqual({ done: 1, total: 2 });
});

it('carries an overdue weekly task into today and the week once', () => {
  const rings = computeRings({ today, tasks: [task('a', '2026-10-20', 1, 'week')], completionsThisWeek: [] });
  expect(rings.today).toEqual({ done: 0, total: 1 });
  expect(rings.week).toEqual({ done: 0, total: 1 });
  expect(rings.fresh).toEqual({ notOverdue: 0, total: 1, pct: 0 });
});

it('removes a skipped task from today without counting it', () => {
  const skip: RingCompletion = { taskId: 'a', kind: 'skip', dueDate: today, completedLocalDate: today };
  const rings = computeRings({ today, tasks: [task('a', '2026-11-07', 1, 'week')], completionsThisWeek: [skip] });
  expect(rings.today).toEqual({ done: 0, total: 0 });
  expect(rings.week).toEqual({ done: 0, total: 0 });
});

it('ignores tasks due after this week except for freshness', () => {
  const rings = computeRings({ today, tasks: [task('a', '2026-11-05', 1, 'week')], completionsThisWeek: [] });
  expect(rings.today).toEqual({ done: 0, total: 0 });
  expect(rings.week).toEqual({ done: 0, total: 0 });
  expect(rings.fresh).toEqual({ notOverdue: 1, total: 1, pct: 100 });
});

it('counts done earlier this week toward the week but not today', () => {
  const rings = computeRings({
    today,
    tasks: [task('a', '2026-11-04', 1, 'week')],
    completionsThisWeek: [done('a', '2026-10-28', '2026-10-28')],
  });
  expect(rings.today).toEqual({ done: 0, total: 0 });
  expect(rings.week).toEqual({ done: 1, total: 1 });
});
