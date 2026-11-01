# KlinDom Plan 3 — Reminders, Streaks & Awards, PWA, Deploy

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the working app into something a household can actually live with:
- push reminders that fire per each task's settings
- streaks, awards and a ring history
- an installable PWA
- a deploy to Render (API), Cloudflare Pages (web) and Supabase Postgres (database), with a runbook

**Architecture:** All new business logic lives in the API and in pure functions in `@klindom/shared`, as before. A single `runJobs()` function does three things: sends due reminders, freezes yesterday's rings into `daily_rings`, and evaluates awards. It runs every minute in one of two ways:
- from a `worker` entrypoint looping in Docker (Pi), or
- from `POST /internal/run-reminders` hit by an external cron (Render free tier).

Push goes through a `Notifier` interface backed by `web-push` (VAPID). The app gets a Workbox service worker for the shell cache and for `push`/`notificationclick`, a web manifest, a Notifications screen, an onboarding reminders step, a streak line, award celebrations, and an Awards & history screen.

**Tech Stack:**
- Existing: Hono, `pg`, luxon, zod, Expo SDK 57, TanStack Query, jest-expo/RNTL, vitest, Playwright, dbmate, Docker.
- New: `web-push` (+ `@types/web-push`) and `workbox-build` / `workbox-precaching` / `workbox-routing` / `workbox-strategies`, the latter for a generated service worker.
- Deploy tooling: `wrangler`, used as a devDependency in `apps/app`.
- TypeScript moves to 6.0.

**Spec:** `docs/superpowers/specs/2026-10-31-klindom-pwa-design.md`, especially §6.3, §6.4, §7.1, §7.4, §7.5, §8.4 and §8.5 step 5.

**Builds on:** Plans 1 and 2, now on `main`, plus PR #3 (`fix/app-final-review`). The work branch is `feat/reminders-rings-deploy`, cut from `fix/app-final-review`.

**Not in this plan:**
- the Plan 2 follow-ups list (`docs/superpowers/plans/2026-10-31-plan-2-followups.md`)
- native push (APNs/FCM)
- a real domain or email provider
- CI

## Global Constraints

- **Business logic only in the API and `@klindom/shared`.** This covers reminder selection, ring snapshots, streaks and awards. Nothing Supabase-specific: no RLS *policies*, no edge functions, no pg_cron, no triggers. Enabling RLS with zero policies (Task 2) is a lock-down, not logic.
- **No `@supabase/*` outside `apps/app/src/auth/`. No `fetch` outside `packages/shared/src/client.ts`.** The push module calls the API through the client.
- **`packages/ui` uses only RN primitives, `react-native-svg`, reanimated and expo-haptics.** Browser APIs (`navigator.serviceWorker`, `PushManager`, `Notification`) live only in `apps/app/src/push/` and `apps/app/src/pwa/`. Native builds get no-op versions of those modules.
- **All domain-dependent values come from env, never hard-coded.** That means the app URL, API URL, VAPID subject and keys, and the cron secret.
- **All user-visible strings go through i18n** (`apps/app/src/i18n/en.json`).
  - Reminder copy is built server-side in `@klindom/shared` and is English-only for now (spec §7.4).
  - Copy uses the README voice and no guilt language: "Dishes is due today", never "Overdue!".
- **Dates:** reminder and ring maths run in the **home's timezone** via the shared luxon helpers (`localDate`, `dueMoment`, `addInterval`, `weekBounds`). Never use `new Date('YYYY-MM-DD')`.
- **New dependencies must satisfy the pnpm `minimumReleaseAge` policy.** Never bypass or exclude it. If the latest version is too new, pin the newest version that passes.
- **Every new API route checks membership** via `requireMember`, like the existing routes. `/internal/*` checks `Authorization: Bearer <CRON_SECRET>` with a constant-time compare and returns 404 when `CRON_SECRET` is unset.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Outage or first deploy must not flood people.** When jobs haven't run for hours (Render asleep, Pi off) or on the very first run, reminders whose fire time is more than 6 hours in the past are **not** sent. Neither are overdue tasks' old reminders. Test: in Task 4, `selectDueReminders` drops a reminder that fired 7 h ago. In Task 5, the first run against a home with a 5-day-overdue task sends nothing.
2. **The worker and the cron firing in the same minute must not double-send.** The `reminder_log` row is claimed (`insert … on conflict do nothing returning`) **before** sending, and `runJobs` holds a Postgres advisory lock. Test: in Task 5, two concurrent `runJobs` calls produce exactly one `notifier.send` per (task, user, offset).
3. **Dead push subscriptions get cleaned up.** A 404/410 from the push service deletes that subscription. Other errors keep it, and the log row stays, so that reminder is not retried. Test in Task 5.
4. **DST and timezones.** A task due 08:00 Europe/Ljubljana on 2026-03-29, the spring-forward day, fires at 06:00Z. The 30 Oct 2026 nightly snapshot for an `America/Los_Angeles` home freezes the LA date, not the UTC date. Tests in Tasks 4 and 6.
5. **iOS Safari outside standalone mode.** "Turn on reminders" shows the Add to Home Screen explainer and never calls `Notification.requestPermission`. Permission `denied` shows a calm "Notifications are blocked in your browser settings" line with no button that does nothing. Test in Task 9.

