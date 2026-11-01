import { describe, expect, it } from 'vitest';
import { eveningBeforeOffset } from '../src/format.js';
import { REMINDER_GRACE_MINUTES, reminderCopy, selectDueReminders, type ReminderCandidate } from '../src/reminders.js';

const TZ = 'Europe/Ljubljana';

function candidate(over: Partial<ReminderCandidate> = {}): ReminderCandidate {
  return {
    taskId: 't1',
    taskName: 'Dishes',
    roomNames: ['Kitchen'],
    nextDueDate: '2026-11-02',
    dueTime: '18:00',
    offsets: [0],
    tz: TZ,
    recipients: [{ userId: 'u1', defaultReminderTime: '08:00' }],
    ...over,
  };
}

describe('selectDueReminders', () => {
  it('fires at due time for a timed task', () => {
    const out = selectDueReminders([candidate()], new Date('2026-11-02T17:00:00Z'));
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ taskId: 't1', userId: 'u1', dueDate: '2026-11-02', offsetMinutes: 0 });
    expect(out[0]!.fireAt.toISOString()).toBe('2026-11-02T17:00:00.000Z');
  });

  it("untimed task uses each recipient's morning hour", () => {
    const c = candidate({
      dueTime: null,
      recipients: [
        { userId: 'early', defaultReminderTime: '07:00' },
        { userId: 'late', defaultReminderTime: '09:00' },
      ],
    });
    const out = selectDueReminders([c], new Date('2026-11-02T07:30:00Z')); // 08:30 local
    expect(out.map((r) => r.userId)).toEqual(['early']);
  });

  it('offset fires earlier', () => {
    const out = selectDueReminders([candidate({ offsets: [60] })], new Date('2026-11-02T16:30:00Z'));
    expect(out).toHaveLength(1);
    expect(out[0]!.fireAt.toISOString()).toBe('2026-11-02T16:00:00.000Z'); // 17:00 local
    expect(out[0]!.offsetMinutes).toBe(60);
  });

  it('not yet due gives nothing', () => {
    expect(selectDueReminders([candidate()], new Date('2026-11-02T16:59:00Z'))).toEqual([]);
  });

  it('older than 6 h is dropped', () => {
    expect(REMINDER_GRACE_MINUTES).toBe(360);
    expect(selectDueReminders([candidate()], new Date('2026-11-03T00:00:00Z'))).toEqual([]); // fireAt 7 h ago
    expect(selectDueReminders([candidate()], new Date('2026-11-02T22:00:00Z'))).toHaveLength(1); // 5 h ago
  });

  it('handles DST spring-forward', () => {
    const c = candidate({ nextDueDate: '2026-03-29', dueTime: '08:00' });
    const out = selectDueReminders([c], new Date('2026-03-29T06:10:00Z'));
    expect(out[0]!.fireAt.toISOString()).toBe('2026-03-29T06:00:00.000Z');
  });

  it('evening-before offset fires 18:00 the previous local day', () => {
    const offset = eveningBeforeOffset('09:00', '08:00');
    expect(offset).toBe(900);
    const c = candidate({ dueTime: '09:00', offsets: [offset] });
    const out = selectDueReminders([c], new Date('2026-11-01T17:05:00Z'));
    expect(out).toHaveLength(1);
    expect(out[0]!.fireAt.toISOString()).toBe('2026-11-01T17:00:00.000Z'); // 18:00 local, CET
  });
});

describe('reminderCopy', () => {
  const base = { taskName: 'Clean windows', roomNames: ['Kitchen', 'Bedroom'], today: '2026-11-02' };

  it('today', () => {
    expect(reminderCopy({ taskName: 'Dishes', roomNames: ['Kitchen'], dueDate: '2026-11-02', today: '2026-11-02' })).toEqual({
      title: 'Dishes is due today',
      body: 'Kitchen',
    });
  });
  it('tomorrow', () => {
    expect(reminderCopy({ ...base, dueDate: '2026-11-03' }).title).toBe('Clean windows is due tomorrow');
  });
  it('weekday within 6 days', () => {
    expect(reminderCopy({ ...base, dueDate: '2026-11-05' }).title).toBe('Clean windows is due on Thursday');
  });
  it('date further out', () => {
    expect(reminderCopy({ ...base, dueDate: '2026-11-12' }).title).toBe('Clean windows is due on 12 Nov');
  });
  it('joins rooms, empty when none', () => {
    expect(reminderCopy({ ...base, dueDate: '2026-11-02' }).body).toBe('Kitchen, Bedroom');
    expect(reminderCopy({ ...base, roomNames: [], dueDate: '2026-11-02' }).body).toBe('');
  });
});
