import { test, expect } from '@playwright/test';

test('verify Deezer search finds specific missing albums', async ({ page }) => {
  await page.goto('./');

  // Handle First Time Setup
  await page.getByRole('button', { name: 'Deezer' }).click();

  // Create a collection to enable search
  await page.click('button[title="Create collection"]');
  await page.fill('input[placeholder="Collection name"]', 'Verification');
  await page.keyboard.press('Enter');
  await page.click('text=Verification');

  // Search for "Rid of Me PJ Harvey"
  await page.fill('input[placeholder^="SEARCH ALBUMS ON"]', 'Rid of Me PJ Harvey');
  await page.waitForSelector('text=Rid Of Me', { timeout: 10000 });
  await expect(page.locator('text=Rid Of Me').first()).toBeVisible();

  // Clear search
  await page.fill('input[placeholder^="SEARCH ALBUMS ON"]', '');

  // Search for "Forever Howlong"
  await page.fill('input[placeholder^="SEARCH ALBUMS ON"]', 'Forever Howlong');
  await page.waitForSelector('text=Forever Howlong', { timeout: 10000 });
  await expect(page.locator('text=Forever Howlong').first()).toBeVisible();
});
