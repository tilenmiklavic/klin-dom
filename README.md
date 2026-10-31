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
