import { addInterval, addMonths, monthGrid, dueMoment, isOverdue, localDate, nextDueAfterCompletion, weekBounds } from '../src/dates.js';

describe('localDate', () => {
  it('uses the home timezone, not UTC, just after midnight (CEST)', () => {
    expect(localDate(new Date('2026-10-24T22:30:00Z'), 'Europe/Ljubljana')).toBe('2026-10-25');
  });
  it('uses the home timezone late in the evening after the DST change (CET)', () => {
    expect(localDate(new Date('2026-10-25T22:30:00Z'), 'Europe/Ljubljana')).toBe('2026-10-25');
  });
});

describe('addInterval', () => {
  it('clamps month arithmetic to the month end', () => {
    expect(addInterval('2026-01-31', 1, 'month')).toBe('2026-02-28');
  });
  it('clamps to 29 February in leap years', () => {
    expect(addInterval('2028-01-31', 1, 'month')).toBe('2028-02-29');
  });
  it('adds weeks', () => {
    expect(addInterval('2026-10-31', 4, 'week')).toBe('2026-11-28');
  });
  it('adds days across the DST change', () => {
    expect(addInterval('2026-10-24', 2, 'day')).toBe('2026-10-26');
  });
});

it('nextDueAfterCompletion counts from the local completion date', () => {
  expect(nextDueAfterCompletion(new Date('2026-10-31T09:00:00Z'), 'Europe/Ljubljana', 4, 'week')).toBe('2026-11-28');
});

describe('weekBounds', () => {
  it('returns Monday to Sunday for a Saturday', () => {
    expect(weekBounds('2026-10-31')).toEqual({ start: '2026-10-26', end: '2026-11-01' });
  });
  it('returns the same week for its Monday', () => {
    expect(weekBounds('2026-10-26')).toEqual({ start: '2026-10-26', end: '2026-11-01' });
  });
});

describe('dueMoment', () => {
  it('falls back to the member reminder time for untimed tasks (CET)', () => {
    expect(dueMoment('2026-11-02', null, '08:00', 'Europe/Ljubljana').toISOString()).toBe('2026-11-02T07:00:00.000Z');
  });
  it('uses the task due time (CEST)', () => {
    expect(dueMoment('2026-07-02', '19:00', '08:00', 'Europe/Ljubljana').toISOString()).toBe('2026-07-02T17:00:00.000Z');
  });
});

describe('isOverdue', () => {
  it('is overdue the day after the due date', () => {
    expect(isOverdue('2026-10-30', '2026-10-31')).toBe(true);
  });
  it('is not overdue on the due date', () => {
    expect(isOverdue('2026-10-31', '2026-10-31')).toBe(false);
  });
});

describe('monthGrid', () => {
  it('lists every date of the month with Monday-first leading blanks', () => {
    const g = monthGrid('2026-10'); // 1 Oct 2026 is a Thursday
    expect(g.leadingBlanks).toBe(3);
    expect(g.dates).toHaveLength(31);
    expect(g.dates[0]).toBe('2026-10-01');
    expect(g.dates[30]).toBe('2026-10-31');
  });
  it('has no blanks when the month starts on a Monday and handles leap February', () => {
    expect(monthGrid('2026-06').leadingBlanks).toBe(0);
    expect(monthGrid('2028-02').dates).toHaveLength(29);
  });
});

describe('addMonths', () => {
  it('steps across year boundaries', () => {
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
  });
});
