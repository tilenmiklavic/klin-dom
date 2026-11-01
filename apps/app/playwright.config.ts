import { defineConfig, devices } from '@playwright/test';

/**
 * Web smoke test against the real API (dev auth) and Postgres.
 * The app is served by `expo start --web` with dev auth pointed at the local API.
 */
export default defineConfig({
  testDir: './e2e',
  testIgnore: 'pwa.spec.ts',
  globalSetup: './e2e/global-setup.ts',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:8081',
    viewport: { width: 375, height: 812 },
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 812 } } }],
  webServer: {
    command: 'pnpm exec expo start --web --port 8081',
    url: 'http://localhost:8081',
    reuseExistingServer: true,
    timeout: 180_000,
    env: {
      EXPO_PUBLIC_AUTH_MODE: 'dev',
      EXPO_PUBLIC_API_URL: 'http://localhost:8080',
      CI: '1', // no watch/interactive prompts
    },
  },
});
