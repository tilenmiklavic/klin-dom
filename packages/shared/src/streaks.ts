import type { IsoDate } from './dates.js';

type DayCount = { done: number; total: number };

/**
 * Consecutive closed days, newest first. A day with nothing due or no snapshot is neutral (neither extends nor
 * breaks the streak); a day with open work ends it. Today only ever adds: an unfinished today never breaks it.
 */
export function computeStreak(pastDays: (DayCount & { date: IsoDate })[], todayRing: DayCount): number {
  let streak = 0;
  for (const day of [...pastDays].sort((a, b) => b.date.localeCompare(a.date))) {
    if (day.total === 0) continue;
    if (day.done < day.total) break;
    streak += 1;
  }
  if (todayRing.total > 0 && todayRing.done >= todayRing.total) streak += 1;
  return streak;
}