---

## File Structure

```
apps/api/src/
  config.ts                  + VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, DATABASE_SSL
  db.ts                      + ssl option, advisory-lock helper
  push/notifier.ts           Notifier interface, webPushNotifier(), memoryNotifier() for tests
  jobs/reminders.ts          runReminders(deps): candidates SQL → selectDueReminders → claim → send
  jobs/snapshots.ts          runSnapshots(deps): freeze yesterday's rings per home
  jobs/awards.ts             evaluateAwards(db, homeId, now): idempotent award inserts
  jobs/run.ts                runJobs(deps): advisory lock + the three jobs, returns a summary
  repo/streak.ts             loadStreak(db, homeId, today, liveToday)
  routes/push.ts             GET /push/public-key, POST/DELETE /push/subscriptions
  routes/members.ts          GET/PATCH /homes/:id/members/me
  routes/awards.ts           POST /homes/:id/awards/seen, GET /homes/:id/history
  routes/internal.ts         POST /internal/run-reminders
  worker.ts                  loop: runJobs every 60 s
packages/shared/src/
  reminders.ts               selectDueReminders(), reminderCopy()
  streaks.ts                 computeStreak()
  awards.ts                  awardKinds, AwardKind, awardsEarned()
  schemas.ts / client.ts     new DTOs, inputs, client methods
db/migrations/20261101000003_awards_seen_rls.sql
apps/app/
  public/index.html, public/manifest.webmanifest, public/icons/*, public/_redirects
  web/sw.ts                  service worker source (Workbox), built by scripts/build-sw.mjs
  scripts/build-sw.mjs, scripts/render-icons.mjs
  src/pwa/register.ts(.web.ts)    service worker registration (no-op native)
  src/push/push.ts(.web.ts)       PushState + enable/disable (no-op native)
  src/data/notifications.ts, src/data/awards.ts
  app/(tabs)/profile/notifications.tsx, app/(tabs)/profile/awards.tsx
  app/(onboarding)/reminders.tsx
render.yaml, docs/deploy.md
```

---

### Task 1: TypeScript 6

**Files:**
- Modify: root `package.json`, `apps/app/package.json`, any `tsconfig*.json` that TS 6 rejects
- Test: `pnpm typecheck`, `pnpm test`

**Interfaces:** none.

- [ ] **Step 1:** Set `typescript` to `~6.0.3` in root `package.json` and `apps/app/package.json`. Use the newest 6.0.x that passes the release-age policy. Run `pnpm install`.
- [ ] **Step 2:** Run `pnpm typecheck`. Expected: either clean, or deprecation and config errors such as `baseUrl`, `moduleResolution: node` or `esModuleInterop`.
- [ ] **Step 3:** Fix each error at its root, in the config where possible. Do not add `ignoreDeprecations` unless a dependency's types force it, and if one does, record the ruling.
- [ ] **Step 4:** Run `pnpm typecheck && pnpm test`. Expected: all packages clean. Baseline test counts: shared 38, api 81, ui 58, app 115.
- [ ] **Step 5:** Commit: `chore: upgrade TypeScript to 6.0`.

---

### Task 2: Migration, member notification settings, Supabase lock-down

**Files:**
- Create: `db/migrations/20261101000003_awards_seen_rls.sql`
- Create: `apps/api/src/routes/members.ts`
- Modify: `apps/api/src/app.ts`, `packages/shared/src/schemas.ts`, `packages/shared/src/client.ts`
- Test: `apps/api/test/members.test.ts`, `apps/api/test/db.test.ts`

**Interfaces:**
- Produces:
  - `MemberSettingsDto { notificationsEnabled: boolean; defaultReminderTime: string /* HH:mm */ }`
  - `MemberSettingsInput = z.object({ notificationsEnabled: z.boolean(), defaultReminderTime: TimeOfDay }).partial()`
  - client `memberSettings(homeId)` and `updateMemberSettings(homeId, input)`
  - column `home_members.awards_seen_at`
  - unique index `awards_once`

- [ ] **Step 1: Write the migration.**
  - **Up:**
    - `alter table home_members add column awards_seen_at timestamptz not null default now();`
    - `create unique index awards_once on awards (home_id, coalesce(user_id, '00000000-0000-0000-0000-000000000000'::uuid), kind);`
    - `alter table <t> enable row level security;` for **every** table in the schema, including `home_removals` and `schema_migrations`.
    - Add a comment saying why: Supabase exposes `public` through its Data API using the app's publishable key. RLS with no policies denies those roles, while the API connects as the table owner and is unaffected. Self-hosted Postgres ignores this.
  - **Down:** reverses all of it.
