import { test, expect } from '@playwright/test';

test('verify album drag improvements', async ({ page }) => {
  await page.goto('./');

  // Handle First Time Setup
  await page.getByRole('button', { name: 'Deezer' }).click();

  // 1. Verify draggable="false" on AlbumCard images
  // First, create a collection and add an album
  await page.click('button[title="Create collection"]');
  await page.fill('input[placeholder="Collection name"]', 'Folder A');
  await page.keyboard.press('Enter');

  await page.click('button[title="Create collection"]');
  await page.fill('input[placeholder="Collection name"]', 'Folder B');
  await page.keyboard.press('Enter');

  await page.click('text=Folder A');

  // Search and add an album
  await page.fill('input[placeholder^="Search albums on"]', 'Beatles');
  await page.waitForSelector('text=Abbey Road', { timeout: 10000 });

  // Check SearchResultItem image
  const searchResultImg = page.locator('div[role="option"]').filter({ hasText: 'Abbey Road' }).locator('img').first();
  await expect(searchResultImg).toHaveAttribute('draggable', 'false');

  await page.click('text=Abbey Road');

  // Check AlbumCard image
  const albumCardImg = page.getByTestId('album-grid-viewport').locator('img').first();
  await expect(albumCardImg).toHaveAttribute('draggable', 'false');

  // 2. Verify folder highlighting during drag
  // We'll drag Folder A's album over Folder B in the tree
  const albumToDrag = page.getByText('Abbey Road').first();
  const folderBContainer = page.locator('div.cursor-pointer').filter({ hasText: 'Folder B' }).first();

  // Manually set the dragged album in the store via page.evaluate
  await page.evaluate(() => {
    const store = (window as any).useFolderStore;
    if (store) {
      const state = store.getState();
      const folderA = state.folders.find((f: any) => f.name === 'Folder A');
      const album = folderA.albums[0];
      state.setDraggedAlbum(album, folderA.id, 0);
    }
  });

  // Now dispatch dragover event to Folder B to trigger handleDragOver
  await folderBContainer.dispatchEvent('dragover', {
    bubbles: true,
    cancelable: true,
  });

  // Check for highlight classes on Folder B's container
  await expect(folderBContainer).toHaveClass(/bg-primary\/20/);
  await expect(folderBContainer).toHaveClass(/ring-2/);

  await page.mouse.up();
});
