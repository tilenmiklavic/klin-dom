# Plan 3 follow-ups

Deferred findings from the Plan 3 task and final reviews (2026-11-01). None blocks merge. The final review triaged them; the ones it said to fix were fixed in the final fix wave.

## Parked rulings

- Ruling: delete-account unsubscribes before DELETE /me (device stays off if delete fails) — acceptable, rare — cost if wrong: user re-enables reminders.
- Ruling: 3 s sign-out unsubscribe cap may let a late unsubscribe call go out tokenless — harmless 401 — cost if wrong: noise in logs.
- Ruling: native onboarding shows "This browser can't show notifications" — PWA is the only target now — cost if wrong: copy tweak when native ships.

## Deferred minors

- [Task 1] subagent commits carry their own model in Co-Authored-By (Sonnet 5.5) — accurate attribution, left as is.
- [Task 2] members.ts row! after requireMember race; empty PATCH {} accepted; import order cosmetic.
- [Task 3] push endpoint accepts any URL incl. http/internal hosts (SSRF-ish when Task 5 sends) — final review should weigh https-only; TTL 12h not a named constant; fallback notifier logs full endpoint URL.
- [Task 4] duplicate offsets → duplicate DueReminders (absorbed by reminder_log claim); exact grace boundaries untested; long nested ternary in reminderCopy; overdue→"today" untested.
- [Task 5] window/offset coupling undocumented next to SQL; "5-day overdue" test passes via date window not grace path; no-VAPID → reminders claimed then lost (worker warns, cron route doesn't); sequential sends under lock with no per-send timeout.
- [Task 6] snapshot uses run-time next_due_date (doc comment overclaims); extra existence query per home; loadStreak DB path lightly tested.
- [Task 7] all_fresh is earned trivially by a brand-new home with zero completions (spec-literal; final review to triage — likely gate on ≥1 completion); runAwards lacks per-home try/catch (one failing home aborts the pass and the cron summary); history loads full rings for today only; import order nits; no first_full_week API test; no late-joiner test.
- [Task 8] notificationclick lacks same-origin guard; navigate() on uncontrolled client may reject; push handler throws on non-JSON payload; build-sw relies on minify for NODE_ENV define; workbox runtime pkgs could be devDeps.
- [Task 9] onboarding "Turn on reminders" visible when denied/unsupported; enable/disable rows lack busy guard; unsubscribe-ok + DELETE network failure leaves stale id (self-heals).
- [Task 9] null key after prompt → 'unsupported' with permission granted; re-POST network failure shows 'off'.
- [Task 10] markSeen doesn't invalidate dashboard cache (remount could re-celebrate cached newAwards); calendar hides while neighbour month loads; mark-seen failure untested.
- [Task 10] UTC fallback flicker before home loads; awards test's getByText after findByText may be flaky.
- [Task 11] runbook lacks session-pooler warning for advisory lock, Pages project-create command, cron curl pre-check; supabase ref/Render URL hard-coded in docs/example; createDb exposes pool for tests; DatabaseSsl type duplicates zod enum.
- [Final] DNS names resolving to private IPs pass the endpoint check; web-push timeout is inactivity-based and no per-user subscription cap; AuthGate sign-out chip unsubscribe untested.