- [ ] **Step 2: Write failing tests.**
  - `db.test.ts › every table has RLS enabled`: query `pg_class.relrowsecurity` for all tables in `public` and expect all of them `true`.
  - `members.test.ts`:
    - `GET /homes/:id/members/me returns defaults` expects `{ notificationsEnabled: true, defaultReminderTime: '08:00' }`.
    - `PATCH updates and returns settings` sends `{ defaultReminderTime: '07:30' }` and expects `07:30`.
    - `PATCH rejects '7:30'` expects 400.
    - `non-member gets 404`.
- [ ] **Step 3:** Run `pnpm -F @klindom/api test -- members db`. Expected: FAIL.
- [ ] **Step 4:** Implement the routes in `routes/members.ts`, register them in `app.ts`, and add the DTO, input schema and client methods. Return `time` as `HH:mm` (`to_char(default_reminder_time, 'HH24:MI')`).
- [ ] **Step 5:** Run the API tests. Expected: PASS, and existing tests stay green.
- [ ] **Step 6:** Commit: `feat(api): member notification settings, awards bookkeeping, RLS lock-down`.

---

### Task 3: Push subscriptions and Notifier

**Files:**
- Create: `apps/api/src/push/notifier.ts`, `apps/api/src/routes/push.ts`
- Modify: `apps/api/src/config.ts`, `apps/api/src/app.ts` (`AppDeps` gains `notifier: Notifier`), `apps/api/src/server.ts`, `apps/api/test/helpers.ts` (`testDeps` uses `memoryNotifier()`), `apps/api/package.json`, `packages/shared/src/{schemas,client}.ts`, `docker-compose.yml` (pass `VAPID_*` to `api`)
- Test: `apps/api/test/push.test.ts`, `apps/api/test/config.test.ts`

**Interfaces:**
- Produces:
  - `interface PushPayload { title: string; body: string; url: string; tag: string }`
  - `type SendResult = 'ok' | 'gone' | 'error'`
  - `interface Notifier { send(sub: { endpoint: string; p256dh: string; auth: string }, payload: PushPayload): Promise<SendResult> }`
  - `webPushNotifier({ publicKey, privateKey, subject }): Notifier`. Its mapping: 404/410 → `'gone'`, other failures → `'error'`, and it never throws.
  - `memoryNotifier(): Notifier & { sent: { endpoint: string; payload: PushPayload }[]; failWith: Map<string, SendResult> }`
  - `PushSubscriptionInput = z.object({ endpoint: z.string().url(), keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }), userAgent: z.string().max(300).optional() })`
  - client:
    - `pushPublicKey(): Promise<{ publicKey: string | null }>`
    - `subscribePush(input): Promise<{ id: string }>`
    - `unsubscribePush(id): Promise<void>`

- [ ] **Step 1: Write failing tests.**
  - `config.test.ts › VAPID keys must be set together`: only `VAPID_PUBLIC_KEY` set should throw. `VAPID_SUBJECT` must start with `mailto:` or `https:`.
  - `push.test.ts`:
    - `public key is null when VAPID unset; returned when set` (no auth needed).
    - `POST /push/subscriptions stores and returns id`.
    - `re-posting the same endpoint as another user moves it to that user`, with exactly one row afterwards.
    - `DELETE /push/subscriptions/:id deletes own`.
    - `DELETE of someone else's subscription returns 404 and keeps the row`.
    - `invalid body → 400`.
- [ ] **Step 2:** Run `pnpm -F @klindom/api test -- push config`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Add `web-push` and `@types/web-push`.
  - Config: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` are optional but all-or-none.
  - `server.ts` builds `webPushNotifier` when the keys are set, otherwise a notifier that logs and returns `'error'`.
  - Upsert by endpoint: `insert … on conflict (endpoint) do update set user_id, p256dh, auth, user_agent`.
  - Add a README line on generating keys: `pnpm -F @klindom/api exec web-push generate-vapid-keys`.
- [ ] **Step 4:** Run the API tests. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(api): push subscriptions behind a Notifier interface`.

---

### Task 4: Reminder selection and copy (pure)

**Files:**
- Create: `packages/shared/src/reminders.ts`, `packages/shared/test/reminders.test.ts`
- Modify: `packages/shared/src/index.ts`

**Interfaces:**
- Consumes: `dueMoment(dueDate, dueTime, fallbackTime, tz)` and `localDate` from `dates.ts`
- Produces:
  ```ts
  export const REMINDER_GRACE_MINUTES = 360;
  export type ReminderCandidate = {
    taskId: string; taskName: string; roomNames: string[]; nextDueDate: IsoDate; dueTime: string | null;
    offsets: number[]; tz: string;
    recipients: { userId: string; defaultReminderTime: string }[]; // already filtered: assignee or enabled+unmuted members
  };
  export type DueReminder = { taskId: string; userId: string; dueDate: IsoDate; offsetMinutes: number; fireAt: Date };
  export function selectDueReminders(candidates: ReminderCandidate[], now: Date): DueReminder[];
  export function reminderCopy(input: { taskName: string; roomNames: string[]; dueDate: IsoDate; today: IsoDate }): { title: string; body: string };
  ```
  - `selectDueReminders` keeps a reminder when `fireAt = dueMoment(nextDueDate, dueTime, recipient.defaultReminderTime, tz) − offset` satisfies `now − GRACE < fireAt ≤ now`.
  - `reminderCopy` gives:
    - title `"<Task> is due today"`, `"… is due tomorrow"`, `"… is due on <Weekday>"` (within 6 days) or `"… is due on <d MMM>"`
    - body = room names joined with `", "`, or `""` when there are none

