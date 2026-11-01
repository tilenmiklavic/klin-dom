# Plan 3 follow-ups

Deferred findings from the Plan 3 task and final reviews (2026-11-01). None blocks merge. Items the final review said to fix (service worker deep links, push send timeout + https-only endpoints, all_fresh gate, sign-out unsubscribe, per-home job isolation, notification screen states, pooler/VAPID runbook notes) were fixed and are not listed.

## Parked rulings

- Ruling: delete-account unsubscribes before DELETE /me (device stays off if delete fails) — acceptable, rare — cost if wrong: user re-enables reminders.
- Ruling: 3 s sign-out unsubscribe cap may let a late unsubscribe call go out tokenless — harmless 401 — cost if wrong: noise in logs.
- Ruling: native onboarding shows "This browser can't show notifications" — PWA is the only target now — cost if wrong: copy tweak when native ships.

## Deferred minors

- [Task 1] subagent commits carry their own model in Co-Authored-By (Sonnet 5.5) — accurate attribution, left as is.
- [Task 2] members.ts row! after requireMember race; empty PATCH {} accepted; import order cosmetic.
- [Task 3] TTL 12h not a named constant; fallback notifier logs full endpoint URL.
- [Task 4] duplicate offsets → duplicate DueReminders (absorbed by reminder_log claim); exact grace boundaries untested; long nested ternary in reminderCopy; overdue→"today" untested.
- [Task 5] window/offset coupling undocumented next to SQL; "5-day overdue" test passes via date window not grace path; no-VAPID → reminders claimed then lost (worker warns, cron route doesn't); sends run sequentially under the lock (now with a 10 s per-send timeout).
- [Task 6] snapshot uses run-time next_due_date (doc comment overclaims); extra existence query per home; loadStreak DB path lightly tested.
- [Task 7] history loads full rings for today only; import order nits; no first_full_week API test; no late-joiner test.
- [Task 8] notificationclick lacks same-origin guard; push handler throws on non-JSON payload; build-sw relies on minify for NODE_ENV define; workbox runtime pkgs could be devDeps.
- [Task 9] enable/disable rows lack busy guard; unsubscribe-ok + DELETE network failure leaves stale id (self-heals).
- [Task 9] null key after prompt → 'unsupported' with permission granted; re-POST network failure shows 'off'.
- [Task 10] markSeen doesn't invalidate dashboard cache (remount could re-celebrate cached newAwards); calendar hides while neighbour month loads; mark-seen failure untested.
- [Task 10] UTC fallback flicker before home loads; awards test's getByText after findByText may be flaky.
- [Task 11] runbook lacks Pages project-create command and cron curl pre-check; supabase ref/Render URL hard-coded in docs/example; createDb exposes pool for tests; DatabaseSsl type duplicates zod enum.
- [Final] DNS names resolving to private IPs pass the endpoint check; web-push timeout is inactivity-based and no per-user subscription cap; AuthGate sign-out chip unsubscribe untested.
