# KlinDom

A shared home-cleaning planner: homes, rooms, recurring tasks, ring-based progress and reminders.
PWA first (Expo / React Native), native apps later. Design: [`docs/superpowers/specs`](docs/superpowers/specs).

## Layout

- `apps/api` — Hono API (Node 22, TypeScript). All business logic lives here.
- `packages/shared` — domain types, schemas and date/recurrence helpers shared by API and app.
- `db/migrations` — plain SQL migrations (dbmate).

## Develop

```bash
pnpm install
docker compose up -d postgres-test   # for tests
pnpm test
pnpm typecheck
docker compose -f docker-compose.yml -f compose.dev.yml up --build   # API on :8080, dev auth
```

Copy `.env.example` to `.env` for local runs. Plain `docker compose up` expects real auth (`AUTH_JWKS_URL`, `AUTH_ISSUER`); dev tokens only work with `compose.dev.yml`.

## Run the app locally

```bash
docker compose -f docker-compose.yml -f compose.dev.yml up -d --build   # API on :8080, dev auth
cp apps/app/.env.example apps/app/.env                                  # EXPO_PUBLIC_AUTH_MODE=dev
pnpm -F @klindom/app web                                                 # http://localhost:8081
```

The welcome screen then shows a name-only "Dev sign-in". With `EXPO_PUBLIC_AUTH_MODE=supabase` it uses Google / email code instead (set the `EXPO_PUBLIC_SUPABASE_*` values).

## End-to-end smoke test

```bash
pnpm exec playwright install chromium   # once
pnpm e2e
```

Needs Docker and a browser, so it is not part of `pnpm test`. Playwright brings up the dev-auth API stack (idempotent), starts `expo start --web --port 8081`, then drives onboarding → tick → Tasks → Profile stats in Chromium. Each run signs in with a unique dev name, so leftover data in the database doesn't matter. It also checks that Home has no horizontal scroll at 320 px wide.