- [ ] **Step 1: Write failing tests**, all with fixed instants:
  - `fires at due time for a timed task`: due 2026-11-02 18:00 Europe/Ljubljana, offset 0, now 17:00Z → one reminder with `fireAt` 17:00Z.
  - `untimed task uses each recipient's morning hour`: recipients at 07:00 and 09:00, now 08:30 local → only the 07:00 one.
  - `offset fires earlier`: offset 60 on 18:00 → `fireAt` 17:00 local.
  - `not yet due → nothing`.
  - `older than 6 h → dropped` (Review Focus 1): `fireAt` 7 h before now.
  - `DST spring-forward`: 2026-03-29 08:00 Europe/Ljubljana → `fireAt` `2026-03-29T06:00:00Z` (Review Focus 4).
  - `evening-before offset` (`eveningBeforeOffset('09:00', …)` → 900 min): fires 18:00 the previous local day.
  - `reminderCopy`:
    - `('Dishes', ['Kitchen'], due = today)` → `{ title: 'Dishes is due today', body: 'Kitchen' }`
    - tomorrow → `'Clean windows is due tomorrow'`
    - 3 days ahead on 2026-11-05 (a Thursday) → `'… is due on Thursday'`
    - 10 days ahead → `'… is due on 12 Nov'`
- [ ] **Step 2:** Run `pnpm -F @klindom/shared test -- reminders`. Expected: FAIL (module not found).
- [ ] **Step 3:** Implement in `reminders.ts` and export from the index.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(shared): reminder selection and copy`.

---

### Task 5: Jobs runner and the reminder job

**Files:**
- Create: `apps/api/src/jobs/reminders.ts`, `apps/api/src/jobs/run.ts`, `apps/api/src/routes/internal.ts`, `apps/api/src/worker.ts`
- Modify: `apps/api/src/db.ts` (`withAdvisoryLock`), `apps/api/src/app.ts`, `apps/api/package.json` (build also emits `dist/worker.cjs`), `apps/api/Dockerfile` (copy both), `docker-compose.yml` (`worker` service: same build, `command: ["node", "dist/worker.cjs"]`, same env, depends on migrate)
- Test: `apps/api/test/reminders-job.test.ts`, `apps/api/test/internal.test.ts`

**Interfaces:**
- Consumes: `selectDueReminders` and `reminderCopy` (Task 4), `Notifier` (Task 3)
- Produces:
  - `type JobDeps = Pick<AppDeps, 'db' | 'clock' | 'notifier'>`
  - `runReminders(deps: JobDeps): Promise<{ sent: number; failed: number; gone: number }>`
  - `runJobs(deps: JobDeps): Promise<{ ran: boolean; reminders?: …; snapshots?: number; awards?: number }>`. `ran: false` means another runner held the lock. Tasks 6 and 7 add their jobs here.
  - `db.withAdvisoryLock<T>(key: number, fn: () => Promise<T>): Promise<T | undefined>`. It uses `pg_try_advisory_lock` on **one pooled client**, so lock and unlock happen on the same connection.

- [ ] **Step 1: Write failing tests**, using `FixedClock` and `memoryNotifier`.
  - `runReminders`:
    - `sends to every enabled member for a household task, with copy and url /tasks/<id>`: payload `{ title: 'Dishes is due today', body: 'Kitchen', url: '/tasks/<id>', tag: 'task-<id>' }`.
    - `assigned task goes to the assignee only`.
    - `skips members with notifications off, and muted members`.
    - `sends once: a second run in the same minute sends nothing`.
    - `two concurrent runJobs → each reminder sent exactly once` (Review Focus 2).
    - `5-day-overdue task on first run → nothing sent` (Review Focus 1).
    - `gone deletes the subscription; error keeps it` (Review Focus 3). In both cases the log row exists.
    - `recipient with no subscriptions → no log row`, so turning push on within the grace window still delivers.
    - `completed task (next_due_date advanced) → no send for the old date`.
  - `internal.test.ts`:
    - `404 when CRON_SECRET unset`.
    - `401 on wrong secret`.
    - `200 with summary on right secret`.
- [ ] **Step 2:** Run `pnpm -F @klindom/api test -- reminders-job internal`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - **Candidate SQL** selects:
    - tasks not archived with `next_due_date between today_utc - 1 day and today_utc + 8 days`
    - their offsets
    - room names
    - home tz
    - recipients as defined in spec §7.4
    - only recipients who have at least one push subscription
  - **Per `DueReminder`:**
    1. Claim with `insert into reminder_log … on conflict do nothing returning task_id`.
    2. If the insert returned a row, send to each of that user's subscriptions.
    3. On `'ok'` update `last_success_at`. On `'gone'` delete the subscription.
  - **Worker** calls `runJobs` every 60 s and logs a one-line summary. Catch and log errors; the loop never dies.
  - **Route** calls `runJobs` and returns its summary.
  - **Lock key** is the constant `7_301_301`.
- [ ] **Step 4:** Run the API tests, then `docker compose build api worker`. Expected: PASS, and both images build.
- [ ] **Step 5:** Commit: `feat(api): reminder job, worker entrypoint and cron endpoint`.

---

### Task 6: Nightly ring snapshots and streak

**Files:**
- Create: `packages/shared/src/streaks.ts`, `packages/shared/test/streaks.test.ts`, `apps/api/src/jobs/snapshots.ts`, `apps/api/src/repo/streak.ts`
- Modify: `apps/api/src/jobs/run.ts`, `apps/api/src/repo/dashboard.ts`, `apps/api/src/routes/dashboard.ts`, `packages/shared/src/schemas.ts` (`DashboardDto.streak: number`)
- Test: `apps/api/test/snapshots.test.ts`, `apps/api/test/dashboard.test.ts`

**Interfaces:**
- Consumes: `loadRings(db, homeId, userId, scope, now)`. Refactor it to accept `userId: string | null`, using `null` with scope `'all'`, so the snapshot job needs no fake user.
- Produces:
  - `computeStreak(pastDays: { date: IsoDate; done: number; total: number }[], todayRing: { done: number; total: number }): number`
    - `pastDays` is in any order, before today.
    - **Algorithm:** walk the days newest first.
      - `total = 0` → neutral, continue.
      - `done >= total` → +1.
      - otherwise → stop.
      - Missing dates are neutral.
    - Then add 1 if `todayRing.total > 0 && done >= total`. An unfinished today never breaks the streak.
  - `runSnapshots(deps): Promise<number>`, the number of rows written.
  - `loadStreak(db, homeId, today, todayRing): Promise<number>`, reading up to 400 days of `daily_rings`.

- [ ] **Step 1: Write failing tests.**
  - `computeStreak`:
    - `counts consecutive closed days`
    - `stops at an unclosed day`
    - `nothing-due and missing days are neutral`
    - `today adds only when closed`
    - `today unfinished doesn't break it`
  - `runSnapshots`:
    - `writes yesterday's row once per home after local midnight`: now 2026-11-02T00:05 Europe/Ljubljana writes the `2026-11-01` row, and a second run writes 0.
    - `LA home at 2026-10-31T07:30Z writes 2026-10-30` (Review Focus 4).
    - `no row for days before the home existed`.
    - `values match the live rings computed just before midnight`: a task due yesterday and done yesterday gives `today_done 1/1`, `closed true`.
  - `dashboard.test.ts › returns streak`: seed 3 closed `daily_rings` days plus today closed → `streak: 4`.
