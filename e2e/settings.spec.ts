import { test, expect } from '@playwright/test';

test.describe('Settings - Export/Import', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('./');
    // Handle First Time Setup
    await page.getByRole('button', { name: 'Deezer' }).click();
  });

  test('should open settings dialog', async ({ page }) => {
    await page.getByRole('button', { name: 'Settings' }).click();
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    await expect(page.getByText('Manage your personal data and collections.')).toBeVisible();
  });

  test('should export data', async ({ page }) => {
    // Create a collection first
    await page.getByRole('button', { name: 'Create collection' }).click();
    await page.getByPlaceholder('Collection name').fill('Export Test');
    await page.keyboard.press('Enter');
    await expect(page.getByText('Export Test')).toBeVisible();

    await page.getByRole('button', { name: 'Settings' }).click();

    // Start waiting for download before clicking
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export Data' }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/^backup-\d{2}-\d{2}-\d{4}\.json$/);
  });

  test('should import data and merge with OLD/NEW naming', async ({ page }) => {
    // 1. Create an existing collection
    await page.getByRole('button', { name: 'Create collection' }).click();
    await page.getByPlaceholder('Collection name').fill('Collision');
    await page.keyboard.press('Enter');
    await expect(page.getByText('Collision')).toBeVisible();

    // 2. Prepare import data
    const importData = JSON.stringify([
      {
        id: 'imp-1',
        name: 'Collision',
        parentId: null,
        albums: [],
        subfolders: [],
        isExpanded: true
      },
      {
        id: 'imp-2',
        name: 'New Folder',
        parentId: null,
        albums: [],
        subfolders: [],
        isExpanded: true
      }
    ]);

    // 3. Open settings and import
    await page.getByRole('button', { name: 'Settings' }).click();

    // Set up file chooser listener
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: 'Import Data' }).click();
    const fileChooser = await fileChooserPromise;

    await fileChooser.setFiles({
      name: 'backup.json',
      mimeType: 'application/json',
      buffer: Buffer.from(importData),
    });

    // 4. Verify results
    await expect(page.getByText('Data merged successfully')).toBeVisible();

    // Close dialog by clicking X or pressing Escape
    await page.keyboard.press('Escape');

    await expect(page.getByText('Collision (OLD)')).toBeVisible();
    await expect(page.getByText('Collision (NEW)')).toBeVisible();
    await expect(page.getByText('New Folder')).toBeVisible();
  });
});
