// Must be set before anything computes dates; proves device timezone has no effect.
process.env.TZ = 'America/Los_Angeles';

import { eveningBeforeOffset, formatDue, formatInterval, reminderPresets } from '../src/format.js';

describe('formatDue', () => {
  it('runs in a non-UTC device timezone', () => {
    expect(new Date('2026-10-31T12:00:00Z').getTimezoneOffset()).not.toBe(0);
  });
  it('formats today / tomorrow', () => {
    expect(formatDue('2026-10-31', '2026-10-31')).toEqual({ text: 'Due today', tone: 'due' });
    expect(formatDue('2026-11-01', '2026-10-31')).toEqual({ text: 'Due tomorrow', tone: 'muted' });
  });
  it('uses the weekday within 6 days', () => {
    expect(formatDue('2026-11-05', '2026-10-31')).toEqual({ text: 'Due Thursday', tone: 'muted' });
    expect(formatDue('2026-11-06', '2026-10-31').text).toBe('Due Friday');
    expect(formatDue('2026-11-07', '2026-10-31').text).toBe('Due 7 Nov');
  });
  it('uses day + month further out', () => {
    expect(formatDue('2026-11-12', '2026-10-31')).toEqual({ text: 'Due 12 Nov', tone: 'muted' });
  });
  it('handles the past', () => {
    expect(formatDue('2026-10-30', '2026-10-31')).toEqual({ text: 'Due yesterday', tone: 'due' });
    expect(formatDue('2026-10-26', '2026-10-31')).toEqual({ text: 'Due 5 days ago', tone: 'due' });
  });
});

describe('formatInterval', () => {
  it('formats units', () => {
    expect(formatInterval(1, 'day')).toBe('Daily');
    expect(formatInterval(3, 'day')).toBe('Every 3 days');
    expect(formatInterval(1, 'week')).toBe('Weekly');
    expect(formatInterval(4, 'week')).toBe('Every 4 weeks');
    expect(formatInterval(1, 'month')).toBe('Monthly');
    expect(formatInterval(2, 'month')).toBe('Every 2 months');
  });
});

describe('reminders', () => {
  it('computes evening-before offsets', () => {
    expect(eveningBeforeOffset(null, '08:00')).toBe(840);
    expect(eveningBeforeOffset('19:00', '08:00')).toBe(1500);
  });
  it('lists presets', () => {
    expect(reminderPresets.map((p) => p.key)).toEqual(['at', '1h', '3h', 'evening', '1d']);
    expect(reminderPresets[3]?.minutes).toBeNull();
  });
});
