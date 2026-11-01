import { defineConfig, devices } from '@playwright/test';

/** PWA e2e: serves the exported dist/ (run `pnpm export:web` first); no API or global setup needed. */
export default defineConfig({
  testDir: './e2e',
  testMatch: 'pwa.spec.ts',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  use: { baseURL: 'http://localhost:4173', viewport: { width: 375, height: 812 } },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 812 } } }],
  webServer: { command: 'node scripts/serve-dist.mjs 4173', url: 'http://localhost:4173', reuseExistingServer: false },
});
