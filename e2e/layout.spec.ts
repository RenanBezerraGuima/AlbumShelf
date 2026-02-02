import { test, expect } from '@playwright/test';

test('headers should be aligned', async ({ page }) => {
  await page.goto('./');

  // Create a folder first
  await page.click('button[title="Create folder"]');
  await page.fill('input[placeholder="Folder name"]', 'Test Folder');
  await page.keyboard.press('Enter');

  // Select the folder
  await page.click('text=Test Folder');

  // Use more specific selectors
  const folderTreeHeader = page.locator('div:has(> h2:text("Collections"))').first();
  const albumGridHeader = page.locator('div:has(> p:text-matches("album"))').first();

  const folderTreeBox = await folderTreeHeader.boundingBox();
  const albumGridBox = await albumGridHeader.boundingBox();

  if (folderTreeBox && albumGridBox) {
    const folderTreeBottom = folderTreeBox.y + folderTreeBox.height;
    const albumGridBottom = albumGridBox.y + albumGridBox.height;

    console.log(`FolderTree header bottom: ${folderTreeBottom}`);
    console.log(`AlbumGrid header bottom: ${albumGridBottom}`);

    expect(folderTreeBottom).toBeCloseTo(albumGridBottom, 1);
    expect(folderTreeBox.height).toBeCloseTo(albumGridBox.height, 1);
  } else {
    throw new Error('Could not find headers');
  }
});
