# KlinDom — home cleaning PWA: design

Date: 2026-10-31 · Status: draft for review

## 1. Intent

KlinDom is a shared home-cleaning planner. A household sets up its home, rooms and recurring chores once, and the app keeps everyone on track by showing what is due, sending reminders, and making ticking chores off feel rewarding, in the spirit of closing activity rings.

It ships first as an installable **PWA**. Native **iOS and Android** apps are planned later, so UI is built from reusable components that run natively without a rewrite. The backend starts on hosted services but will move to the owner's **Raspberry Pi**, and later a dedicated server. Everything server-side is therefore portable: plain Postgres, Docker, and no logic tied to one provider.

Visual language: the owner's **KlinDom design system** (https://claude.ai/artifact/2AgT7Fwo2AZnK6EuyoQPYg): tokens, components, the icon set and the brand-book README. The app should follow it closely while feeling as native as possible.

## 2. Goals

1. A household (one **Home**) with multiple members who join by invite.
2. **Rooms**, each with its own **Tasks**. A task can span several rooms.
3. Tasks recur at a set frequency; anyone can complete any task.
4. A **Home dashboard** with ring-based progress and a satisfying tick-off moment.
5. **Push reminders**, configurable per task.
6. **Stats** on who did what and when, recorded so a future admin dashboard can be built on the same data.
7. Sign-in with **Google** or **email**.
8. A codebase that ports cleanly to native apps (front end) and to self-hosting (back end).

## 3. Non-goals (this version)

- Native iOS/Android store builds. The code must allow them, but we don't ship them.
- Dark mode. Light theme only for now; colours come from tokens so dark mode can be added later.
- Languages other than English. All user-facing strings still go through an i18n layer from day one.
- The KlinDom assistant/chat components (ChatBubble, ChatInput) and the desktop SideNav layout. A wider centred mobile layout is enough on desktop.
- An admin dashboard. We only make sure the data it will need is recorded.
- Full offline editing.
- Multiple homes per user in the UI. The data model allows it.

## 4. Anti-goals: failure even if it works

- Business logic in the client, or in Supabase-only features (row-level security policies, edge functions, Supabase realtime, database triggers that call Supabase APIs). Leaving Supabase must not require rediscovering rules.
- Screens importing Supabase (or any backend SDK) directly.
- Components written web-only (`div`, CSS files, DOM APIs) so they can't run in React Native.
- Alarmist UI: red warnings, "Overdue!" shouting. Overdue is shown calmly ("Due 5 days ago" in `brand-strong`).
- A look that copies Apple Fitness. The inspiration is the *feeling* of closing rings, rendered in KlinDom's own style.

Note: the design-system README's lines about "no streaks, no scores" are leftovers from a fitness app and **do not apply**. This app uses streaks and awards.

## 5. Constraints and decisions made with the owner

| Area | Decision |
|---|---|
| Front end | **React Native via Expo**, exported to web as the PWA. |
| Back end | Our own **TypeScript API service** holds all business logic. SQL holds data and constraints. |
| Database | **Postgres**, schema as plain SQL migrations in the repo. Hosted on **Supabase** for now. |
| Auth | **Supabase Auth** for now: **Google** sign-in plus **email**. The API verifies tokens itself, so the provider can be swapped. |
| Packaging | **Docker for everything** server-side (`api`, `worker`, local `postgres`) via `docker-compose`. |
| Interim hosting | **Render free tier** for the API container. The PWA goes on a free static host. |
| Migration path | Raspberry Pi (same compose stack, local Postgres) → dedicated server later. |
| Recurrence | Next due date = **completion time + interval** (not a fixed calendar rhythm). |
| Assignment | Tasks belong to the **household** by default and can optionally be assigned to one member. **Anyone can complete any task.** |
| Onboarding | After sign-in: **join** a home (link or code) or **create** one. Create offers **suggested rooms & tasks** or **start from scratch**. |
| Gamification | Rings in the spirit of closing activity rings, plus streaks, history and awards. |
| Home layout | **Option A, "Rings hero"**: three nested full rings with a legend (mockup in §8.1). |
| Domain & email | **None yet.** Testing runs on the static host's free subdomain (e.g. `*.pages.dev`) and Supabase's built-in email sender. **Before real users are invited**, buy a domain and set up a sending provider (e.g. Resend free tier as Supabase custom SMTP). The origin should then stay fixed, since changing it loses push subscriptions and installs. All domain-dependent values (app URL, invite link base, OAuth redirect, VAPID contact) come from config, never hard-coded. |
| Language | English now; more later. |
| Theme | Light only now; dark later. |

