import { localDate } from '@klindom/shared';
import { DateTime } from 'luxon';
import { loadRings } from '../repo/dashboard.js';
import type { JobDeps } from './reminders.js';

/**
 * Writes yesterday's ring row for every home that has none yet, once that home's local midnight has passed.
 * A missed run is not backfilled: the absent day counts as neutral for the streak.
 * Rings are computed as of the last millisecond of that local day, so they match what the dashboard last showed.
 * One failing home is logged and skipped so the others still get their row.
 */
export async function runSnapshots(deps: JobDeps): Promise<number> {
  const { db, clock } = deps;
  const now = clock.now();
  const homes = await db.query<{ id: string; timezone: string; created_at: Date }>('select id, timezone, created_at from homes');
  let written = 0;
  for (const home of homes) {
    try {
      written += await snapshotHome(deps, home, now);
    } catch (err) {
      console.error(`snapshots: home ${home.id} failed`, err);
    }
  }
  return written;
}

/** Writes one home's row for yesterday if it is due; returns 1 when a row was written. */
async function snapshotHome(deps: JobDeps, home: { id: string; timezone: string; created_at: Date }, now: Date): Promise<number> {
  const { db } = deps;
  const yesterday = DateTime.fromISO(localDate(now, home.timezone), { zone: home.timezone }).minus({ days: 1 }).toISODate()!;
  if (localDate(home.created_at, home.timezone) > yesterday) return 0;
  const [existing] = await db.query('select 1 from daily_rings where home_id = $1 and date = $2::date', [home.id, yesterday]);
  if (existing) return 0;
  const endOfDay = DateTime.fromISO(yesterday, { zone: home.timezone }).endOf('day').toJSDate();
  const { rings } = await loadRings(db, home.id, null, 'all', endOfDay);
  const inserted = await db.query(
    `insert into daily_rings (home_id, date, today_done, today_total, closed, week_done, week_total, fresh_pct)
     values ($1, $2::date, $3, $4, $5, $6, $7, $8) on conflict do nothing returning home_id`,
    [
      home.id, yesterday, rings.today.done, rings.today.total,
      rings.today.total > 0 ? rings.today.done >= rings.today.total : true,
      rings.week.done, rings.week.total, rings.fresh.pct,
    ],
  );
  return inserted.length;
}
