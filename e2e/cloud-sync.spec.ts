import { test, expect } from '@playwright/test';

// We use a high timeout for these tests as they involve multiple network mocks and state changes
test.setTimeout(60000);

test.describe('Cloud Sync', () => {
  const FAKE_USER_ID = 'user-123';
  const FAKE_EMAIL = 'test@example.com';
  const SUPABASE_REST_URL = '**/rest/v1/albumshelf_items*';

  test.beforeEach(async ({ page }) => {
    // Mock Supabase Config
    await page.addInitScript(() => {
      (window as any).NEXT_PUBLIC_SUPABASE_URL = 'https://fake.supabase.co';
      (window as any).NEXT_PUBLIC_SUPABASE_ANON_KEY = 'fake-key';
    });

    // Mock Supabase Auth
    await page.route('**/auth/v1/token?grant_type=password', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'fake-access-token',
          refresh_token: 'fake-refresh-token',
          expires_in: 3600,
          user: { id: FAKE_USER_ID, email: FAKE_EMAIL },
        }),
      });
    });

    await page.route('**/auth/v1/user', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: FAKE_USER_ID, email: FAKE_EMAIL }),
      });
    });
  });

  test('should automatically pull newer cloud data upon sign-in', async ({ page }) => {
    const newerTimestamp = Date.now() + 10000;
    const cloudData = {
      folders: [
        {
          id: 'folder-cloud',
          name: 'CLOUD COLLECTION',
          parentId: null,
          albums: [],
          subfolders: [],
          isExpanded: true,
        },
      ],
      lastUpdated: newerTimestamp,
      streamingProvider: 'deezer',
      theme: 'industrial',
    };

    // Mock cloud data response
    await page.route(SUPABASE_REST_URL, async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([{ data: cloudData, updated_at: new Date().toISOString() }]),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('./');

    // Close first-time setup if it appears
    const setupClose = page.getByRole('button', { name: 'Close' });
    if (await setupClose.isVisible()) {
      await setupClose.click();
    } else {
      // Fallback: wait a bit and check again, or just try to continue
      await page.waitForTimeout(1000);
      if (await setupClose.isVisible()) {
        await setupClose.click();
      }
    }

    // Open account panel
    const accountButton = page.getByRole('button', { name: /ACCOUNT/ });
    await accountButton.click();
    await page.getByPlaceholder('EMAIL').fill(FAKE_EMAIL);
    await page.getByPlaceholder('PASSWORD').fill('any-password');
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Check for success message
    await expect(page.locator('text=LOADED YOUR CLOUD LIBRARY')).toBeVisible();

    // Verify cloud folder is present in the UI
    await expect(page.locator('text=CLOUD COLLECTION')).toBeVisible();
  });

  test('should automatically push local changes to cloud while signed in', async ({ page }) => {
    // Start with empty cloud
    await page.route(SUPABASE_REST_URL, async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
      } else if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON();
        expect(body.user_id).toBe(FAKE_USER_ID);
        expect(body.data.folders[0].name).toBe('NEW LOCAL FOLDER');
        await route.fulfill({ status: 204 });
      }
    });

    await page.goto('./');
    const setupClose2 = page.getByRole('button', { name: 'Close' });
    if (await setupClose2.isVisible()) {
      await setupClose2.click();
    }

    // Sign in
    await page.getByRole('button', { name: /ACCOUNT/ }).click();
    await page.getByPlaceholder('EMAIL').fill(FAKE_EMAIL);
    await page.getByPlaceholder('PASSWORD').fill('any-password');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.locator('text=Signed in.')).toBeVisible();

    // Close the account dialog
    await page.getByRole('button', { name: 'Close' }).last().click();
    await expect(page.getByRole('dialog')).toBeHidden();

    // Create a new folder
    const createBtn = page.getByRole('button', { name: 'Create collection' }).first();
    await createBtn.waitFor({ state: 'visible' });
    await createBtn.click();
    await page.getByPlaceholder('Collection name').fill('NEW LOCAL FOLDER');
    await page.keyboard.press('Enter');

    // Wait for the debounced auto-push (2 seconds in hook)
    // We expect the POST mock to be called and verified
    const response = await page.waitForResponse(response =>
      response.url().includes('/rest/v1/albumshelf_items') && response.request().method() === 'POST'
    );

    const postData = response.request().postDataJSON();
    expect(postData.data.folders[0].name).toBe('NEW LOCAL FOLDER');
  });

  test('should push local data to cloud upon sign-up', async ({ page }) => {
    // Mock Sign Up
    await page.route('**/auth/v1/signup', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          session: {
            access_token: 'new-access-token',
            refresh_token: 'new-refresh-token',
            expires_in: 3600,
            user: { id: 'new-user-456', email: 'new@example.com' },
          }
        }),
      });
    });

    // Mock initial empty cloud check
    await page.route(SUPABASE_REST_URL, async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
      } else if (route.request().method() === 'POST') {
        await route.fulfill({ status: 204 });
      }
    });

    await page.goto('./');
    await page.getByRole('button', { name: 'Close' }).click();

    // Create local data FIRST
    const createBtn2 = page.getByRole('button', { name: 'Create collection' }).first();
    await createBtn2.waitFor({ state: 'visible' });
    await createBtn2.click();
    await page.getByPlaceholder('Collection name').fill('EXISTING LOCAL FOLDER');
    await page.keyboard.press('Enter');

    // Sign up
    await page.getByRole('button', { name: /ACCOUNT/ }).click();
    await page.getByRole('button', { name: /Switch to sign up/ }).click();
    await page.getByPlaceholder('EMAIL').fill('new@example.com');
    await page.getByPlaceholder('PASSWORD').fill('new-password');

    // Wait for response and click sign up
    const [response] = await Promise.all([
      page.waitForResponse(response =>
        response.url().includes('/rest/v1/albumshelf_items') &&
        response.request().method() === 'POST' &&
        response.request().postDataJSON().data.folders.some((f: any) => f.name === 'EXISTING LOCAL FOLDER')
      ),
      page.getByRole('button', { name: 'Sign up' }).click()
    ]);

    // Verify initial push triggered by sign up (local has data, cloud is empty)
    await expect(page.locator('text=UPLOADED LOCAL LIBRARY TO CLOUD')).toBeVisible();
    expect(response.status()).toBe(204);
  });
});
