import { test, expect } from '@playwright/test';

test('add and then remove album from search results', async ({ page }) => {
  await page.goto('./');

  // Handle First Time Setup
  await page.getByRole('button', { name: 'Deezer' }).click();

  // Create a collection
  await page.click('button[title="Create collection"]');
  await page.fill('input[placeholder="Collection name"]', 'Test Collection');
  await page.keyboard.press('Enter');
  await page.click('text=Test Collection');

  // Search for an album
  await page.fill('input[placeholder^="SEARCH ALBUMS ON"]', 'Thriller');

  // Wait for results
  const albumText = 'Thriller';
  await page.waitForSelector(`text=${albumText}`, { timeout: 10000 });

  // Click to add
  await page.click(`text=${albumText}`);

  // Verify it's in the grid
  const grid = page.locator('.grid').first();
  await expect(grid.getByText(albumText)).toBeVisible();

  // The search bar should still be open or we reopen it
  // Actually handleAddAlbum doesn't close the dropdown if results are still there?
  // Wait, in AlbumSearch.tsx:
  /*
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      handleAddAlbum(results[activeIndex]);
      setIsOpen(false);
    }
  */
  // But clicking an item:
  /*
                    <div
                      key={album.id}
                      id={`option-${index}`}
                      onClick={() => handleAddAlbum(album)}
  */
  // It doesn't call setIsOpen(false) on click! So it stays open.

  // Verify green checkmark is visible in search results
  // The search item has isAdded && "bg-green-500/10" and a Check icon
  const searchResult = page.locator(`[role="option"]:has-text("${albumText}")`).first();
  await expect(searchResult.locator('.lucide-check')).toBeVisible();

  // Click again to remove
  await searchResult.click();

  // Verify it's REMOVED from the grid
  await expect(grid.getByText(albumText)).not.toBeVisible();

  // Verify green checkmark is GONE
  await expect(searchResult.locator('.lucide-check')).not.toBeVisible();
});
