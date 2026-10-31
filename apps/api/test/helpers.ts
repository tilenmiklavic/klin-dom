import type { AppDeps } from '../src/app.js';
import { FixedClock } from '../src/clock.js';
import { loadConfig } from '../src/config.js';

export function testDeps(overrides: Partial<AppDeps> = {}): AppDeps {
  return {
    clock: new FixedClock(new Date('2026-10-31T09:00:00Z')),
    config: loadConfig({ AUTH_MODE: 'dev', AUTH_DEV_SECRET: 'test-secret', APP_URL: 'http://localhost:8081' }),
    ...overrides,
  };
}