- [ ] **Step 2:** Run the shared and API tests. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - For each home where `localDate(now, tz) − 1` has no row and `localDate(created_at, tz) ≤ that date`, compute `loadRings(…, endOfDay)`, where `endOfDay` is the last millisecond of that local date. Insert with `on conflict do nothing`.
  - Store `closed = total > 0 ? done >= total : true`, `fresh_pct = rings.fresh.pct`.
  - **Ruling:** a missed run is not backfilled. Its day is simply absent, which the streak treats as neutral. Ledger this.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: nightly ring snapshots and household streak`.

---

### Task 7: Awards, "new award" delivery and history

**Files:**
- Create: `packages/shared/src/awards.ts`, `packages/shared/test/awards.test.ts`, `apps/api/src/jobs/awards.ts`, `apps/api/src/routes/awards.ts`
- Modify: `apps/api/src/jobs/run.ts`, `apps/api/src/routes/completions.ts` (evaluate after complete, best-effort: catch and log), `apps/api/src/routes/dashboard.ts`, `packages/shared/src/{schemas,client}.ts`
- Test: `apps/api/test/awards.test.ts`

**Interfaces:**
- Produces:
  - `awardKinds = ['first_task', 'first_full_week', 'streak_7', 'streak_30', 'all_fresh', 'tasks_100'] as const`, with `type AwardKind`. `first_task` and `tasks_100` are per person; the rest are household awards (`user_id` null).
  - `awardsEarned(input: { streak: number; rings: Rings; doneCountByUser: Record<string, number> }): { kind: AwardKind; userId: string | null }[]`, a pure function. It returns:
    - `first_task` for each user with ≥ 1 done
    - `tasks_100` for each user with ≥ 100
    - `streak_7` and `streak_30` at those thresholds
    - `all_fresh` when `rings.fresh.total > 0 && pct === 100`
    - `first_full_week` when `week.total > 0 && week.done >= week.total`
  - `evaluateAwards(db, homeId, now): Promise<number>` inserts with `on conflict do nothing` on `awards_once` and returns the number of new rows.
  - `AwardDto { id: string; kind: AwardKind; userId: string | null; userName: string | null; earnedAt: string }`. `userName` is `"Former member"` per spec §7.1a when that person has left.
  - `DashboardDto.newAwards: AwardDto[]`: awards with `earned_at > my awards_seen_at` that are household-wide or mine.
  - `POST /homes/:id/awards/seen` → 204. It sets `awards_seen_at = now()`.
  - `GET /homes/:id/history?month=YYYY-MM` → `HistoryDto { month: string; days: { date: IsoDate; done: number; total: number; closed: boolean }[]; today: { date: IsoDate; done: number; total: number }; awards: AwardDto[] }`, where `awards` lists all of them, newest first. A bad `month` → 400.
  - client methods `markAwardsSeen(homeId)` and `history(homeId, month)`

- [ ] **Step 1: Write failing tests.**
  - `awardsEarned`: table-driven, one row per kind at the threshold and one just below it.
  - `awards.test.ts`:
    - `first completion earns first_task for that user, shown once in newAwards, gone after /awards/seen`.
    - `evaluating twice inserts nothing new`.
    - `all_fresh when every task is fresh`.
    - `history returns the month's daily_rings and today's live ring`.
    - `history month=2026-13 → 400`.
    - `a removed member's award shows userName "Former member"`.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement. `evaluateAwards` builds its input from `loadRings('all')`, `loadStreak` and a `count(*) … kind='done' group by user_id`. `runJobs` calls it for every home after snapshots.
