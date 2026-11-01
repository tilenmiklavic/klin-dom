import { localDate, reminderCopy, selectDueReminders, type DueReminder, type ReminderCandidate } from '@klindom/shared';
import type { AppDeps } from '../app.js';
import type { PushPayload } from '../push/notifier.js';

export type JobDeps = Pick<AppDeps, 'db' | 'clock' | 'notifier'>;

export type ReminderSummary = { sent: number; failed: number; gone: number };

// Tasks due from yesterday to a week out (UTC dates, widened by a day each side to cover any home timezone).
// Recipients (spec §7.4): an assigned task goes to its assignee only; a household task to every member who
// hasn't muted it. Either way only members with notifications on and at least one push subscription.
// A member without a subscription gets no reminder_log row, so turning push on later still delivers.
const CANDIDATES = `
  select t.id as "taskId", t.name as "taskName", t.next_due_date as "nextDueDate",
         to_char(t.due_time, 'HH24:MI') as "dueTime", h.timezone as tz,
         (select array_agg(offset_minutes order by offset_minutes) from task_reminders where task_id = t.id) as offsets,
         coalesce((select array_agg(r.name order by r.sort_order, r.name)
                   from task_rooms tr join rooms r on r.id = tr.room_id
                   where tr.task_id = t.id and r.archived_at is null), '{}') as "roomNames",
         coalesce((select json_agg(json_build_object('userId', m.user_id,
                                                     'defaultReminderTime', to_char(m.default_reminder_time, 'HH24:MI')))
                   from home_members m
                   where m.home_id = t.home_id and m.notifications_enabled
                     and case when t.assignee_id is not null then m.user_id = t.assignee_id
                              else not exists (select 1 from task_reminder_mutes mu where mu.task_id = t.id and mu.user_id = m.user_id)
                         end
                     and exists (select 1 from push_subscriptions ps where ps.user_id = m.user_id)), '[]') as recipients
  from tasks t join homes h on h.id = t.home_id
  where t.archived_at is null
    and t.next_due_date between ($1::timestamptz at time zone 'utc')::date - 1 and ($1::timestamptz at time zone 'utc')::date + 8
    and exists (select 1 from task_reminders where task_id = t.id)`;

/** Sends every reminder whose fire time has come (within the grace window) and hasn't been claimed yet. */
export async function runReminders(deps: JobDeps): Promise<ReminderSummary> {
  const { db, clock, notifier } = deps;
  const now = clock.now();
  const candidates = (await db.query<ReminderCandidate>(CANDIDATES, [now])).filter((c) => c.recipients.length > 0);
  const byTask = new Map(candidates.map((c) => [c.taskId, c]));
  const summary: ReminderSummary = { sent: 0, failed: 0, gone: 0 };

  for (const due of selectDueReminders(candidates, now)) {
    if (!(await claim(deps, due, now))) continue;
    const task = byTask.get(due.taskId)!;
    const copy = reminderCopy({ taskName: task.taskName, roomNames: task.roomNames, dueDate: due.dueDate, today: localDate(now, task.tz) });
    const payload: PushPayload = { ...copy, url: `/tasks/${due.taskId}`, tag: `task-${due.taskId}` };
    const subs = await db.query<{ id: string; endpoint: string; p256dh: string; auth: string }>(
      'select id, endpoint, p256dh, auth from push_subscriptions where user_id = $1',
      [due.userId],
    );
    for (const sub of subs) {
      const result = await notifier.send(sub, payload);
      if (result === 'ok') {
        summary.sent++;
        await db.query('update push_subscriptions set last_success_at = $2 where id = $1', [sub.id, now]);
      } else if (result === 'gone') {
        summary.gone++;
        await db.query('delete from push_subscriptions where id = $1', [sub.id]);
      } else {
        summary.failed++;
      }
    }
  }
  return summary;
}

/**
 * Claims a reminder before sending it: only the runner whose insert lands sends, so concurrent runs can't
 * double-send. It re-checks that the task is still due on that date, in case it was completed meanwhile.
 * The row stays even if delivery fails: a reminder is never retried.
 */
async function claim(deps: JobDeps, due: DueReminder, now: Date): Promise<boolean> {
  const rows = await deps.db.query(
    `insert into reminder_log (task_id, user_id, due_date, offset_minutes, sent_at)
     select $1, $2, $3, $4, $5
     where exists (select 1 from tasks where id = $1 and next_due_date = $3 and archived_at is null)
     on conflict do nothing
     returning task_id`,
    [due.taskId, due.userId, due.dueDate, due.offsetMinutes, now],
  );
  return rows.length > 0;
}
