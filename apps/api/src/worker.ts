import { systemClock } from './clock.js';
import { loadWorkerConfig } from './config.js';
import { createDb } from './db.js';
import { runJobs, type JobsSummary } from './jobs/run.js';
import { notifierFromConfig } from './push/notifier.js';

const INTERVAL_MS = 60_000;

const config = loadWorkerConfig();
const db = createDb(config.DATABASE_URL, { ssl: config.DATABASE_SSL });
const deps = { db, clock: systemClock, notifier: notifierFromConfig(config) };
if (!config.VAPID_PUBLIC_KEY) console.warn('Worker: VAPID keys are not set, reminders will not be delivered');

function describe(s: JobsSummary): string {
  if (!s.ran) return 'jobs: skipped (another runner holds the lock)';
  const r = s.reminders;
  return `jobs: reminders sent=${r?.sent ?? 0} failed=${r?.failed ?? 0} gone=${r?.gone ?? 0}`;
}

let timer: NodeJS.Timeout | undefined;
let running: Promise<void> | undefined;
let stopping = false;

async function tick(): Promise<void> {
  try {
    console.log(describe(await runJobs(deps)));
  } catch (err) {
    // The loop never dies: log and try again next minute.
    console.error('jobs: failed', err);
  }
}

function schedule(): void {
  running = tick().finally(() => {
    running = undefined;
    if (!stopping) timer = setTimeout(schedule, INTERVAL_MS);
  });
}

async function shutdown(signal: string): Promise<void> {
  if (stopping) return;
  stopping = true;
  console.log(`Worker: ${signal}, finishing the current run`);
  clearTimeout(timer);
  await running;
  await db.end();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

console.log(`KlinDom worker running jobs every ${INTERVAL_MS / 1000} s`);
schedule();
