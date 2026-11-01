import { awardsEarned } from '@klindom/shared';
import type { Db } from '../db.js';
import { loadRings } from '../repo/dashboard.js';
import { loadStreak } from '../repo/streak.js';

/** Inserts every award the home has earned that it does not have yet; returns how many are new. */
export async function evaluateAwards(db: Db, homeId: string, now: Date): Promise<number> {
  const { rings, today } = await loadRings(db, homeId, null, 'all', now);
  const streak = await loadStreak(db, homeId, today, rings.today);
  const counts = await db.query<{ user_id: string; n: number }>(
    `select user_id, count(*)::int as n from completions where home_id = $1 and kind = 'done' group by user_id`,
    [homeId],
  );
  const [home] = await db.query<{ age_days: number }>(
    `select floor(extract(epoch from ($2::timestamptz - created_at)) / 86400)::int as age_days from homes where id = $1`,
    [homeId, now],
  );
  const earned = awardsEarned({
    streak,
    rings,
    doneCountByUser: Object.fromEntries(counts.map((c) => [c.user_id, c.n])),
    homeDoneCount: counts.reduce((sum, c) => sum + c.n, 0),
    homeAgeDays: home?.age_days ?? 0,
  });
  let inserted = 0;
  for (const { kind, userId } of earned) {
    const rows = await db.query(
      'insert into awards (home_id, user_id, kind) values ($1, $2, $3) on conflict do nothing returning id',
      [homeId, userId, kind],
    );
    inserted += rows.length;
  }
  return inserted;
}

/** Evaluates every home; returns the total number of new awards. One failing home is logged and skipped. */
export async function runAwards(db: Db, now: Date): Promise<number> {
  const homes = await db.query<{ id: string }>('select id from homes');
  let total = 0;
  for (const home of homes) {
    try {
      total += await evaluateAwards(db, home.id, now);
    } catch (err) {
      console.error(`awards: home ${home.id} failed`, err);
    }
  }
  return total;
}
