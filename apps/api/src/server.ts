import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { systemClock } from './clock.js';
import { loadConfig } from './config.js';

const config = loadConfig();
const app = createApp({ clock: systemClock, config });

serve({ fetch: app.fetch, port: config.PORT }, (info) => {
  console.log(`KlinDom API listening on :${info.port}`);
});
