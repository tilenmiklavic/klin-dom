# KlinDom Plan 2 — UI Kit & Expo App

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A web-exportable Expo app (`apps/app`) built from a React Native KlinDom component kit (`packages/ui`). It covers sign-in (Google, email code, dev token), onboarding (create from suggestions or scratch, or join), and the Home, Rooms, Tasks and Profile tabs, all wired to the Plan 1 API.

**Architecture:** `packages/ui` holds design tokens and presentational components built only from React Native primitives + `react-native-svg` + `react-native-reanimated`, so the same code runs on iOS/Android later. `packages/shared` gains a typed API client. `apps/app` (expo-router) holds screens, TanStack Query hooks and a single auth adapter; it never calls `fetch` or Supabase outside those two seams.

**Tech Stack:** Expo SDK (latest stable at execution — pin exact versions in `package.json` once installed), expo-router, React Native Web, react-native-svg, react-native-reanimated, react-native-safe-area-context, expo-haptics, expo-font + `@expo-google-fonts/geist`, `@tanstack/react-query` v5, `@supabase/supabase-js` v2 (auth only), i18next + react-i18next, jest-expo + `@testing-library/react-native`, Playwright (web smoke).

**Spec:** `docs/superpowers/specs/2026-10-31-klindom-pwa-design.md` (sections 6.2, 8, 8.5 especially). **Builds on:** Plan 1 (`feat/backend-core`, PR #1); API contracts are the DTOs in `packages/shared/src/schemas.ts`.

Not in this plan (Plan 3): service worker, web manifest/installability, push permission + subscriptions, reminder worker, member default reminder time, streaks/awards/history, `daily_rings`, deployment.

## Global Constraints

- **No `@supabase/*` import outside `apps/app/src/auth/`.** Screens and hooks get the token through `useAuth()` only.
- **No `fetch` outside `packages/shared/src/client.ts`.** Screens use hooks in `apps/app/src/data/`.
- **`packages/ui` uses only** `react-native` primitives (`View`, `Text`, `Pressable`, `TextInput`, `ScrollView`, `Modal`), `react-native-svg`, `react-native-reanimated`, `expo-haptics`. No DOM, no CSS files, no `div`.
- **Tokens are exact copies** of the design system `tokens.json` (colors, type styles, spacing, radius, shadows). Components never hard-code a hex, size or radius that a token covers.
- Light theme only; every color comes from `tokens.color` so dark mode can be added by swapping the object.
- `brand` only on: the Action Orb, primary buttons, the Today ring, the active tab icon, done tick rings. Text and icons on `brand` use `onBrand`, never white. Small orange text uses `brandStrong`.
- **All user-visible strings through i18n** (`t('key')`), `en` catalog in `apps/app/src/i18n/en.json`. Copy follows the README voice: sentence-case buttons (verb + object), Title Case section titles, no emoji, no guilt ("Due 5 days ago", never "Overdue!").
- Font: Geist, weights 400/450/500/600 per README type styles.
- Ticking a task **always** sends `{ dueDate: task.nextDueDate }` (Plan 1 ruling: dedupe depends on it).
- Dates from the API (`IsoDate`) are rendered as calendar dates **without** converting through the device timezone (use the shared helpers / string math, never `new Date('2026-10-31')`).
- Layout works from 320 px wide; on wider screens content is a centred column, max 480 px, on `canvas`.

## Review Focus

1. **Narrow screens and long names** — a 320 px viewport with a room called "Kids' bedroom upstairs" and a task "Clean windows and window sills" must truncate with ellipsis, never overflow or push the tick ring off-screen. Test in Task 4 (`TaskRow`) and Task 4 (`RoomCard`).
2. **API errors and offline** — a failed fetch shows a calm inline error with "Try again", not a blank screen or crash; a failed tick reverts the optimistic update and shows a toast. Test in Task 9.
3. **Double-tap on the tick ring** — two taps in quick succession send at most one request while the first is in flight. Test in Task 9.
4. **Expired session** — a 401 from the API triggers one silent token refresh, then sign-out to Welcome if that fails. Test in Task 6.
5. **Calendar dates vs device timezone** — a device in `America/Los_Angeles` showing a home in `Europe/Ljubljana` renders `nextDueDate: '2026-10-31'` as Saturday 31 Oct, not Friday 30. Test in Task 5 (`formatDue`).

---

## File Structure

```
.npmrc                                   node-linker=hoisted (Expo + pnpm)
packages/ui/
  package.json, tsconfig.json, jest.config.js, babel.config.js
  src/index.ts
  src/tokens.ts                          exact design tokens + type styles
  src/Text.tsx                           KText (variant = type style)
  src/Icon.tsx, src/icons.ts             17 glyph paths from the design-system bundle
  src/Button.tsx, ActionOrb.tsx, SegmentedControl.tsx, TabBar.tsx
  src/Ring.tsx, Rings.tsx, TickRing.tsx
  src/TaskRow.tsx, RoomCard.tsx, Avatar.tsx, StatCard.tsx, MemberBars.tsx
  src/GoalCard.tsx, QuickAction.tsx, ProgressArcs.tsx, TaskChip.tsx, InsightCard.tsx   (design-system parity)
  src/ListGroup.tsx, Sheet.tsx, Toast.tsx, Celebration.tsx, EmptyState.tsx, TextField.tsx, ChoiceChips.tsx, Screen.tsx
  test/*.test.tsx
packages/shared/
  src/client.ts                          createApiClient
  src/format.ts                          formatDue, formatInterval, reminderPresets
  test/client.test.ts, test/format.test.ts
apps/api/src/routes/dev.ts               POST /dev/token (dev auth only)
apps/api/src/routes/me.ts                + PATCH /me, DELETE /me
apps/app/
  app.json, package.json, tsconfig.json, babel.config.js, jest.config.js
  app/_layout.tsx                        providers + auth gate
  app/(auth)/welcome.tsx, email.tsx, code.tsx
  app/(onboarding)/start.tsx, join.tsx, create.tsx, rooms.tsx, review.tsx, invite.tsx
  app/join/[code].tsx                    invite deep link
  app/(tabs)/_layout.tsx                 TabBar
  app/(tabs)/index.tsx                   Home
  app/(tabs)/rooms/index.tsx, rooms/[id].tsx
  app/(tabs)/tasks/index.tsx, tasks/[id].tsx
  app/(tabs)/profile/index.tsx, profile/members.tsx, profile/home.tsx, profile/account.tsx
  app/task-editor.tsx, app/room-editor.tsx   (modal routes)
  src/auth/{AuthProvider.tsx, supabase.ts, devAuth.ts}
  src/data/{api.ts, queryClient.ts, homes.ts, tasks.ts, rooms.ts, dashboard.ts, stats.ts, invites.ts}
  src/i18n/{index.ts, en.json}
  src/state/currentHome.ts
  test/*.test.tsx
  e2e/smoke.spec.ts, playwright.config.ts
```

---

### Task 1: UI package tooling and tokens

**Files:**
- Create: `.npmrc`, `packages/ui/{package.json,tsconfig.json,jest.config.js,babel.config.js,src/index.ts,src/tokens.ts,src/Text.tsx}`
- Test: `packages/ui/test/tokens.test.ts`, `packages/ui/test/Text.test.tsx`

**Interfaces:**
- Produces `tokens` (const object):
  - `tokens.color`: `canvas surface surfaceRaised surfaceSunken track ink inkMuted inkSubtle brand brandStrong brandSoft brandHalo onBrand night nightRaised onNight onNightMuted` with the exact hex values from `tokens.json` (`#e4e4e4 #f2f2f2 #ffffff #e6e6e6 #d9d9d9 #141414 #5c5c5c #737373 #e2643f #b84424 #ef8a6c #f6c9b9 #2a0e06 #3d3d3d #575757 #ffffff #d0d0d0`), plus `ringFresh: '#8a8a8a'` (third ring; flagged as a proposed design-system addition).
  - `tokens.space`: `{1:4, 2:8, 3:12, 4:16, 5:20, 6:24, 8:32, 12:48}`; `tokens.radius`: `{sm:14, md:22, lg:28, xl:40, pill:999}`.
  - `tokens.shadow.card|float|glow|inset` as RN `boxShadow` strings copied from `tokens.json`.
  - `tokens.type`: `displayXl display statLg stat title heading body button label caption` → `{ fontFamily, fontSize, lineHeight, fontWeight, letterSpacing? }` with exact sizes from `tokens.json`; `letterSpacing` converted from em to px (`em × fontSize`, e.g. display −0.025em × 40 = −1).
  - `fontFamily` per weight: `Geist_400Regular`, `Geist_500Medium`, `Geist_600SemiBold`; 450 maps to `Geist_400Regular` (static fonts have no 450).
- Produces `KText` (`variant: keyof tokens.type`, `color?: keyof tokens.color`, `numberOfLines?`, plus RN `TextProps`), default color `ink`.
- Workspace: `packages/ui` name `@klindom/ui`; root `.npmrc` `node-linker=hoisted`; jest preset `jest-expo`.

- [ ] **Step 1: Write failing tests**: `tokens.color.brand === '#e2643f'`, `tokens.color.onBrand === '#2a0e06'`, `tokens.type.display` equals `{ fontSize: 40, lineHeight: 40, letterSpacing: -1, … }`, `tokens.radius.pill === 999`; `KText variant="title"` renders with `fontSize 24` and color `#141414`; `color="brandStrong"` gives `#b84424`.
- [ ] **Step 2: Run** `pnpm -F @klindom/ui test` — Expected: FAIL (module not found).
- [ ] **Step 3: Implement** tokens, KText, jest/babel config. Re-run `pnpm install` from root with hoisted linker; confirm `pnpm test` at root still passes for api/shared.
- [ ] **Step 4: Run** `pnpm test` (root) — Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "feat(ui): design tokens and text styles"`

---

### Task 2: Icon and core controls

**Files:**
- Create: `packages/ui/src/{icons.ts,Icon.tsx,Button.tsx,ActionOrb.tsx,SegmentedControl.tsx,TabBar.tsx}`
- Test: `packages/ui/test/controls.test.tsx`

**Interfaces:**
- `icons: Record<IconName, string>` — the 17 SVG inner-markup path strings copied verbatim from the design-system `bundle.js` `ICONS` map (source: `https://claude.ai/artifact/2AgT7Fwo2AZnK6EuyoQPYg`, `project/components/bundle.js`), converted to `{ d: string; fillRule?: 'evenodd' }[]` per icon. `IconName` re-exported from `@klindom/shared`.
- `Icon({ name, size = 20, color = 'ink', title? })` → `Svg viewBox="0 0 24 24"`; `accessibilityLabel = title`, hidden from a11y when no title.
- `Button({ variant: 'primary'|'secondary'|'soft'|'chip' = 'primary', size: 'md'|'sm' = 'md', icon?, label, onPress, disabled?, loading? })` — heights 48/36, pill radius, press scale 0.97 (Reanimated), `primary` = `brand` bg + `onBrand` label + glow shadow; `loading` shows label at 0.6 opacity and ignores presses.
- `ActionOrb({ size: 'sm'|'md'|'lg' = 'md', icon = 'sparkle', label, onPress, halo? })` — 40/56/72 px; halo = two `brandHalo` rings.
- `SegmentedControl({ options: { value: string; label: string }[], value, onChange })` — sunken track, active item raised white.
- `TabBar({ items: { id: string; label: string; icon: IconName }[], active, onChange })` — `night` pill; active item expands to white pill with `brand` icon + `ink` label; `accessibilityRole="tab"`, `accessibilityState={{ selected }}`.

- [ ] **Step 1: Write failing tests**: `Icon` renders a `Path` with the `home` `d` value from the bundle; `Button` calls `onPress` once on press, not when `disabled` or `loading`; `SegmentedControl` calls `onChange('mine')` when "Mine" pressed and marks the active option selected; `TabBar` shows only the active item's label and calls `onChange('rooms')`.
- [ ] **Step 2: Run** `pnpm -F @klindom/ui test controls` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** `git commit -m "feat(ui): icon, button, orb, segmented control, tab bar"`

---

### Task 3: Rings and tick ring

**Files:**
- Create: `packages/ui/src/{Ring.tsx,Rings.tsx,TickRing.tsx}`
- Test: `packages/ui/test/rings.test.tsx`

**Interfaces:**
- `Ring({ progress: number, size, stroke, color: keyof tokens.color })` — track in `track`, arc from 12 o'clock clockwise, round caps; `progress` clamped 0..1 for drawing.
- `Rings({ rings: { key: string; label: string; value: number; total: number; unit?: string; color: keyof tokens.color }[]; size = 150; stroke = 16; onRingClosed?: (key: string) => void })` — nested rings (outer→inner in array order, radii `size/2 − stroke/2 − i·(stroke+3)`), legend to the right with `stat` value `"4"` + muted `"/9"` (or `"86%"` when `unit === '%'`). A ring with `total === 0` draws **closed**. Progress animates (Reanimated, 600 ms ease-out). `onRingClosed(key)` fires once when a ring's progress crosses from <1 to ≥1 between renders (not on first mount).
- `TickRing({ done: boolean, onPress, disabled?, accessibilityLabel })` — 30 px; empty = `track` ring; done = `brand` ring + `ink` check; 44×44 hit slop; light haptic (`expo-haptics` `impactAsync(Light)`) on press.

- [ ] **Step 1: Write failing tests**: legend renders `"4"` and `"/9"` for `{value:4,total:9}` and `"86%"` for percent; ring with `total: 0` reports `accessibilityValue={{ now: 1, max: 1 }}`; `onRingClosed` fires once when rerendered from 8/9 to 9/9, not when first rendered at 9/9; `TickRing` calls `onPress`, exposes `accessibilityState={{ checked: done }}`, and calls the mocked `Haptics.impactAsync`.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5: Commit** `git commit -m "feat(ui): nested rings and tick ring"`

---

### Task 4: Content components

**Files:**
- Create: `packages/ui/src/{TaskRow.tsx,RoomCard.tsx,Avatar.tsx,StatCard.tsx,MemberBars.tsx,ListGroup.tsx,EmptyState.tsx,TextField.tsx,ChoiceChips.tsx,Screen.tsx}`
- Create (design-system parity, used later or by future screens): `GoalCard.tsx, QuickAction.tsx, ProgressArcs.tsx, TaskChip.tsx, InsightCard.tsx` — straight ports of the design-system components' props (see `index.d.ts` there) to RN.
- Test: `packages/ui/test/content.test.tsx`

**Interfaces:**
- `TaskRow({ icon, name, caption, captionTone?: 'muted'|'due', assignee?: { initial: string } , done, onToggle, onPress, onLongPress?, busy? })` — layout per mockup: icon circle (36, `surfaceSunken`), name (`body` 15/500) + caption (`caption`), avatar (22), `TickRing` right. Name and caption `numberOfLines={1}`; the text column is `flex: 1, minWidth: 0` so the ring never moves. `done` → name struck through in `inkMuted`. `busy` disables the tick.
- `RoomCard({ icon, name, freshness: number, status: string, statusTone?: 'muted'|'due', onPress })` — white card, ring 36 (brand), name `numberOfLines={1}`.
- `Avatar({ name: string | null, size = 22, tone?: 'night'|'muted' })` — initial (first letter, uppercase, `?` for null).
- `StatCard({ label, value, unit?, tone?: 'light'|'night' })`; `MemberBars({ rows: { name: string; value: number }[] })` — vertical bars, first bar `brand`, others `ink`, max-normalised.
- `ListGroup({ title?, children })`, `ListRow({ label, value?, onPress?, destructive? })` — destructive label in `brandStrong`.
- `EmptyState({ icon, title, body, action?: { label, onPress } })`.
- `TextField({ label, value, onChangeText, placeholder?, error?, ...TextInputProps })` — pill input, focus ring 2 px `ink`.
- `ChoiceChips<T>({ options: { value: T; label: string }[], value: T[] | T, multiple?: boolean, onChange })`.
- `Screen({ title?, right?, children, scroll = true })` — safe-area aware, `surface` bg, gutters `space-5`, bottom padding that clears the floating tab bar (110 px), centred max-width 480 on wide screens.

- [ ] **Step 1: Write failing tests**:
  - **(Review Focus 1)** `TaskRow` with name "Clean windows and window sills" and caption "Kids' bedroom upstairs, Living room +2" renders both with `numberOfLines={1}` and the `TickRing` still present; rendering inside a 320-wide container keeps the text column style `{ flex: 1, minWidth: 0 }`
  - `TaskRow` done → name has `textDecorationLine: 'line-through'`; `onToggle` not called when `busy`
  - `RoomCard` name has `numberOfLines={1}`; `statusTone="due"` colors status `#b84424`
  - `Avatar` shows `"A"` for "ana" and `"?"` for null
  - `MemberBars` first bar uses `#e2643f`
  - `ListRow destructive` label color `#b84424`
  - `ChoiceChips multiple` toggles values in and out
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5: Commit** `git commit -m "feat(ui): task row, room card, stats and form components"`

---

### Task 5: Sheet, toast, celebration; shared formatting

**Files:**
- Create: `packages/ui/src/{Sheet.tsx,Toast.tsx,Celebration.tsx}`, `packages/shared/src/format.ts`
- Test: `packages/ui/test/overlays.test.tsx`, `packages/shared/test/format.test.ts`

**Interfaces:**
- `Sheet({ visible, onClose, title, children, footer? })` — bottom sheet (RN `Modal`, slide up, `radiusXl` top corners, backdrop press closes, max height 90%).
- `ToastProvider`, `useToast(): { show(opts: { message: string; action?: { label: string; onPress(): void }; durationMs?: number }): void }` — one toast at a time, bottom above tab bar, default 4000 ms; undo toasts pass `durationMs: 10000` (spec §7.3).
- `Celebration({ visible, onDone })` — sparkle burst (6–8 `sparkle` icons scaling/fading out from centre, ~900 ms) + `Haptics.notificationAsync(Success)`; calls `onDone` at the end.
- `formatDue(nextDue: IsoDate, today: IsoDate): { text: string; tone: 'muted' | 'due' }` — pure string date math (no device timezone): `today` → "Due today" (due); `today+1` → "Due tomorrow" (muted); within 6 days ahead → "Due Thursday" (muted); further → "Due 12 Nov" (muted); past 1 day → "Due yesterday" (due); past n days → "Due n days ago" (due). Uses a `t`-compatible formatter param later; returns English here.
- `formatInterval(count, unit)` → "Daily", "Every 3 days", "Weekly", "Every 2 weeks", "Monthly", "Every 2 months".
- `reminderPresets`: `[{ key: 'at', minutes: 0 }, { key: '1h', minutes: 60 }, { key: '3h', minutes: 180 }, { key: 'evening', minutes: null }, { key: '1d', minutes: 1440 }]` and `eveningBeforeOffset(dueTime: string | null, fallback: string): number` = minutes from 18:00 the previous day to the due moment (e.g. due 08:00 → 840; due 19:00 → 1500).

- [ ] **Step 1: Write failing tests**:
  - **(Review Focus 5)** with `process.env.TZ = 'America/Los_Angeles'`, `formatDue('2026-10-31', '2026-10-31')` → "Due today"; `formatDue('2026-11-05', '2026-10-31')` → "Due Thursday"; `formatDue('2026-11-12', '2026-10-31')` → "Due 12 Nov"; `formatDue('2026-10-26', '2026-10-31')` → `{ text: 'Due 5 days ago', tone: 'due' }`
  - `formatInterval(1,'day')` "Daily", `(4,'week')` "Every 4 weeks"
  - `eveningBeforeOffset(null, '08:00')` 840, `('19:00','08:00')` 1500
  - `useToast().show` renders message and action; pressing action calls it and hides the toast
  - `Celebration visible` calls mocked `Haptics.notificationAsync` and `onDone` after timers run
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5: Commit** `git commit -m "feat: sheet, toast, celebration and date formatting"`

---

### Task 6: API client, dev token endpoint, account endpoints

**Files:**
- Create: `packages/shared/src/client.ts`, `apps/api/src/routes/dev.ts`
- Modify: `apps/api/src/routes/me.ts`, `apps/api/src/app.ts`, `packages/shared/src/schemas.ts`, `packages/shared/src/index.ts`
- Test: `packages/shared/test/client.test.ts`, `apps/api/test/dev.test.ts`, `apps/api/test/me.test.ts` (extend)

**Interfaces:**
- `class ApiError extends Error { status: number; code: string }`.
- `createApiClient({ baseUrl: string; getToken: () => Promise<string | null>; onUnauthorized?: () => Promise<boolean>; fetchImpl?: typeof fetch })` returns an object with one method per Plan 1 endpoint, typed with the shared DTOs. Names (exact): `bootstrap, updateMe, deleteMe, createHome, getHome, updateHome, deleteHome, listMembers, removeMember, leaveHome, transferHome, createInvite, listInvites, revokeInvite, previewInvite, acceptInvite, listRooms, createRoom, updateRoom, reorderRooms, archiveRoom, listTasks, createTask, getTask, updateTask, archiveTask, muteTask, completeTask, skipTask, undoCompletion, taskHistory, dashboard, stats, suggestions`. Signatures take ids positionally then an input object, e.g. `listTasks(homeId, { scope?, roomId? })`, `dashboard(homeId, scope)`, `stats(homeId, range, from?, to?)`, `updateTask(taskId, patch)`, `muteTask(taskId, muted)`; `completeTask(taskId, dueDate)` is the only signature of complete (dueDate required). On 401: calls `onUnauthorized()` once; if it returns true, retries the request once with a fresh token; otherwise throws `ApiError(401)`. Non-2xx → `ApiError(status, body.error.code, body.error.message)`; network failure → `ApiError(0, 'network', …)`.
- API additions:
  - `POST /dev/token { sub: string; name?: string; email?: string }` → `{ token }` signed HS256 with `AUTH_DEV_SECRET`, 30-day expiry. **Only registered when `config.AUTH_MODE === 'dev'`** (route returns 404 otherwise).
  - `PATCH /me { displayName: string(1..60) }` → user.
  - `DELETE /me` → for each membership: if owner and other members exist → 409 `transfer_required` (nothing changes); if sole member → home deleted; else membership removed (as leave). Then anonymise the user row (`display_name`, `email`, `avatar_url` → null, `auth_subject` → `'deleted:' || id`, `deleted_at = now()`), delete push subscriptions. 204.

- [ ] **Step 1: Write failing tests**:
  - client: sends `Authorization: Bearer <token>` and JSON body; `completeTask('t1','2026-10-31')` posts `{"dueDate":"2026-10-31"}` to `/tasks/t1/complete`; non-2xx throws `ApiError` with `code` from body; **(Review Focus 4)** on 401 calls `onUnauthorized` once, retries with the new token and succeeds; when `onUnauthorized` resolves false → throws `ApiError` 401 without a second retry; fetch rejection → `ApiError` status 0 code `network`
  - api dev: `POST /dev/token` in dev mode returns a token that `/me/bootstrap` accepts; with a jwks-mode config the route is 404
  - api me: `PATCH /me` renames; `DELETE /me` as owner with another member → 409 and user intact; as plain member → 204, user's history shows "Former member", the same token now gets 401
- [ ] **Step 2–4:** FAIL → implement → PASS (`pnpm test` at root).
- [ ] **Step 5: Commit** `git commit -m "feat: typed API client, dev token and account endpoints"`

---

### Task 7: Expo app scaffold, providers, auth

**Files:**
- Create: `apps/app/*` scaffold (`app.json`, `package.json`, `tsconfig.json`, `babel.config.js`, `jest.config.js`), `app/_layout.tsx`, `app/(auth)/{welcome,email,code}.tsx`, `src/auth/{AuthProvider.tsx,supabase.ts,devAuth.ts}`, `src/data/{api.ts,queryClient.ts}`, `src/i18n/{index.ts,en.json}`
- Test: `apps/app/test/auth.test.tsx`

**Interfaces:**
- Package name `@klindom/app`.
- Env (Expo public): `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_AUTH_MODE` (`supabase`|`dev`), `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`. `.env.example` in `apps/app`.
- `useAuth(): { status: 'loading'|'signedOut'|'signedIn'; getToken(): Promise<string | null>; refresh(): Promise<boolean>; signInWithGoogle(): Promise<void>; sendEmailCode(email: string): Promise<void>; verifyEmailCode(email: string, code: string): Promise<void>; signInDev(name: string): Promise<void>; signOut(): Promise<void> }`.
  - Supabase mode: `signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })` on web; `signInWithOtp({ email, options: { shouldCreateUser: true } })` + `verifyOtp({ email, token, type: 'email' })` — **6-digit code, no magic link** (spec §8.5).
  - Dev mode: `signInDev(name)` calls `POST /dev/token` with `sub = 'dev:' + slug(name)`, stores token in `AsyncStorage`/`localStorage`.
- `useApi()` returns the `createApiClient` instance wired to `useAuth().getToken` and `onUnauthorized = refresh` (sign out when refresh fails).
- `app/_layout.tsx`: loads Geist fonts, wraps `SafeAreaProvider`, `QueryClientProvider` (`staleTime 15 s`, `refetchOnWindowFocus: true`, `refetchInterval: 30_000` while focused — spec §6.2), `ToastProvider`, i18n; redirects: signedOut → `/(auth)/welcome`; signedIn with no homes (from `bootstrap`) → `/(onboarding)/start`; else `/(tabs)`. A pending invite code (from `/join/[code]`) survives sign-in and routes to the join confirmation.
- Welcome: large `ActionOrb` with halo, display greeting "Let’s make home shine.", buttons "Continue with Google", "Continue with email" (+ "Dev sign-in" in dev mode). Email: `TextField` + "Send code". Code: 6-digit field + "Verify", "Send a new code".

- [ ] **Step 1: Write failing tests** (auth adapter mocked at the `supabase.ts` boundary): signed-out renders Welcome with both buttons; `verifyEmailCode` success → router replaced to onboarding when `bootstrap` returns `homes: []` and to `/(tabs)` otherwise; **(Review Focus 4)** API 401 → `refresh()` called once; when it returns false the app shows Welcome; dev mode shows "Dev sign-in" and Supabase mode does not.
- [ ] **Step 2: Run** `pnpm -F @klindom/app test auth` — Expected: FAIL.
- [ ] **Step 3: Implement** (scaffold with `create-expo-app` default router template, then strip the example screens).
- [ ] **Step 4: Run** tests — Expected: PASS. Run `pnpm -F @klindom/app exec expo export --platform web` — Expected: exits 0 and writes `apps/app/dist/index.html`.
- [ ] **Step 5: Commit** `git commit -m "feat(app): expo scaffold, providers and sign-in"`

---

### Task 8: Onboarding — create, join, suggestions, invite

**Files:**
- Create: `app/(onboarding)/{start,join,create,rooms,review,invite}.tsx`, `app/join/[code].tsx`, `src/data/{homes.ts,invites.ts}`, `src/state/currentHome.ts`
- Test: `apps/app/test/onboarding.test.tsx`

**Interfaces:**
- `useCurrentHome(): { homeId: string | null; setHomeId(id: string): void }` — persisted (storage); defaults to the first home from `bootstrap`.
- Hooks (`src/data/homes.ts`): `useBootstrap()`, `useCreateHome()`, `useSuggestions()`, `useInvitePreview(code)`, `useAcceptInvite()`; (`invites.ts`) `useCreateInvite(homeId)`.
- Flow (spec §8.5): Start → "Create a home" / "Join a home". Join: code field (accepts any case, with/without dash) → preview "Join <home>?" with inviter → "Join home". Create: home name (default "<First name>’s home"), timezone = `Intl.DateTimeFormat().resolvedOptions().timeZone` → "Start with suggestions" or "Start from scratch". Suggestions: room ChoiceChips with − / + count (1..5) → Review: per room, its suggested tasks (with `formatInterval`), plus shared tasks; all pre-ticked; untick to exclude → "Create home" posts `{ name, timezone, suggestions: { rooms, taskKeys } }`. Scratch: posts without suggestions. Then Invite (skippable): "Share invite" uses `Share.share({ message, url })` (Web Share API on web, clipboard fallback with toast "Invite link copied") → "Continue" → `/(tabs)`.
- `/join/[code]`: stores code as pending if signed out; otherwise shows the same preview/confirm screen.

- [ ] **Step 1: Write failing tests** (API client mocked via a test `ApiProvider`): suggestions flow submits exactly `{ rooms: [{key:'kitchen',count:1},{key:'bedroom',count:2}], taskKeys: [...all pre-ticked minus one unticked] }`; scratch flow submits no `suggestions`; join with `k7q2mx` calls `previewInvite('k7q2mx')` then `acceptInvite`; invalid code shows "This invite is no longer valid" from the API message; share falls back to clipboard + toast when `Share.share` rejects.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5: Commit** `git commit -m "feat(app): onboarding with suggestions, scratch and join"`

---

### Task 9: Home tab — rings, due today, ticking

**Files:**
- Create: `app/(tabs)/_layout.tsx`, `app/(tabs)/index.tsx`, `src/data/{dashboard.ts,tasks.ts}`
- Test: `apps/app/test/home.test.tsx`

**Interfaces:**
- Tab layout: `TabBar` items `home` (icon `home`), `rooms` (icon `sponge` — **flag new "room" glyph for the design system**), `tasks` (`checklist`), `profile` (`profile`); labels from i18n; floats 22 px above the bottom safe area.
- `useDashboard(homeId, scope)`; `useCompleteTask(homeId)`, `useSkipTask(homeId)`, `useUndoCompletion(homeId)` — mutations that optimistically move the task to `doneToday`, bump `rings.today.done`/`week.done`, then replace with the server's `rings`; on error roll back and toast `t('errors.tickFailed')` ("Couldn’t save that — try again"). Concurrent calls for the same task while one is pending are ignored (**Review Focus 3**).
- Home screen (spec §8.1, mockup option A): greeting (`display`, centred; "Fresh start today!" when nothing done, "All done for today" when today ring closed, else "Nice, keep going"), subline date + (streak placeholder omitted until Plan 3), `Rings` card (Today `brand`, This week `ink`, Home fresh `ringFresh`, unit `%`), All/Mine `SegmentedControl`, "Due Today" `title` with "See all" → Tasks; list = `dueToday` (caption = rooms joined, or `formatDue` text with `due` tone when overdue; avatar when assigned) then `doneToday` rows (done, caption "Done by Ana · 9:40"). Tick → complete with `dueDate = task.nextDueDate`, undo toast (10 s) calling `undoCompletion`. Long press → Sheet with "Skip this time". Row press → `/tasks/[id]`. `onRingClosed` → `Celebration`. Empty home → EmptyState "Nothing due today" + "Add a task".
- Error state (**Review Focus 2**): query error → inline card "Couldn’t load your home" + "Try again" (refetch); stale data stays visible during background refetch errors.

- [ ] **Step 1: Write failing tests**:
  - renders three ring legends `4/9`, `18/31`, `86%` from a mocked dashboard, and due rows in API order
  - tick calls `completeTask(id, '2026-10-31')` once even when the tick is pressed twice quickly
  - after success an undo toast appears; pressing "Undo" calls `undoCompletion(completionId)`
  - failed complete rolls the row back to not-done and shows "Couldn’t save that — try again"
  - dashboard fetch error shows "Couldn’t load your home" and "Try again" refetches
  - today ring going 8/9 → 9/9 after a tick shows the celebration (mocked component receives `visible`)
  - "Mine" switch refetches with `scope=mine`
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5: Commit** `git commit -m "feat(app): home dashboard with rings and tick-off"`

---

### Task 10: Tasks tab, task editor, task detail

**Files:**
- Create: `app/(tabs)/tasks/{index,[id]}.tsx`, `app/task-editor.tsx`
- Modify: `src/data/tasks.ts` (list/create/update/archive/mute/history hooks)
- Test: `apps/app/test/tasks.test.tsx`

**Interfaces:**
- Tasks list (spec §8.3): header "Tasks" + `ActionOrb` "+" (label "Add a task") → `/task-editor`; `SegmentedControl` All / Mine / By room; groups **Overdue** (`next < today`), **Today**, **This week** (≤ week end via `weekBounds`), **Later**; By room = sections per room (multi-room tasks appear under each). Row caption `formatInterval` (+ room names in All/Mine). Tick works as on Home (shared mutation hook).
- Task editor (modal route, `?id=` to edit): fields name, icon (ChoiceChips of the 17 icons), rooms (multi ChoiceChips, ≥1, error "Pick at least one room"), frequency (count stepper 1..365 + unit chips Day/Week/Month), start date (new tasks only; default today), due time (optional, "Any time" or HH:mm), assignee (Household + members), reminders (multi ChoiceChips from `reminderPresets`; "The evening before" stored via `eveningBeforeOffset(dueTime, '08:00')`), notes. Save → create/update; "More" → "Archive task" (confirm sheet).
- Task detail: name, `formatDue`, frequency, assignee, rooms, reminders, mute toggle "Remind me" (calls `muteTask`), history list ("Ana · 31 Oct · on time" / "late" / "skipped"), "Edit task".

- [ ] **Step 1: Write failing tests**: grouping puts a task due `2026-10-26` under Overdue, `2026-10-31` under Today, `2026-11-01` under This week, `2026-11-09` under Later (today `2026-10-31`); editor blocks save with no rooms and shows "Pick at least one room"; editor submits `{ name, icon, roomIds, intervalCount: 2, intervalUnit: 'week', reminderOffsets: [0, 840], assigneeId: null }` when "At due time" + "The evening before" picked with no due time; edit mode sends only changed fields to `updateTask`; detail renders history entries "late"/"skipped" correctly and mute toggle calls `muteTask(id, true)`.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5: Commit** `git commit -m "feat(app): tasks list, editor and detail"`

---

### Task 11: Rooms tab, room detail, room editor

**Files:**
- Create: `app/(tabs)/rooms/{index,[id]}.tsx`, `app/room-editor.tsx`
- Modify: `src/data/rooms.ts`
- Test: `apps/app/test/rooms.test.tsx`

**Interfaces:**
- Rooms grid (spec §8.2): title "Rooms", subline "5 rooms · 3 fresh"; 2-up `RoomCard`s; freshness = share of the room's active tasks not overdue (computed client-side from `listTasks` — 1 when the room has no tasks); status: overdue count → "1 overdue" (due tone), else due-today count → "2 due today", else next due → "Next: Sun" / "All fresh" when nothing within 7 days; last tile "+ Add a room" → `/room-editor`.
- Room detail: header with ring + name, the room's tasks (`listTasks({ roomId })`) as TaskRows with ticks, "Edit room" → editor (name, icon, "Archive room" — API 409 `room_has_tasks` shows its message as a toast).
- Reorder: long-press "Reorder rooms" mode with up/down buttons (no drag dependency) → `reorderRooms`.

- [ ] **Step 1: Write failing tests**: status strings for overdue / due today / next due / all fresh fixtures; freshness 0.5 for a room with one of two tasks overdue; archive 409 shows "Move or archive its tasks first"; reorder submits the new id order.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5: Commit** `git commit -m "feat(app): rooms grid, room detail and editor"`

---

### Task 12: Profile — stats, members, invites, home and account

**Files:**
- Create: `app/(tabs)/profile/{index,members,home,account}.tsx`
- Modify: `src/data/{stats.ts,homes.ts,invites.ts}`
- Test: `apps/app/test/profile.test.tsx`

**Interfaces:**
- Profile (spec §8.4): avatar, name, "<home> · owner|member"; "Who did what" card with Week/Month `SegmentedControl` → `stats(range)` → `MemberBars` + per-member `stat` counts; groups **Home** (Members → members screen, Invite someone → create invite + share, Home settings → home screen) and **You** (Account → account screen). Notifications row shows "Coming soon" disabled (Plan 3 wires it). Awards & history row omitted until Plan 3.
- Members: list with role; owner sees "Remove" per member (confirm sheet) and "Make owner" (transfer); active invites with code and "Revoke".
- Home settings: rename (owner), "Leave home" (409 `transfer_required` → message "Hand the home over to someone before leaving"), owner "Delete home" requires typing the home name (sends `confirmName`).
- Account: display name edit (`updateMe`), "Sign out", "Delete account" (confirm; 409 shows transfer message; success signs out).

- [ ] **Step 1: Write failing tests**: stats card renders member names and counts for week, switches to month and calls `stats(homeId, 'month')`; owner sees Remove/Make owner, member doesn't; leave 409 shows the transfer message; delete home disabled until typed name matches; delete account success calls `signOut`.
- [ ] **Step 2–4:** FAIL → implement → PASS.
- [ ] **Step 5: Commit** `git commit -m "feat(app): profile, members, home and account settings"`

---

### Task 13: Web smoke test end to end

**Files:**
- Create: `apps/app/e2e/smoke.spec.ts`, `apps/app/playwright.config.ts`
- Modify: root `package.json` (`e2e` script), `README.md` (how to run app + e2e)

**Interfaces:**
- Playwright starts: `postgres` + `migrate` + `api` via `docker compose -f docker-compose.yml -f compose.dev.yml up -d` (global setup), and `expo start --web --port 8081` with `EXPO_PUBLIC_AUTH_MODE=dev`, `EXPO_PUBLIC_API_URL=http://localhost:8080` (webServer). Viewport 375×812.

- [ ] **Step 1: Write the test**: Dev sign-in as "Tilen" → Create a home → Start with suggestions → pick Kitchen → Create home → skip invite → Home shows "Due Today" with "Dishes" → tap its tick → "Undo" toast visible and Today legend shows `1/` → open Tasks tab, see "Dishes" under a later group → Profile shows "Who did what" with "Tilen" and `1`.
- [ ] **Step 2: Run** `pnpm e2e` — Expected: PASS. Also run at a 320×640 viewport for the Home screen and assert no horizontal scroll (`document.documentElement.scrollWidth <= 320`) (**Review Focus 1**).
- [ ] **Step 3: Commit and push**

```bash
git commit -m "test(app): web smoke test end to end"
git push -u origin feat/app-ui
```

---

## Done when

- `pnpm test` (api, shared, ui, app) and `pnpm typecheck` pass; `pnpm e2e` passes locally.
- `expo export --platform web` builds; the app runs against the dev API and completes the onboarding → tick → stats path.
- Branch `feat/app-ui` pushed; PR opened against `feat/backend-core` (or `main` once PR #1 is merged).
