import { computeStreak, type IsoDate } from '@klindom/shared';
import type { Db } from '../db.js';

/** The household streak as of `today`, from up to 400 days of nightly snapshots plus the live today ring. */
export async function loadStreak(db: Db, homeId: string, today: IsoDate, todayRing: { done: number; total: number }): Promise<number> {
  const rows = await db.query<{ date: string; done: number; total: number }>(
    `select to_char(date, 'YYYY-MM-DD') as date, today_done as done, today_total as total
     from daily_rings where home_id = $1 and date < $2::date and date >= $2::date - 400`,
    [homeId, today],
  );
  return computeStreak(rows, todayRing);
}
