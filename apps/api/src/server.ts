import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { devVerifier, jwksVerifier } from './auth/verify.js';
import { systemClock } from './clock.js';
import { loadConfig } from './config.js';
import { createDb } from './db.js';

const config = loadConfig();
const verifier =
  config.AUTH_MODE === 'dev'
    ? devVerifier(config.AUTH_DEV_SECRET!)
    : jwksVerifier({ jwksUrl: config.AUTH_JWKS_URL!, issuer: config.AUTH_ISSUER! });
const app = createApp({ clock: systemClock, config, db: createDb(config.DATABASE_URL), verifier });

serve({ fetch: app.fetch, port: config.PORT }, (info) => {
  console.log(`KlinDom API listening on :${info.port}`);
});