- [ ] **Step 4:** Run all API and shared tests. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: awards, new-award delivery and ring history`.

---

### Task 8: PWA shell — manifest, icons, service worker

**Files:**
- Create:
  - `apps/app/public/index.html`
  - `apps/app/public/manifest.webmanifest`
  - `apps/app/public/_redirects` (`/* /index.html 200`)
  - `apps/app/public/icons/{icon-192.png,icon-512.png,maskable-512.png,apple-touch-icon.png,badge-72.png}`
  - `apps/app/scripts/render-icons.mjs`
  - `apps/app/web/sw.ts`
  - `apps/app/scripts/build-sw.mjs`
  - `apps/app/src/pwa/register.ts` (no-op) and `apps/app/src/pwa/register.web.ts`
- Modify: `apps/app/package.json` (`export:web` = `expo export --platform web && node scripts/build-sw.mjs`; add the Workbox deps), `apps/app/app/_layout.tsx` (call `registerServiceWorker()` once)
- Test: `apps/app/test/pwa.test.ts`, `apps/app/e2e/pwa.spec.ts`

**Interfaces:**
- Produces:
  - `registerServiceWorker(): void`. It registers `/sw.js` only when `'serviceWorker' in navigator`, `!__DEV__` and the page is served over https or localhost.
  - The SW posts nothing back. Notification data is `{ url }`.

- [ ] **Step 1: Write failing tests.**
  - `pwa.test.ts`:
    - `manifest has name KlinDom, display standalone, theme/background #f2f2f2, start_url /, 192/512/maskable icons that exist on disk`.
    - `index.html links the manifest, apple-touch-icon, theme-color, viewport-fit=cover, apple-mobile-web-app-capable`.
    - `register is a no-op in __DEV__`.
  - `e2e/pwa.spec.ts`, against `npx serve dist -s` after `export:web`:
    - `/manifest.webmanifest` is 200.
    - `navigator.serviceWorker.ready` resolves with scope `/`.
    - Offline reload of `/` still renders the welcome text, via `context.setOffline(true)`.
- [ ] **Step 2:** Run `pnpm -F @klindom/app test -- pwa`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - **Icons:** `render-icons.mjs` uses Playwright, which is already a devDependency, to screenshot an inline SVG at each size: the design system's `sparkle` path in `onBrand` on a `brand` rounded square, with full-bleed safe-zone padding for maskable. Commit the PNG output.
  - **`index.html`:** start from Expo's default single-page template (`npx expo customize public/index.html`) and add the tags.
  - **`sw.ts`:**
    - `precacheAndRoute(self.__WB_MANIFEST)`
    - a `NavigationRoute` to `/index.html`, NetworkFirst with a cache fallback
    - `push` → `showNotification(title, { body, tag, icon: '/icons/icon-192.png', badge: '/icons/badge-72.png', data: { url } })`
    - `notificationclick` → focus an existing client and `navigate(url)`, else `openWindow(url)`
    - `skipWaiting`/`clientsClaim`
  - **`build-sw.mjs`:** bundle `web/sw.ts` with esbuild (already in the repo) to a temp file, then run `workbox-build`'s `injectManifest` with `globDirectory: dist` and `globPatterns: ['**/*.{js,css,html,png,ttf,woff2,webmanifest}']` into `dist/sw.js`.