## 6. Architecture

```
┌──────────── Expo app (PWA now, iOS/Android later) ───────────┐
│ screens (expo-router) → hooks (TanStack Query) → api client  │
│ @klindom/ui components (RN primitives + KlinDom tokens)      │
│ auth adapter (Supabase Auth today)                           │
└───────────────┬──────────────────────────────────────────────┘
                │ HTTPS JSON, Bearer <access token>
┌───────────────▼──────────────┐      ┌──────────────────────────┐
│ api (Node, TS, Hono)         │      │ worker (same codebase)   │
│ verifies JWT via JWKS        │      │ sends due reminders      │
│ all business rules           │      │ (loop on Pi; HTTP-       │
│ /internal/run-reminders      │◄─────┤  triggered on Render)    │
└───────────────┬──────────────┘      └────────────┬─────────────┘
                │ SQL (pg)                         │
           ┌────▼─────────────────────────────────▼───┐
           │ Postgres (Supabase now → Pi → server)    │
           └──────────────────────────────────────────┘
```

### 6.1 Repository layout (monorepo, pnpm workspaces)

```
apps/
  app/          Expo app (expo-router), web export = PWA
  api/          Hono API + worker entrypoint, Dockerfile
packages/
  ui/           @klindom/ui: tokens + KlinDom components in React Native
  shared/       @klindom/shared: domain types, zod schemas, API client, date/recurrence helpers shared by api and app where needed
db/
  migrations/   plain SQL migrations (dbmate)
  seed/         dev seed data, suggestion catalog
docker-compose.yml
docs/superpowers/specs/
```

### 6.2 Front end

- **Expo SDK (latest stable), expo-router** with a bottom tab layout: Home, Rooms, Tasks, Profile.
- **Components only from React Native primitives** (`View`, `Text`, `Pressable`) and `react-native-svg` for rings and icons, so the same components run natively later. Animations use `react-native-reanimated`. Haptics use `expo-haptics`, which is a no-op on web.
- **`@klindom/ui`** ports the design system: `tokens.ts` (the colour, type, spacing, radius and shadow tokens from `tokens.json`, exact values), `Icon` (the 17 SVG paths from the design system bundle), and RN versions of `Button`, `ActionOrb`, `SegmentedControl`, `GoalCard`, `QuickAction`, `StatCard`, `ProgressArcs`, `TaskChip`, `InsightCard`, `TabBar`. It also adds new components: `Rings` (nested rings), `TaskRow` (with `TickRing`), `RoomCard`, `Avatar`, `ListGroup`/`ListRow`, `Sheet` (bottom sheet), `Celebration`.
- Shadows: use RN `boxShadow` where supported (RN 0.76+/new architecture and web), otherwise the closest `elevation`.
- **Font:** Geist via `expo-font` / `@expo-google-fonts/geist`.
- **Native feel on web:** standalone display, theme colour `#f2f2f2`, safe-area insets, no rubber-band on the shell, the tab bar floating above the home indicator, sheet-style modals, press-scale feedback (0.97) as in the design system, and no text selection on controls.
- **Data:** TanStack Query against the API client in `@klindom/shared`. Screens never call `fetch` or any SDK directly. Members' changes appear via **refetch on focus plus polling every 30 s** while the app is visible. Realtime push (SSE) may come later; Supabase realtime is not used.
- **Auth adapter:** a single module (`apps/app/src/auth/`) wraps Supabase Auth: sign-in with Google, email OTP, session refresh, and access-token retrieval. Nothing else imports `@supabase/*`.
- **i18n:** all strings via a small i18n helper (e.g. `i18next`) with an `en` catalog.

### 6.3 PWA specifics

