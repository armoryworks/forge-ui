import { test, expect } from '@playwright/test';
import { loginViaApi, SEED_PASSWORD } from '../helpers/auth.helper';

const BASE_URL = 'http://localhost:4200';

/**
 * Pre-beta — Full create-and-complete coverage of the new-part flow with
 * the axis-based fork dialog.
 *
 * The fork dialog now answers four questions (procurement → inventory class
 * → item kind → mode). The express form fills name + cost (the legacy
 * partType + material fields were retired). Save promotes the part and
 * lands back on the list view.
 */

test.describe('New Part — full save-and-complete (axis fork)', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaApi(page, 'admin@forge.local', SEED_PASSWORD);
  });

  test('Buy + Raw express: name + cost completes and lists', async ({ page }) => {
    const uniqueName = `e2e-buy-raw-${Date.now()}`;

    await page.goto(`${BASE_URL}/parts`, { waitUntil: 'networkidle' });
    await page.locator('[data-testid="new-part-btn"]').click();
    await page.locator('[data-testid="fork-procurement-Buy"]').click();
    await page.locator('[data-testid="fork-inventory-class-Raw"]').click();
    await expect(page.locator('[data-testid="fork-mode-express"]')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('[data-testid="fork-continue"]').click();

    // Express form mounts (URL is /parts/new?runId=… pre-materialization)
    await page.waitForURL(/\/parts\/(new|\d+)\?.*workflow=part-buy-raw-v1/, { timeout: 15000 });
    await expect(page.locator('[data-testid="part-express-form"]')).toBeVisible();

    // Material-flavored inputs need explicit focus before fill — Playwright's
    // bare .fill() doesn't reliably trigger Angular Material's binding
    // pipeline on first interaction (real users naturally click first).
    const nameInput = page.locator('[data-testid="express-name"] input');
    await nameInput.click();
    await nameInput.fill(uniqueName);
    const costInput = page.locator('[data-testid="express-manual-override"] input');
    await costInput.click();
    await costInput.fill('1.50');
    await costInput.press('Tab');
    await page.waitForTimeout(300);

    const saveBtn = page.locator('[data-testid="express-save-btn"]');
    await expect(saveBtn).toBeEnabled({ timeout: 5000 });
    await saveBtn.click();

    // Lands back on /parts list
    await page.waitForURL(/\/parts(\?|$)/, { timeout: 15000 });

    // The new part appears in the list
    await expect(page.locator('text=' + uniqueName).first()).toBeVisible({ timeout: 10000 });
  });

  test('Buy + Raw express: empty cost is blocked PRE-submit (form invalid)', async ({ page }) => {
    await page.goto(`${BASE_URL}/parts`, { waitUntil: 'networkidle' });
    await page.locator('[data-testid="new-part-btn"]').click();
    await page.locator('[data-testid="fork-procurement-Buy"]').click();
    await page.locator('[data-testid="fork-inventory-class-Raw"]').click();
    await page.locator('[data-testid="fork-continue"]').click();
    await page.waitForURL(/\/parts\/(new|\d+)\?.*workflow=part-buy-raw-v1/, { timeout: 15000 });

    const nameInput = page.locator('[data-testid="express-name"] input');
    await nameInput.click();
    await nameInput.fill(`e2e-nocost-${Date.now()}`);
    await nameInput.press('Tab');

    // Save button should be disabled (form invalid because cost required)
    await expect(page.locator('[data-testid="express-save-btn"]')).toBeDisabled();
  });

  test('Buy + Raw express: empty name is blocked PRE-submit (form invalid)', async ({ page }) => {
    await page.goto(`${BASE_URL}/parts`, { waitUntil: 'networkidle' });
    await page.locator('[data-testid="new-part-btn"]').click();
    await page.locator('[data-testid="fork-procurement-Buy"]').click();
    await page.locator('[data-testid="fork-inventory-class-Raw"]').click();
    await page.locator('[data-testid="fork-continue"]').click();
    await page.waitForURL(/\/parts\/(new|\d+)\?.*workflow=part-buy-raw-v1/, { timeout: 15000 });

    const costInput = page.locator('[data-testid="express-manual-override"] input');
    await costInput.click();
    await costInput.fill('1.00');
    await costInput.press('Tab');

    // Save button should be disabled (form invalid because name required)
    await expect(page.locator('[data-testid="express-save-btn"]')).toBeDisabled();
  });
});
