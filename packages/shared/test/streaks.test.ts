import { computeStreak } from '../src/streaks.js';

const day = (date: string, done: number, total: number) => ({ date, done, total });
const none = { done: 0, total: 0 };

it('counts consecutive closed days', () => {
  const past = [day('2026-10-30', 2, 2), day('2026-10-29', 3, 3), day('2026-10-28', 1, 1)];
  expect(computeStreak(past, none)).toBe(3);
});

it('stops at an unclosed day', () => {
  const past = [day('2026-10-30', 2, 2), day('2026-10-29', 1, 3), day('2026-10-28', 1, 1)];
  expect(computeStreak(past, none)).toBe(1);
});

it('nothing-due and missing days are neutral', () => {
  const past = [day('2026-10-30', 2, 2), day('2026-10-29', 0, 0), day('2026-10-26', 1, 1)];
  expect(computeStreak(past, none)).toBe(2);
});

it('today adds only when closed', () => {
  const past = [day('2026-10-30', 2, 2)];
  expect(computeStreak(past, { done: 2, total: 2 })).toBe(2);
  expect(computeStreak(past, { done: 0, total: 0 })).toBe(1);
});

it("today unfinished doesn't break it", () => {
  const past = [day('2026-10-29', 1, 1), day('2026-10-30', 2, 2)];
  expect(computeStreak(past, { done: 1, total: 4 })).toBe(2);
});