- [ ] **Step 4:** Run `pnpm -F @klindom/app test && pnpm -F @klindom/app export:web && pnpm -F @klindom/app exec playwright test pwa`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(app): installable PWA shell with service worker`.

---

### Task 9: Push on the device, Notifications screen, onboarding reminders step

**Files:**
- Create: `apps/app/src/push/push.ts` (native no-op returning `'unsupported'`), `apps/app/src/push/push.web.ts`, `apps/app/src/data/notifications.ts`, `apps/app/app/(tabs)/profile/notifications.tsx`, `apps/app/app/(onboarding)/reminders.tsx`
- Modify: `apps/app/app/(tabs)/profile/index.tsx` (the Notifications row opens the screen and shows "On"/"Off"), `apps/app/app/(onboarding)/invite.tsx` (continue/skip → `/reminders`), `apps/app/src/i18n/en.json`
- Test: `apps/app/test/push.test.ts`, `apps/app/test/notifications.test.tsx`

**Interfaces:**
- Consumes: client `pushPublicKey`, `subscribePush`, `unsubscribePush`, `memberSettings`, `updateMemberSettings`
- Produces:
  ```ts
  export type PushState = 'unsupported' | 'needs-install' | 'denied' | 'off' | 'on';
  export interface PushEnv { /* injectable for tests: navigator, Notification, matchMedia, storage */ }
  export function createPush(env: PushEnv): {
    state(): Promise<PushState>;
    enable(api: ApiClient): Promise<PushState>;   // asks permission, subscribes, POSTs, stores the id
    disable(api: ApiClient): Promise<PushState>;  // unsubscribes locally + DELETE
  };
  export const push: ReturnType<typeof createPush>; // bound to the real browser
  ```
  - `'needs-install'` means iOS (iPhone/iPad UA, or Mac UA with touch) that is not standalone: `navigator.standalone !== true` and not `matchMedia('(display-mode: standalone)')`.
  - The subscription id is stored under `klindom.pushSubscriptionId`.
  - `applicationServerKey` is the base64url public key from `pushPublicKey()`. A `null` key → `'unsupported'`.
  - Hooks: `useMemberSettings(homeId)` and `useUpdateMemberSettings(homeId)`.

- [ ] **Step 1: Write failing tests.**
  - `push.test.ts`, with a fake env:
    - `no PushManager → unsupported`.
    - `iOS Safari not standalone → needs-install, and enable never calls requestPermission` (Review Focus 5).
    - `permission denied → denied`.
    - `enable subscribes with the server key and POSTs keys`, then the state is `on`.
    - `disable unsubscribes and DELETEs the stored id`.
  - `notifications.test.tsx`:
    - `toggle notifications off calls PATCH { notificationsEnabled: false }`.
    - `morning time saves '07:30' and rejects '7:3' with a field error`.
    - `needs-install shows the Add to Home Screen steps`.
    - `denied shows the blocked hint and no enable button`.
    - `onboarding: invite → reminders → "Not now" lands on tabs; "Turn on reminders" calls enable`.
- [ ] **Step 2:** Run `pnpm -F @klindom/app test -- push notifications`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - **Notifications screen:**
    - a "Reminders" switch, using RN `Switch` with `trackColor` from tokens
    - a "Morning reminder time" `TextField` (HH:mm) with a Save button
    - a "This device" group whose row and action depend on `PushState`:
      - `off` → "Turn on for this device"
      - `on` → "On for this device" plus "Turn off"
      - `needs-install` → the explainer: "Tap Share, then Add to Home Screen, then open KlinDom from your Home Screen."
      - `denied` → the blocked hint
      - `unsupported` → "This browser can't show notifications."
  - **Onboarding reminders screen:** title "Stay on top of chores", one line of explainer, primary "Turn on reminders", chip "Not now". Both end at `router.replace('/(tabs)')`. If the state is `needs-install`, show the explainer and a "Continue" chip instead.
- [ ] **Step 4:** Run app tests and typecheck. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(app): push on this device, notification settings, onboarding reminders`.

---

### Task 10: Streak line, award celebration, Awards & history screen

**Files:**
- Create: `apps/app/src/data/awards.ts`, `apps/app/app/(tabs)/profile/awards.tsx`, `apps/app/src/awards/copy.ts` (`AwardKind` → i18n key)
- Modify: `apps/app/app/(tabs)/index.tsx`, `apps/app/app/(tabs)/profile/index.tsx` (add an "Awards & history" row in the Home group), `apps/app/src/i18n/en.json`
- Test: `apps/app/test/awards.test.tsx`, `apps/app/test/home.test.tsx`

**Interfaces:**
- Consumes:
  - `DashboardDto.streak` and `DashboardDto.newAwards`
  - client `markAwardsSeen` and `history`
  - UI `Ring` (`progress`, `size`, `stroke`, `color`), `Celebration`, `useToast`
- Produces:
  - `useHistory(homeId, month)`
  - `useMarkAwardsSeen(homeId)`

