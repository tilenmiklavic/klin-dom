import { DateTime } from 'luxon';

/** A calendar date as `YYYY-MM-DD`, always meant in a home's timezone. */
export type IsoDate = string;
export type IntervalUnit = 'day' | 'week' | 'month';

function parseDate(date: IsoDate): DateTime {
  const dt = DateTime.fromISO(date, { zone: 'utc' });
  if (!dt.isValid) throw new Error(`Invalid date: ${date}`);
  return dt;
}

export function localDate(instant: Date, tz: string): IsoDate {
  return DateTime.fromJSDate(instant, { zone: tz }).toISODate()!;
}

/** Calendar arithmetic; months clamp to the month end (31 Jan + 1 month = 28/29 Feb). */
export function addInterval(date: IsoDate, count: number, unit: IntervalUnit): IsoDate {
  const key = unit === 'day' ? 'days' : unit === 'week' ? 'weeks' : 'months';
  return parseDate(date).plus({ [key]: count }).toISODate()!;
}

export function nextDueAfterCompletion(completedAt: Date, tz: string, count: number, unit: IntervalUnit): IsoDate {
  return addInterval(localDate(completedAt, tz), count, unit);
}

/** Monday-first week containing `today`. */
export function weekBounds(today: IsoDate): { start: IsoDate; end: IsoDate } {
  const start = parseDate(today).startOf('week');
  return { start: start.toISODate()!, end: start.plus({ days: 6 }).toISODate()! };
}

export function dueMoment(dueDate: IsoDate, dueTime: string | null, fallbackTime: string, tz: string): Date {
  const [hour, minute] = (dueTime ?? fallbackTime).split(':').map(Number);
  return DateTime.fromISO(dueDate, { zone: tz }).set({ hour, minute, second: 0, millisecond: 0 }).toJSDate();
}

export function isOverdue(nextDue: IsoDate, today: IsoDate): boolean {
  return nextDue < today;
}
