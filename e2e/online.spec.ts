import { test, expect } from '@playwright/test';

test.describe('AlbumShelf Online', () => {
  test.beforeEach(async ({ page }) => {
    // Perform login with password wall
    await page.goto('http://localhost:3000/login');
    await page.fill('input[name="password"]', process.env.APP_PASSWORD || 'secret123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('http://localhost:3000/');
  });

  test('should allow access via password wall', async ({ page }) => {
    // Already authenticated in beforeEach
    await expect(page.locator('h2')).toContainText('Collections', { ignoreCase: true });
  });

  test('should search and add an album', async ({ page }) => {

    // Create a folder first if none exists
    await page.click('button:has-text("+")');

    // Search
    const searchInput = page.locator('input[type="search"]');
    await searchInput.pressSequentially('Daft Punk', { delay: 100 });
    await page.waitForSelector('#search-results .group', { timeout: 10000 });

    // Add first result
    await page.click('#search-results .group:first-child');

    // Check if added to grid
    const albumImg = page.locator('#album-grid-container img').first();
    await expect(albumImg).toBeVisible({ timeout: 10000 });
  });
});
