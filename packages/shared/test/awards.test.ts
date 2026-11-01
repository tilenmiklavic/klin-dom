import { awardsEarned } from '../src/awards.js';
import type { Rings } from '../src/rings.js';

const rings = (over: Partial<Rings> = {}): Rings => ({
  today: { done: 0, total: 0 },
  week: { done: 0, total: 0 },
  fresh: { notOverdue: 0, total: 0, pct: 100 },
  ...over,
});
type EarnInput = Parameters<typeof awardsEarned>[0];
const earn = (over: Partial<EarnInput>) =>
  awardsEarned({ streak: 0, rings: rings(), doneCountByUser: {}, homeDoneCount: 0, homeAgeDays: 0, ...over });
const allFresh = rings({ fresh: { notOverdue: 3, total: 3, pct: 100 } });
const settled = { homeDoneCount: 1, homeAgeDays: 7 };

it.each([
  ['first_task at 1', { doneCountByUser: { u1: 1 } }, [{ kind: 'first_task', userId: 'u1' }]],
  ['no first_task at 0', { doneCountByUser: { u1: 0 } }, []],
  ['tasks_100 at 100', { doneCountByUser: { u1: 100 } }, [{ kind: 'first_task', userId: 'u1' }, { kind: 'tasks_100', userId: 'u1' }]],
  ['no tasks_100 at 99', { doneCountByUser: { u1: 99 } }, [{ kind: 'first_task', userId: 'u1' }]],
  ['streak_7 at 7', { streak: 7 }, [{ kind: 'streak_7', userId: null }]],
  ['nothing at streak 6', { streak: 6 }, []],
  ['streak_30 at 30', { streak: 30 }, [{ kind: 'streak_7', userId: null }, { kind: 'streak_30', userId: null }]],
  ['only streak_7 at 29', { streak: 29 }, [{ kind: 'streak_7', userId: null }]],
  ['all_fresh at 100% in a week-old home with a completion', { rings: allFresh, ...settled }, [{ kind: 'all_fresh', userId: null }]],
  ['no all_fresh in a brand-new home with nothing done', { rings: allFresh }, []],
  ['no all_fresh in a new home with one completion', { rings: allFresh, homeDoneCount: 1, homeAgeDays: 0 }, []],
  ['no all_fresh at 6 days old', { rings: allFresh, homeDoneCount: 5, homeAgeDays: 6 }, []],
  ['no all_fresh in an old home with nothing done', { rings: allFresh, homeDoneCount: 0, homeAgeDays: 30 }, []],
  ['no all_fresh with 99%', { rings: rings({ fresh: { notOverdue: 99, total: 100, pct: 99 } }), ...settled }, []],
  ['no all_fresh without tasks', { rings: rings(), ...settled }, []],
  ['first_full_week when week done', { rings: rings({ week: { done: 4, total: 4 } }) }, [{ kind: 'first_full_week', userId: null }]],
  ['no first_full_week one short', { rings: rings({ week: { done: 3, total: 4 } }) }, []],
  ['no first_full_week with empty week', { rings: rings({ week: { done: 0, total: 0 } }) }, []],
])('%s', (_name, input, expected) => {
  expect(earn(input)).toEqual(expected);
});
