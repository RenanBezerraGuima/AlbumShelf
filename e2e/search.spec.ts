import { test, expect } from '@playwright/test';

test('search and add multiple albums', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.goto('./');

  // Handle First Time Setup
  await page.getByRole('button', { name: 'Deezer' }).click();

  // Create a collection
  await page.getByRole('button', { name: 'Create collection' }).click();
  await page.getByPlaceholder('Collection name').fill('My Albums');
  await page.keyboard.press('Enter');
  await page.click('text=My Albums');

  // Search for Beatles
  await page.fill('input[placeholder^="Search albums on"]', 'Beatles');

  // Wait for results
  const abbeyRoadResult = page.getByRole('option', { name: /Abbey Road/i }).first();
  const letItBeResult = page.getByRole('option', { name: /Let It Be/i }).first();
  await abbeyRoadResult.waitFor({ timeout: 10000 });

  // Add first album
  await abbeyRoadResult.click();

  // Add second album (should work now!)
  await letItBeResult.click();

  // Check if both are in the grid
  const grid = page.getByTestId('album-grid-viewport');
  await expect(grid).toBeVisible();
  await expect(grid.getByText(/Abbey Road/i).first()).toBeVisible();
  await expect(grid.getByText(/Let It Be/i).first()).toBeVisible();
});
