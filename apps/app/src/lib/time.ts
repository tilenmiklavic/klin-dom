import type { IsoDate } from '@klindom/shared';

/** "Saturday, 31 October" for a calendar date. Formats in UTC from the date parts, so the device zone never shifts it. */
export function formatLongDate(date: IsoDate): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
    .format(new Date(Date.UTC(y, m - 1, d)))
    .replace(/^(\w+) /, '$1, ');
}

/** "9:40" for an instant, in the given IANA zone. */
export function formatClock(instant: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', { hour: 'numeric', minute: '2-digit', hourCycle: 'h23', timeZone }).formatToParts(
    new Date(instant),
  );
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${Number(get('hour'))}:${get('minute')}`;
}
