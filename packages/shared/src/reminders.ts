import { DateTime } from 'luxon';
import { dueMoment, type IsoDate } from './dates.js';

/** A reminder older than this when the sweep runs is dropped, not sent late. */
export const REMINDER_GRACE_MINUTES = 360;

export type ReminderCandidate = {
  taskId: string;
  taskName: string;
  roomNames: string[];
  nextDueDate: IsoDate;
  dueTime: string | null;
  offsets: number[];
  tz: string;
  /** Already filtered: the assignee, or enabled and unmuted members. */
  recipients: { userId: string; defaultReminderTime: string }[];
};

export type DueReminder = { taskId: string; userId: string; dueDate: IsoDate; offsetMinutes: number; fireAt: Date };

/** One reminder per (task, recipient, offset) whose fire time lies in (now - grace, now]. */
export function selectDueReminders(candidates: ReminderCandidate[], now: Date): DueReminder[] {
  const earliest = now.getTime() - REMINDER_GRACE_MINUTES * 60_000;
  const out: DueReminder[] = [];
  for (const c of candidates) {
    for (const r of c.recipients) {
      const due = dueMoment(c.nextDueDate, c.dueTime, r.defaultReminderTime, c.tz);
      for (const offsetMinutes of c.offsets) {
        const fireAt = new Date(due.getTime() - offsetMinutes * 60_000);
        if (fireAt.getTime() > earliest && fireAt.getTime() <= now.getTime()) {
          out.push({ taskId: c.taskId, userId: r.userId, dueDate: c.nextDueDate, offsetMinutes, fireAt });
        }
      }
    }
  }
  return out;
}

export function reminderCopy(input: { taskName: string; roomNames: string[]; dueDate: IsoDate; today: IsoDate }): {
  title: string;
  body: string;
} {
  const due = DateTime.fromISO(input.dueDate, { zone: 'utc' }).setLocale('en');
  const today = DateTime.fromISO(input.today, { zone: 'utc' });
  const days = Math.round(due.diff(today, 'days').days);
  const when = days <= 0 ? 'today' : days === 1 ? 'tomorrow' : days <= 6 ? `on ${due.toFormat('cccc')}` : `on ${due.toFormat('d MMM')}`;
  return { title: `${input.taskName} is due ${when}`, body: input.roomNames.join(', ') };
}
