import { DateTime } from 'luxon';
import type { IntervalUnit, IsoDate } from './dates.js';

// Calendar math in the UTC zone on the date string only: device timezone never matters.
function parse(date: IsoDate): DateTime {
  const dt = DateTime.fromISO(date, { zone: 'utc' });
  if (!dt.isValid) throw new Error(`Invalid date: ${date}`);
  return dt;
}

export function formatDue(nextDue: IsoDate, today: IsoDate): { text: string; tone: 'muted' | 'due' } {
  const due = parse(nextDue);
  const days = Math.round(due.diff(parse(today), 'days').days);
  if (days === 0) return { text: 'Due today', tone: 'due' };
  if (days === 1) return { text: 'Due tomorrow', tone: 'muted' };
  if (days === -1) return { text: 'Due yesterday', tone: 'due' };
  if (days < 0) return { text: `Due ${-days} days ago`, tone: 'due' };
  if (days <= 6) return { text: `Due ${due.setLocale('en').toFormat('cccc')}`, tone: 'muted' };
  return { text: `Due ${due.setLocale('en').toFormat('d LLL')}`, tone: 'muted' };
}

export function formatInterval(count: number, unit: IntervalUnit): string {
  if (count === 1) return { day: 'Daily', week: 'Weekly', month: 'Monthly' }[unit];
  return `Every ${count} ${unit}s`;
}

export const reminderPresets = [
  { key: 'at', minutes: 0 },
  { key: '1h', minutes: 60 },
  { key: '3h', minutes: 180 },
  { key: 'evening', minutes: null },
  { key: '1d', minutes: 1440 },
] as const;

/** Minutes from 18:00 the previous day to the due moment. */
export function eveningBeforeOffset(dueTime: string | null, fallback: string): number {
  const [hour = 0, minute = 0] = (dueTime ?? fallback).split(':').map(Number);
  return 24 * 60 - 18 * 60 + hour * 60 + minute;
}
