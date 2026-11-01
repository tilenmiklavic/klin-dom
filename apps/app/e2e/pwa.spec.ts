import { expect, test } from '@playwright/test';

// Runs against the exported build (`pnpm export:web`) served by scripts/serve-dist.mjs.
test('installable shell: manifest, service worker and offline reload', async ({ page, context }) => {
  const manifest = await page.request.get('/manifest.webmanifest');
  expect(manifest.status()).toBe(200);

  await page.goto('/');
  await expect(page.getByText('Let’s make home shine.')).toBeVisible();

  const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
  expect(new URL(scope).pathname).toBe('/');
  // Wait until the worker controls the page so the reload below is served by it.
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText('Let’s make home shine.')).toBeVisible();
});
