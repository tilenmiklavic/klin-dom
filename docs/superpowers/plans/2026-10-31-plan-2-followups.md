# Plan 2 follow-ups

Deferred findings from the Plan 2 task and final reviews (2026-10-31). None blocks merge; triage when starting Plan 3.

## Parked

- undo `alreadyDone` guard treats "completion not in any cached dashboard" as "already undone", so an Undo pressed from Tasks/Rooms for a task not in the dashboard, before the post-tick refetch, silently does nothing — Ruling: real but narrow (needs a slow API and an off-dashboard task); fix later with a tombstone set of undone completion ids — cost if wrong: a rare silent no-op Undo

## Deferred minors

- [Task 1] unmet react peer warnings (react-server-dom-webpack/react-dom want react > 19.2.3 of SDK 57) — tests unaffected
- [Task 1] token tests cover only display type style, one space key and a few colors — add table-driven test over all variants/shadows
- [Task 1] fontWeight kept alongside static Geist fontFamily may trigger synthetic/fallback font on Android
- [Task 2] SegmentedControl inactive label uses body style (15px/22) instead of 14px like the active button style — design bundle uses 14px for both
- [Task 2] Button chip weight 500 via fontWeight on a static Geist family may not render 500 on Android — use Geist_500Medium family
- [Task 2] no tests for halo geometry, tab/segment sizes, press scales, chip weight; haptics on Button/ActionOrb press untested
- [Task 3] empty ring draws a round-cap dot at 12 o'clock (same as design-system Ring) — consider hiding arc at 0
- [Task 3] NaN values/totals not guarded in Ring/Rings; many rings/large stroke can give negative radius
- [Task 3] rings + legend both announced to screen readers (double announcement)
- [Task 3] tests don't cover progress>1, negatives, disabled TickRing
- [Task 4] StatCard bars not clamped for negatives; chart ring/bars untested
- [Task 4] ChoiceChips 36px height without min touch target; hard-coded heights 36/52/56 in ChoiceChips/ListGroup/TextField
- [Task 4] TextField error text not linked to input for a11y
- [Task 4] InsightCard uses brand as card background (design-system parity) — outside the constraint's brand list; triage at final review
- [Task 4] parity components ProgressArcs/GoalCard only lightly tested
- [Task 4] TaskRow row touch target excludes card padding (padding on container, not the Pressable)
- [Task 4] prettier warnings in TaskRow.tsx and content.test.tsx (no repo prettier config)
- [Task 5] Celebration haptics promise has no .catch (possible unhandled rejection)
- [Task 5] Celebration assigns onDone ref during render
- [Task 5] eveningBeforeOffset NaN on malformed time; formatInterval with count<=0
- [Task 5] Toast redundant fontFamily with button variant
- [Task 5] Sheet lacks KeyboardAvoidingView; a Toast shown while a Modal Sheet is open is hidden beneath it — Task 9/10 should close the sheet before showing toasts
- [Task 5] toast unmount test restores spies outside finally; new tests had no RED run (implementation already correct)
- [Task 6] client throws raw SyntaxError for a 2xx non-JSON non-204 body
- [Task 6] client path ids not encodeURIComponent'd (codes are)
- [Task 6] me.test uses repeated dynamic imports of helpers; no client tests for deleteHome body / PUT mute
- [Task 6] DELETE /me also revokes the user's invites (extra, sensible)
- [Task 6] invite accept returns 500 (FK 23503) when the home is deleted mid-request — map to 404; the race test logs an error: line (test output not pristine)
- [Task 7] pending invite code only cleared by Task 8 join screen — Task 8 must clear it
- [Task 7] auth test mock uses any; getPathname read off un-awaited promise
- [Task 7] local state cleared even when Supabase server sign-out fails (acceptable)
- [Task 7] native Google OAuth not implemented (web redirect only; native is out of scope for the PWA)
- [Task 7] covered screens stay mounted (display:none) and may run queries while covered; blank cover without spinner during bootstrap; error block lacks accessibilityRole alert; possible brief error flash during 401 refresh
- [Task 8] JoinPreview re-enables "Join home" while async onSuccess awaits clear/refresh — second tap fires another accept
- [Task 8] useCurrentHome treats a stale id as valid when homes is empty; hydrate can resurrect a value right after clear()
- [Task 8] review has no error/retry when suggestions fail; a web refresh on /review loses the draft and would create an empty home — redirect to /rooms when draft is empty
- [Task 8] invite screen without homeId param disables Share with no explanation; Android share branch untested; no gate-level test for the /invite exemption
- [Task 9] useTickOp catch also wraps settle/ring patch — a throw there reverts after a successful server call
- [Task 9] concurrent refetch/overlapping ticks can briefly overwrite another task's optimistic state (flicker)
- [Task 9] undo toast after the row was already undone sends a second DELETE + error toast; complete/skip use separate in-flight sets
- [Task 9] useHome failure → overdue captions fall back to rooms and "Done by Ana · " has an empty time; formatClock "0:05"
- [Task 9] formatDue/formatLongDate/formatClock English-only (en-GB), outside i18n — fine while English-only, revisit with localisation
- [Task 9] celebration also fires on week-ring close while the copy says "All done for today"
- [Task 9] useDashboard placeholderData keeps All data under the Mine label while Mine is pending (indefinitely offline); ticks during placeholder show no optimistic feedback
- [Task 9] undo optimistic patch/revert not guarded per cache (bumps mine caches that don't list the task)
- [Task 10] grouping.ts uses known.add inside filter; groupByRoom returns raw title vs groupByDue translated by caller; View_ type name
- [Task 10] set() clears all field errors on any keystroke; archive removeQueries may briefly unmount the editor form before dismissTo
- [Task 10] add orb uses sparkle icon for "+" (no plus glyph in the design system); date/time are text fields (no picker in the kit); grouping.test written after grouping.ts (no RED)
- [Task 10] a task loaded with >5 offsets isn't trimmed on save; due-time edit clears all field errors; one test name misleading ("moves the due time")
- [Task 11] status.ts weekday abbreviations are English, outside i18n
- [Task 11] ReorderList Cancel reuses common.close and stays enabled while saving; grid row/filler layout uses key={i} and magic minHeight 108
- [Task 11] roomStatus computed twice in [id].tsx; save with no changes toasts "Room saved"; brief "Couldn't find this room" flash after archive
- [Task 11] reorder 400/409 toast branch untested; archive success navigation untested
- [Task 12] "Invite someone" has no pending guard (double-tap creates two invites); revoke invite has no confirmation
- [Task 12] raw API 400 message on delete home isn't localised; delete-home success and 400 paths untested; no test for Former member row or redirect to onboarding after leaving last home
- [Task 12] invite code only visible in Members list, not at share time; small JSX/test-format nits
- [Task 13] e2e global setup recreates the api container in dev-auth mode if a developer runs the real-auth stack (README note); 320px check reads scrollWidth once without waiting; name selector could match elsewhere
- [Final] profile invite sheet may reuse a stale cached invite; copyLink rejection unhandled; in-flight GETs not aborted during account deletion; successful undo pushes restored task into mine caches until refetch
