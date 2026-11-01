import { runSnapshots } from './snapshots.js';
import { runReminders, type JobDeps, type ReminderSummary } from './reminders.js';

export type { JobDeps } from './reminders.js';

/** Postgres advisory lock key shared by every runner (the worker loop and the cron endpoint). */
export const JOBS_LOCK_KEY = 7_301_301;

export type JobsSummary = { ran: boolean; reminders?: ReminderSummary; snapshots?: number; awards?: number };

/** Runs every periodic job under one lock; `ran: false` means another runner holds it right now. */
export async function runJobs(deps: JobDeps): Promise<JobsSummary> {
  const result = await deps.db.withAdvisoryLock(JOBS_LOCK_KEY, async () => {
    const reminders = await runReminders(deps);
    const snapshots = await runSnapshots(deps);
    return { reminders, snapshots };
  });
  return result ? { ran: true, ...result } : { ran: false };
}
