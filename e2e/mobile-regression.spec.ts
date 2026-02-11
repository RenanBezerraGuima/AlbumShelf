import { test, expect, devices } from '@playwright/test';

test.describe('Mobile Experience Refined Layout', () => {
    test.use({ ...devices['iPhone 12 Pro'] });

    test('should have header at top and search bar at bottom', async ({ page }) => {
        await page.goto('./');
        // Handle First Time Setup if visible
        const deezerBtn = page.getByRole('button', { name: 'Deezer' });
        if (await deezerBtn.isVisible()) {
            await deezerBtn.click();
        }

        // Check Header
        const header = page.locator('header');
        await expect(header).toBeVisible();
        const headerBox = await header.boundingBox();
        expect(headerBox?.y).toBe(0);

        // Check Menu and Settings in Header
        await expect(header.getByRole('button', { name: 'Open menu' })).toBeVisible();
        await expect(header.getByRole('button', { name: 'Settings' })).toBeVisible();

        // Check Search Bar at bottom
        const searchContainer = page.locator('div:has(> div[data-testid="search-input-wrapper"])').first();
        const viewportHeight = page.viewportSize()?.height || 844;

        const searchBox = await searchContainer.boundingBox();
        if (!searchBox) throw new Error('Search container not found');

        // Should be at the bottom
        expect(searchBox.y).toBeGreaterThan(viewportHeight - 150);
    });

    test('settings dialog should be accessible from header and closable', async ({ page }) => {
        await page.goto('./');
        // Handle First Time Setup
        const deezerBtn = page.getByRole('button', { name: 'Deezer' });
        if (await deezerBtn.isVisible()) {
            await deezerBtn.click();
        }

        // Click settings in header
        await page.locator('header').getByRole('button', { name: 'Settings' }).click();

        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();

        // Check if closable
        const closeBtn = dialog.locator('button[aria-label="Close"]');
        await expect(closeBtn).toBeVisible();
        await closeBtn.click();
        await expect(dialog).not.toBeVisible();
    });
});