- [ ] **Step 1: Write failing tests.**
  - `home.test.tsx`:
    - `subline shows "6-day streak" when streak is 6, "1-day streak" when 1, nothing when 0`.
    - `newAwards → Celebration plus toast "New award: 7-day streak", then markAwardsSeen called once`, and not again on refetch.
  - `awards.test.tsx`:
    - `calendar renders one small ring per day of the month, Monday-first, with today's live ring`.
    - `prev/next month navigates and refetches`.
    - `next is disabled on the current month`.
    - `earned awards listed with who and when`, with unearned ones shown muted as "Not yet".
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - **Award names (en):**
    - `first_task` "First task done"
    - `first_full_week` "First full week"
    - `streak_7` "7-day streak"
    - `streak_30` "30-day streak"
    - `all_fresh` "Every room fresh"
    - `tasks_100` "100 tasks done"
  - **Calendar:** a 7-column grid of `Ring`s. Use size 28 and stroke 3, with `brand` for closed or progress days and progress 0 for days with no data. The date number appears under each ring in a `caption` style.
- [ ] **Step 4:** Run app tests, typecheck and the existing e2e smoke. Expected: PASS.
- [ ] **Step 5:** Commit: `feat(app): streak, award celebrations, awards and history`.

---

### Task 11: Deploy configuration and runbook

**Files:**
- Create:
  - `render.yaml`
  - `docs/deploy.md`
  - `apps/app/.env.production.example`
  - `apps/app/scripts/deploy-web.sh`
- Modify:
  - `apps/api/src/config.ts` and `apps/api/src/db.ts` (`DATABASE_SSL`)
  - root `package.json` (`deploy:web`)
  - `.gitignore` (`apps/app/.env.production`)
  - README (pointer to `docs/deploy.md`)
- Test: `apps/api/test/config.test.ts`, `apps/api/test/db.test.ts`

**Interfaces:**
- Produces:
  - Env var `DATABASE_SSL`, an enum `off | require | verify`, default `off`. `require` gives `ssl: { rejectUnauthorized: false }`, meaning encrypted to the Supabase pooler. `verify` gives `ssl: true`.
  - `createDb(url, { ssl })`.

- [ ] **Step 1: Write failing tests.**
  - `config.test.ts › DATABASE_SSL defaults off and rejects unknown values`.
  - `db.test.ts › createDb passes ssl options to the pool`. Inspect `pool.options.ssl`.
- [ ] **Step 2:** Run them. Expected: FAIL.
- [ ] **Step 3: Implement, then write the files.**
  - **`render.yaml`:** one `web` service with:
    - `runtime: docker`, `dockerfilePath: apps/api/Dockerfile`, `plan: free`, `region: frankfurt`
    - `healthCheckPath: /healthz`
    - env keys declared with `sync: false` for the secrets (`DATABASE_URL`, `CRON_SECRET`, `VAPID_PRIVATE_KEY`)
    - plain values for `AUTH_MODE=jwks`, `DATABASE_SSL=require` and `NODE_ENV=production`
  - **`deploy-web.sh`:** `set -euo pipefail`, require `apps/app/.env.production`, run `pnpm -F @klindom/app export:web`, then `pnpm -F @klindom/app exec wrangler pages deploy dist --project-name klindom`.
  - **`docs/deploy.md` runbook**, in order:
    1. **Supabase database.** Copy the **session pooler** connection string (port 5432, user `postgres.<ref>`), not the direct host, which is IPv6-only and unreachable from Render. Run migrations from the laptop with `docker compose run --rm -e DATABASE_URL='<pooler url>?sslmode=require' migrate`. Turn off the Data API, or confirm RLS is on (Task 2).
    2. **VAPID keys.** Generate them, with `VAPID_SUBJECT=mailto:<owner email>`.
    3. **Render.** New Blueprint from the repo, then fill in the secrets. Set `APP_URL` to the Pages URL and `AUTH_JWKS_URL` / `AUTH_ISSUER` to the Supabase values. Check `curl https://<svc>.onrender.com/healthz`.
    4. **Cloudflare Pages.**
       - Create the project `klindom`.
       - Copy `.env.production.example` to `.env.production` and fill in the Render URL, Supabase URL and publishable key.
       - Run `pnpm deploy:web`.
    5. **Supabase Auth.** Add the Pages URL to the Site URL and redirect URLs. Add it as an authorised JS origin on the Google OAuth client.
    6. **cron-job.org.** Every minute, `POST https://<svc>.onrender.com/internal/run-reminders` with header `Authorization: Bearer <CRON_SECRET>`. This also keeps the free instance awake (~744 of 750 free hours a month).
    7. **Smoke test.**
       - sign in on a phone and install it to the Home Screen
       - turn on reminders
       - create a task due in 5 minutes and receive the push
    8. **Raspberry Pi later.** Run the same compose with `worker` instead of cron, and `DATABASE_SSL=off`.
- [ ] **Step 4:** Run `pnpm typecheck && pnpm test`. Expected: all green.
- [ ] **Step 5:** Commit: `chore: deploy configuration and runbook`.

---

## After the plan: go-live with the owner

Task 11's runbook steps 1–7 need the owner's accounts: Supabase DB password, Render, Cloudflare and cron-job.org. They are run together in the session, after the final review. They are not part of any task's completion contract.