- Web manifest (name "KlinDom", icons from the `sparkle` mark on `brand`, `display: standalone`).
- A **service worker** (Workbox, injected at build) that caches the app shell and static assets and handles `push` and `notificationclick` (open the task in the app).
- **iOS:** web push only works once the app is added to the Home Screen (iOS 16.4+). When reminders are enabled on iOS Safari outside standalone mode, show an "Add to Home Screen" explainer instead of the permission prompt.
- Static hosting: Cloudflare Pages or Netlify (builder's choice), with SPA fallback.

### 6.4 Back end

- **Node 22 LTS, TypeScript, Hono**, `pg` (node-postgres) with handwritten SQL (or a thin query builder like Kysely; builder's choice). No ORM that owns the schema: migrations are the source of truth.
- **Auth:** verify the `Authorization: Bearer` JWT against the provider's JWKS (`jose`). On first sight of a subject, upsert a `users` row (`auth_provider`, `auth_subject`, email, name, avatar). All IDs in our tables are our own UUIDs, never Supabase's. Swapping providers later means changing the verifier configuration plus a subject mapping.
- **Authorization:** every request is checked in the API: the caller must be a member of the home the resource belongs to, and owner-only actions are checked by role.
- **Validation:** zod schemas from `@klindom/shared`, shared with the client.
- **Worker:** the same image with a different entrypoint (`node dist/worker.js`) that runs "send due reminders" every minute. On Render's free tier, which sleeps, the same function is exposed as `POST /internal/run-reminders`, protected by a shared secret, and called every minute by an external cron pinger (e.g. cron-job.org). On the Pi it runs as the `worker` container.
- **Push:** Web Push with VAPID (`web-push`) behind a `Notifier` interface, so Expo/APNs/FCM push can be added for native apps later.
- **Docker:** `docker-compose.yml` with `postgres` (local dev and Pi), `api` and `worker`. Images build for `linux/amd64` and `linux/arm64` (Pi). Configuration via env vars only (`DATABASE_URL`, `AUTH_JWKS_URL`, `AUTH_ISSUER`, `VAPID_*`, `CRON_SECRET`, …).
- **Migrations:** dbmate (plain `.sql` up/down files), runnable from a container against any Postgres.

## 7. Domain model

### 7.1 Tables (Postgres)

- `users`: id, auth_provider, auth_subject (unique together), email, display_name, avatar_url, created_at.
- `homes`: id, name, timezone (IANA, set from the creator's device), owner_id, created_at.
- `home_members`: home_id, user_id, role (`owner` | `member`), joined_at, default_reminder_time (local time, default 08:00), notifications_enabled. One membership row per person per home.
- `invites`: id, home_id, code (short, human-typable, e.g. `K7Q-2MX`, unique), created_by, created_at, revoked_at. No expiry until revoked.
- `rooms`: id, home_id, name, icon (IconName), sort_order, archived_at.
- `tasks`: id, home_id, name, icon, notes, interval_count (int ≥ 1), interval_unit (`day` | `week` | `month`), due_time (local time, nullable), assignee_id (nullable → household), next_due_date (date, in home timezone), last_completed_at, created_by, created_at, archived_at.
- `task_rooms`: task_id, room_id. At least one room per task.
- `task_reminders`: id, task_id, offset_minutes (minutes **before** the due moment; 0 = at due time). Several per task allowed. A new task gets one default reminder (§7.4).
- `task_reminder_mutes`: task_id, user_id. Lets a member silence one household task.
- `completions`: id, task_id, home_id, user_id (who did it), kind (`done` | `skip`), completed_at (timestamptz), due_date (what it was due for), assignee_id_at_time, room_ids (snapshot array), interval_snapshot. **Append-only**; this is the stats and admin source of truth. An undo deletes the row within a short window (§7.3).
- `push_subscriptions`: id, user_id, endpoint (unique), p256dh, auth, user_agent, created_at, last_success_at.
- `reminder_log`: task_id, user_id, due_date, offset_minutes, sent_at. Unique on the first four, which dedupes sends.
- `awards`: id, home_id, user_id (nullable for household awards), kind, earned_at, meta jsonb.
- `daily_rings`: home_id, date (home-local), today_done, today_total, closed (bool), week_done, week_total, fresh_pct. The worker writes one row per home shortly after local midnight for the day that just ended. Past days are **frozen** from then on, and history, streaks and awards read from this table. History starts at launch (or at home creation).

### 7.1a Leaving and deleting (my call)

- **History is kept.** `completions`, `awards` and `daily_rings` are never deleted when a person leaves. The user reference stays, and the API renders a removed or deleted person as **"Former member"**. Deleting an account anonymises the `users` row (name → null, email → null, `auth_subject` → a random tombstone, `deleted_at` set) instead of hard-deleting it, so foreign keys stay valid.
- **Leaving:** any member can leave a home (`POST /homes/:id/leave`). Their assigned tasks revert to household, and their mutes, push subscriptions for that home and memberships are removed.
- **Owner:** the owner must transfer ownership (`POST /homes/:id/transfer`) before leaving or deleting their account while others remain. If the owner is the only member, leaving or deleting the account deletes the home.
- **Removing a member** (owner only) behaves like leaving.
- **Deleting a home** (owner only) hard-deletes the home and everything in it, after a typed confirmation.

### 7.2 Recurrence

- A new task is first due on a user-chosen **start date** (default today).
- **Done:** `next_due_date = local_date(completed_at) + interval`. Months use calendar arithmetic, clamped to the month end (31 Jan + 1 month = 28/29 Feb).
- **Skip:** writes a `skip` completion and sets `next_due_date = local_date(now) + interval`. A skip doesn't fill rings and doesn't break the streak.
- **Changing the interval** recomputes `next_due_date` from `last_completed_at` (or from the start date if never done).
- **Completing early** (e.g. Tasks tab, "This week" section) is allowed and follows the same rule.
- Overdue = `next_due_date < today` (home timezone). An overdue task stays on Today until done or skipped.
- The **due moment** for reminders is `next_due_date` at `due_time`, or at the member's `default_reminder_time` if the task has no time.

### 7.3 Completing a task

- `POST /tasks/:id/complete` → inserts a completion, advances the task, returns the updated task plus fresh ring numbers so the UI can animate without a second request.
- **Undo** is available for 10 s (toast) and later from the task's history, by the person who did it or the owner. It deletes the completion and restores the previous `next_due_date` and `last_completed_at` (stored on the completion row for this purpose).
- Two members ticking the same task at once: the second request for the same `due_date` returns the existing completion (idempotent on task_id + due_date + kind `done`).

### 7.4 Reminders

- The worker, every minute, finds `(task, recipient, offset)` where `due_moment − offset ≤ now`, the task is not done for that due date, and there is no `reminder_log` row. It then sends and logs.
- **Recipients:** an assigned task goes to the assignee only. A household task goes to every member with notifications enabled who hasn't muted that task.
- **Per-task config:** the task editor's "Remind" field offers presets: At due time, 1 hour before, 3 hours before, The evening before (18:00 the day before), 1 day before, Custom. Several can be added. Default for new tasks: **at due time**, which for untimed tasks means the member's morning hour.
- Copy follows the README voice: "Dishes is due today · Kitchen", "Clean windows is due tomorrow". No guilt language.
- No repeat nagging for overdue tasks in this version.

### 7.5 Rings, streaks, awards

All computed **server-side** (`GET /homes/:id/dashboard`) in the home's timezone and returned as numbers. The client only draws.

- **Today** (`brand`): denominator = tasks with `next_due_date ≤ today` at the start of today, plus tasks completed today whose due date was ≤ today. Numerator = those completed (`done`) today. Skips leave the denominator. With nothing due, the ring is shown closed with "Nothing due today".
- **This week** (`ink`), Monday-first: denominator = every occurrence due Mon–Sun of the current week, projected as if each were done on time (a daily task counts 7, a weekly task 1), plus overdue tasks carried in on Monday. Numerator = `done` completions this week counted against those occurrences, capped at the denominator.
- **Home fresh** (mid-grey ring): share of active tasks not overdue right now.
- The **Mine** filter recomputes Today and This week over tasks assigned to me plus household tasks.
- Past days come from `daily_rings` snapshots (§7.1), never recomputed. Today and the current week are computed live.
- **Streak:** a household streak, the number of consecutive days the Today ring closed by the end of the day. Days with nothing due keep the streak going but don't add to it. Shown under the greeting ("6-day streak").
- **History:** a month calendar of small Today rings, one per day, in Profile → Awards & history.
- **Awards (starter set):** First task done; First full week (all of This week closed); 7-day streak; 30-day streak; Every room fresh (Home fresh hits 100%); 100 tasks done (per person). New awards trigger a celebration on the next app open.

### 7.6 Stats

`GET /homes/:id/stats?range=week|month|custom` computed from `completions`:
- tasks done per member
- per room
- on-time vs late (completed_at local date vs due_date)
- assigned-to-X-but-done-by-Y counts
- activity over time

Profile shows "Who did what" (per member, week/month). The data supports a future admin dashboard without schema changes.

## 8. Screens

The visual reference for all screens is the brainstorm mockup (`.superpowers/brainstorm/…/content/screens.html`, kept locally). Layout and tokens follow the design-system README (greeting in `display`, centred; cards `surface-raised` + `shadow-card`; wells `surface-sunken` + `shadow-inset`; `brand` only for the next action, active nav and the first ring; text on orange in `on-brand`).

### 8.1 Home (tab 1): "Rings hero"
- Greeting (`display`, centred; copy varies by state: "Fresh start today!", "Nice, the kitchen's done", "All done for today"), with the date and streak underneath.
- **Rings card:** three nested full rings (Today `brand`, This week `ink`, Home fresh mid-grey) plus a legend with `stat` values. Rings animate on change. When a ring closes it **loops past full** with a short sparkle burst (`Celebration`, using the `sparkle` glyph) and a success haptic.
- **All / Mine** switch (SegmentedControl) above the list (builder may place it in the header).
- **"Due Today"**: overdue first, then today's tasks. Each `TaskRow` has an icon, name, rooms caption (or "Due 5 days ago · Bedroom" in `brand-strong`), an assignee avatar if assigned, and a **TickRing** on the right. Done items stay in the list, struck through, with "Done by Ana · 9:40", until midnight.
- Tapping the TickRing completes the task: the ring fills, a light haptic plays, the row settles as done, the big rings update, and an Undo toast appears. A long press or swipe offers **Skip**. Tapping the row body opens Task detail.

### 8.2 Rooms (tab 2)
- Title "Rooms" with "5 rooms · 3 fresh". A 2-up grid of `RoomCard`s: room icon, name, a freshness ring (share of the room's tasks not overdue) and a status line ("2 due today", "1 overdue", "All fresh", "Next: Sun"). The last tile is "+ Add a room".
- **Room detail:** the room's tasks (including multi-room tasks), its ring and recent completions. Edit name and icon, reorder, archive.
- The tab icon needs a new glyph (no room icon exists; the mockup borrows `sponge`). **Builder:** pick an existing glyph for now and flag a new "door"/"room" icon for the design system.

### 8.3 Tasks (tab 3)
- Title "Tasks" with an orb "+" (new task). A SegmentedControl: **All / Mine / By room**.
- Grouped: Overdue, Today, This week, Later. Each row shows its frequency ("every 4 weeks"). The TickRing works here too, including completing early.
- **Task editor** (sheet): name, icon (from the icon set), rooms (multi-select, ≥1), frequency (every N days/weeks/months), start date, optional due time, assignee (Household or a member), reminders (§7.4), notes. Archive and delete are under a "More" menu.
- **Task detail:** next due, frequency, assignee, rooms, reminders, and a history of completions (who, when, on time or late).

### 8.4 Profile (tab 4)
- Avatar, name, home name, role.
- **Who did what** card (week/month): per-member counts with a small bar chart.
- **Home:** Members (owner can remove), Invite someone (share link and code via the native share sheet / Web Share API), Awards & history, Home settings (name; owner can delete the home).
- **You:** Notifications (on/off, default morning time, enable push on this device), Account (name, sign out, delete account).

### 8.5 Onboarding
1. **Welcome** screen with the `sparkle` orb and halo → "Continue with Google" / "Continue with email". Email = enter address → enter **6-digit code** (OTP, not a magic link; magic links on iOS open in Safari instead of the installed PWA).
2. **Create or join.** Join: paste or enter a code; opening an invite link `…/join/K7Q-2MX` lands on "Join <Home name>?".
3. **Create:** home name → **Start with suggestions** (tick rooms with counts, e.g. Bedroom ×2 → review proposed tasks per room with frequencies; untick or adjust; multi-room tasks like Vacuum pre-linked to all floor rooms) or **Start from scratch** (empty state with "Add a room").
4. **Invite people** (skippable).
5. **Reminders** explainer → permission prompt (or the iOS "Add to Home Screen" explainer).

The suggestion catalog lives in `db/seed/suggestions` as data (rooms → default tasks with icon and interval), so it can be edited without code changes. The builder writes the initial catalog for Kitchen, Bathroom, Bedroom, Living room, Hallway, Balcony, Office and Laundry room, using the README's names (Vacuum, Laundry, Dishes, Windows, Surfaces…).

## 9. API surface (initial)

```
POST   /me/bootstrap                       upsert user from token, return memberships
GET    /homes/:id/dashboard?scope=all|mine rings, streak, due-today list
GET    /homes/:id/stats?range=…
POST   /homes                              create (optionally with suggestion picks)
PATCH  /homes/:id · DELETE /homes/:id      owner only
POST   /homes/:id/leave · /homes/:id/transfer
GET    /homes/:id/members · DELETE /homes/:id/members/:userId
POST   /homes/:id/invites · DELETE /invites/:id
GET    /invites/:code                      preview (home name, inviter)
POST   /invites/:code/accept
CRUD   /homes/:id/rooms, /rooms/:id
CRUD   /homes/:id/tasks, /tasks/:id        (incl. rooms, reminders, mute)
POST   /tasks/:id/complete · /tasks/:id/skip · DELETE /completions/:id (undo)
GET    /tasks/:id/history
GET    /suggestions
POST   /push/subscriptions · DELETE /push/subscriptions/:id
POST   /internal/run-reminders             CRON_SECRET only
GET    /healthz
```

## 10. Testing

- **API:** unit tests (vitest) for recurrence, ring math, streaks, awards and reminder selection, which is where the bugs will be. Run them against fixed clocks and several timezones, including DST changes. Integration tests run against Postgres in Docker (migrations applied fresh).
- **UI package:** component tests with React Native Testing Library for interaction-heavy pieces (TickRing, Rings, TaskRow).
- **App:** a smoke E2E on the web build (Playwright): sign in with a test auth path in dev → create home with suggestions → tick a task → ring updates.

## 11. Left to the builder

- Exact library picks where marked (Kysely vs raw SQL, Cloudflare Pages vs Netlify, i18n library).
- Animation timing and celebration choreography, within the README's calm tone.
- Exact suggestion catalog contents and default intervals.
- Desktop/tablet: centred single column (max ~480 px) on the `canvas` backdrop.
- Error, empty and loading states, written in the README's voice.
- How the dev environment signs in without real Google (e.g. a dev-only token issuer behind an env flag, never enabled in production).

## 12. Calls I made (not explicitly decided by the owner)

- Email sign-in is a 6-digit OTP rather than a magic link or password.
- The third ring is "Home fresh" (share of tasks not overdue), in mid-grey; streaks are household-wide.
- Skip exists, and doesn't count or break streaks.
- Optional due time per task; untimed tasks remind at a per-member morning hour (default 08:00).
- Invites never expire until revoked; any member can invite; the owner can remove members and delete the home.
- Sync between members is by refetch-on-focus plus 30 s polling, not realtime.
- Undo window 10 s on the toast; done tasks stay visible on Home until midnight.
- The default reminder for new tasks is "at due time"; overdue tasks don't send repeat reminders.
- English strings via i18n from day one; Geist font as in the design system.
- Past rings are frozen nightly snapshots (`daily_rings`); history starts at launch.
- Leaving and deleting keep history under "Former member"; the owner must transfer ownership first (§7.1a).
- The design system's tokens, icon paths and component styles are copied into `packages/ui` at scaffold time, so the build doesn't depend on access to the claude.ai artifact.
