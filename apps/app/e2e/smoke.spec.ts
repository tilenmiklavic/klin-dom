import { expect, test } from '@playwright/test';

test('onboarding → tick → stats, and Home fits a 320px screen', async ({ page }) => {
  // The dev sub derives from the name, so a unique name always starts with no homes.
  const name = `Tilen ${Date.now()}`;

  await page.goto('/');
  await page.getByLabel('Dev name').fill(name);
  await page.getByRole('button', { name: 'Dev sign-in' }).click();

  await page.getByRole('button', { name: 'Create a home' }).click();
  await page.getByRole('button', { name: 'Start with suggestions' }).click();
  await page.getByRole('checkbox', { name: 'Kitchen' }).click();
  await page.getByRole('button', { name: 'Review tasks' }).click();
  await page.getByRole('button', { name: 'Create home' }).click();

  // Invite step: skip.
  await expect(page.getByText('Invite Your Household')).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();

  // Reminders step: skip.
  await expect(page.getByText('Stay on top of chores')).toBeVisible();
  await page.getByRole('button', { name: /Continue|Not now/ }).click();

  // Home
  await expect(page.getByText('Due Today')).toBeVisible();
  await expect(page.getByText('Dishes').first()).toBeVisible();

  // Layout holds at 320 wide.
  await page.setViewportSize({ width: 320, height: 640 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await page.setViewportSize({ width: 375, height: 812 });

  await page.getByRole('checkbox', { name: 'Mark Dishes done' }).click();
  await expect(page.getByRole('button', { name: 'Undo' })).toBeVisible();
  // Today is the first legend row: its value `1` sits right before the `/total`.
  const todayTotal = page.getByText(/^\/\d+$/).first();
  await expect(todayTotal).toBeVisible();
  await expect(todayTotal.locator('xpath=preceding-sibling::*[1]')).toHaveText('1');

  // Tasks tab: Dishes now sits in a later group.
  await page.getByRole('tab', { name: 'Tasks' }).click();
  await expect(page.getByText('Dishes').first()).toBeVisible();
  await expect(page.getByText(/^(This week|Later)$/).first()).toBeVisible();

  // Profile stats
  await page.getByRole('tab', { name: 'Profile' }).click();
  await expect(page.getByText('Who did what')).toBeVisible();
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
  await expect(page.getByText('1 done')).toBeVisible();
});
