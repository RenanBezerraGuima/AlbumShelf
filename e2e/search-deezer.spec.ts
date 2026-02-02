import { test, expect } from '@playwright/test';

test('verify Deezer search finds specific missing albums', async ({ page }) => {
  await page.goto('./');

  // Create a folder to enable search
  await page.click('button[title="Create folder"]');
  await page.fill('input[placeholder="Folder name"]', 'Verification');
  await page.keyboard.press('Enter');
  await page.click('text=Verification');

  // Search for "Rid of Me PJ Harvey"
  await page.fill('input[placeholder="Search albums..."]', 'Rid of Me PJ Harvey');
  await page.waitForSelector('text=Rid Of Me', { timeout: 10000 });
  await expect(page.locator('text=Rid Of Me').first()).toBeVisible();

  // Clear search
  await page.fill('input[placeholder="Search albums..."]', '');

  // Search for "Forever Howlong"
  await page.fill('input[placeholder="Search albums..."]', 'Forever Howlong');
  await page.waitForSelector('text=Forever Howlong', { timeout: 10000 });
  await expect(page.locator('text=Forever Howlong').first()).toBeVisible();
});
