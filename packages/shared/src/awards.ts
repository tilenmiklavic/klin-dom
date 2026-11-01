import type { Rings } from './rings.js';

export const awardKinds = ['first_task', 'first_full_week', 'streak_7', 'streak_30', 'all_fresh', 'tasks_100'] as const;
export type AwardKind = (typeof awardKinds)[number];

/** `first_task` and `tasks_100` belong to a person; the rest are household awards (`userId: null`). */
export function awardsEarned(input: {
  streak: number;
  rings: Rings;
  doneCountByUser: Record<string, number>;
}): { kind: AwardKind; userId: string | null }[] {
  const { streak, rings, doneCountByUser } = input;
  const out: { kind: AwardKind; userId: string | null }[] = [];
  for (const [userId, count] of Object.entries(doneCountByUser)) {
    if (count >= 1) out.push({ kind: 'first_task', userId });
    if (count >= 100) out.push({ kind: 'tasks_100', userId });
  }
  if (streak >= 7) out.push({ kind: 'streak_7', userId: null });
  if (streak >= 30) out.push({ kind: 'streak_30', userId: null });
  if (rings.fresh.total > 0 && rings.fresh.pct === 100) out.push({ kind: 'all_fresh', userId: null });
  if (rings.week.total > 0 && rings.week.done >= rings.week.total) out.push({ kind: 'first_full_week', userId: null });
  return out;
}
