import type { TaskDto } from '@klindom/shared';
import { roomFreshness, roomStatus } from '../src/rooms/status';

const task = (nextDueDate: string) => ({ nextDueDate }) as TaskDto;
const TODAY = '2026-10-31'; // a Saturday

describe('roomFreshness', () => {
  it('is 1 for a room without tasks', () => {
    expect(roomFreshness([], TODAY)).toBe(1);
  });
  it('is the share of tasks that are not overdue', () => {
    expect(roomFreshness([task('2026-10-30'), task('2026-10-31')], TODAY)).toBe(0.5);
    expect(roomFreshness([task('2026-10-31'), task('2026-11-05')], TODAY)).toBe(1);
  });
});

describe('roomStatus', () => {
  it('counts overdue first, in the due tone', () => {
    expect(roomStatus([task('2026-10-29'), task('2026-10-31')], TODAY)).toEqual({ kind: 'overdue', count: 1, tone: 'due' });
  });
  it('then tasks due today', () => {
    expect(roomStatus([task('2026-10-31'), task('2026-10-31'), task('2026-11-02')], TODAY)).toEqual({ kind: 'dueToday', count: 2, tone: 'muted' });
  });
  it('then the weekday of the next due task, within 7 days', () => {
    expect(roomStatus([task('2026-11-08'), task('2026-11-01')], TODAY)).toEqual({ kind: 'next', day: 'Sun', tone: 'muted' });
    expect(roomStatus([task('2026-11-07')], TODAY)).toEqual({ kind: 'next', day: 'Sat', tone: 'muted' });
  });
  it('is all fresh when nothing is due within 7 days or there are no tasks', () => {
    expect(roomStatus([task('2026-11-08')], TODAY)).toEqual({ kind: 'fresh', tone: 'muted' });
    expect(roomStatus([], TODAY)).toEqual({ kind: 'fresh', tone: 'muted' });
  });
});
