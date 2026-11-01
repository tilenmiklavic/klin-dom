# Deploy runbook

Stack: Supabase (Postgres + Auth), Render (API, free web service), Cloudflare Pages (PWA), cron-job.org (reminder trigger).

Supabase project: ref `whmcinlyjqavtkfieedc`, region eu-north-1.

- URL: `https://whmcinlyjqavtkfieedc.supabase.co`
- JWKS: `https://whmcinlyjqavtkfieedc.supabase.co/auth/v1/.well-known/jwks.json`
- Issuer: `https://whmcinlyjqavtkfieedc.supabase.co/auth/v1`

Never commit passwords, keys or `.env.production`.

## 1. Supabase database

1. In the Supabase dashboard open **Connect -> Session pooler** and copy the exact connection string (port 5432, user `postgres.whmcinlyjqavtkfieedc`). Fill in the database password. Do not use the direct host: it is IPv6-only and unreachable from Render.
2. Run the migrations from your laptop. `--no-deps` stops compose from starting the local Postgres:

   ```bash
   docker compose run --rm --no-deps -e DATABASE_URL='<pooler url>?sslmode=require' migrate
   ```

   (If the string already has a query part, append `&sslmode=require` instead.)
3. Turn off the Data API (Project Settings -> Data API), or confirm RLS is enabled on every table (Task 2 migration). The API talks to Postgres directly, so the Data API is not needed.

## 2. VAPID keys

```bash
pnpm -F @klindom/api exec web-push generate-vapid-keys
```

Keep the public and private key for step 3. The subject is `VAPID_SUBJECT=mailto:<owner email>`.

## 3. Render (API)

1. Render dashboard -> **New -> Blueprint**, pick this repo. It reads `render.yaml` (service `klindom-api`, Docker, free plan, Frankfurt).
2. Fill in the prompted values:

   | Variable | Value |
   | --- | --- |
   | `DATABASE_URL` | the session pooler string from step 1 (no `sslmode` needed; `DATABASE_SSL=require` is preset) |
   | `CRON_SECRET` | a long random string (`openssl rand -hex 32`), reused in step 6 |
   | `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | from step 2 |
   | `VAPID_SUBJECT` | `mailto:<owner email>` |
   | `AUTH_JWKS_URL` | the JWKS URL above |
   | `AUTH_ISSUER` | the issuer above |
   | `APP_URL` | the Cloudflare Pages URL (step 4), e.g. `https://klindom.pages.dev` |

   `NODE_ENV=production`, `AUTH_MODE=jwks` and `DATABASE_SSL=require` are preset. If `APP_URL` is not known yet, enter a placeholder and update it after step 4.
3. Check the deploy: `curl https://<svc>.onrender.com/healthz` returns `{"ok":true}`.

## 4. Cloudflare Pages (app)

1. Create the Pages project named `klindom` (direct upload; `npx wrangler login` once, or `pnpm -F @klindom/app exec wrangler login`).
2. Copy `apps/app/.env.production.example` to `apps/app/.env.production` and fill in the Render URL (`EXPO_PUBLIC_API_URL`), the Supabase URL and the publishable key (`EXPO_PUBLIC_SUPABASE_ANON_KEY`).
3. Run:

   ```bash
   pnpm deploy:web
   ```

   It fails early if `.env.production` is missing, builds with `expo export` (which loads `.env.production`) and runs `wrangler pages deploy dist --project-name klindom`.
4. Set `APP_URL` on Render to the resulting Pages URL if it was a placeholder.

## 5. Supabase Auth

1. Authentication -> URL Configuration: set **Site URL** to the Pages URL and add it to **Redirect URLs**.
2. In Google Cloud Console, on the OAuth client used by Supabase, add the Pages URL as an **Authorised JavaScript origin**. (The authorised redirect URI stays the Supabase callback.)

## 6. cron-job.org

Create a job that runs every minute:

- URL: `https://<svc>.onrender.com/internal/run-reminders`
- Method: `POST`
- Header: `Authorization: Bearer <CRON_SECRET>`

The request also keeps the free instance awake (about 744 of the 750 free hours a month).

## 7. Smoke test

1. Sign in on a phone and install the app to the Home Screen.
2. Turn on reminders in the app.
3. Create a task due in 5 minutes and wait for the push notification.

## 8. Raspberry Pi later

Run the same compose stack with the `worker` service instead of cron-job.org, a local Postgres and `DATABASE_SSL=off`.
