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
docker compose up --build            # API on :8080 with local Postgres
```

Copy `.env.example` to `.env` for local runs.
