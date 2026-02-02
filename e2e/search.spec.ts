import { test, expect } from '@playwright/test';

test('search and add multiple albums', async ({ page }) => {
  await page.goto('./');

  // Create a folder
  await page.click('button[title="Create folder"]');
  await page.fill('input[placeholder="Folder name"]', 'My Albums');
  await page.keyboard.press('Enter');
  await page.click('text=My Albums');

  // Search for Beatles
  await page.fill('input[placeholder="Search albums..."]', 'Beatles');

  // Wait for results
  await page.waitForSelector('text=Abbey Road', { timeout: 10000 });

  // Add first album
  await page.click('text=Abbey Road');

  // Add second album (should work now!)
  await page.click('text=Let It Be');

  // Check if both are in the grid
  // Use scroll area to find the grid
  const grid = page.locator('.grid').first();
  await expect(grid.getByText('Abbey Road')).toBeVisible();
  await expect(grid.getByText('Let It Be')).toBeVisible();
});
