#!/usr/bin/env bash
# Builds the PWA and deploys it to Cloudflare Pages. Run from anywhere: `pnpm deploy:web`.
set -euo pipefail

cd "$(dirname "$0")/../../.."

if [ ! -f apps/app/.env.production ]; then
  echo "error: apps/app/.env.production is missing. Copy apps/app/.env.production.example and fill it in." >&2
  exit 1
fi

pnpm -F @klindom/app export:web
pnpm -F @klindom/app exec wrangler pages deploy dist --project-name klindom --branch "${PAGES_BRANCH:-main}"
