import { test, expect } from '@playwright/test';

test.describe('AlbumShelf Online', () => {
  test('should allow signup and login', async ({ page }) => {
    const email = `user-${Date.now()}@example.com`;
    // Signup
    await page.goto('http://localhost:3000/signup');
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Login (should be redirected to /login after signup)
    await expect(page).toHaveURL(/.*login/);
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Dashboard
    await expect(page).toHaveURL('http://localhost:3000/');
    await expect(page.locator('h2')).toContainText('Collections', { ignoreCase: true });
  });

  test('should search and add an album', async ({ page }) => {
    const email = `search-${Date.now()}@example.com`;
    // Signup
    await page.goto('http://localhost:3000/signup');
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Login
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

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
