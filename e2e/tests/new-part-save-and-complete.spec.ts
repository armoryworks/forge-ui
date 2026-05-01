import { test, expect } from '@playwright/test';
import { loginViaApi, SEED_PASSWORD } from '../helpers/auth.helper';

const BASE_URL = 'http://localhost:4200';

/**
 * Full create-and-complete coverage of the new-part flow per type.
 *
 * The earlier Phase 5 / Phase 6 specs only verified that the fork dialog
 * routed to the correct workflow. This spec actually fills the form, hits
 * Save, and asserts the entity persists (navigates to /parts list and the
 * row is present). Catches the classes of bug the user just hit:
 *   • Required gate fields hidden by the form
 *   • Validation error messages that don't say what's missing
 *   • Save click that silently no-ops
 */

test.describe('New Part — full save-and-complete', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaApi(page, 'admin@qbengineer.local', SEED_PASSWORD);
  });

  test('Raw Material express: name + material + cost completes and lists', async ({ page }) => {
    const uniqueName = `e2e-raw-${Date.now()}`;

    await page.goto(`${BASE_URL}/parts`, { waitUntil: 'networkidle' });
    await page.locator('[data-testid="new-part-btn"]').click();
    await page.locator('[data-testid="fork-type-RawMaterial"]').click();
    await expect(page.locator('[data-testid="fork-express"]')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('[data-testid="fork-continue"]').click();

    // Express form mounts (URL is /parts/new?runId=… pre-materialization)
    await page.waitForURL(/\/parts\/(new|\d+)\?.*workflow=part-raw-material-express-v1/, { timeout: 15000 });
    await expect(page.locator('[data-testid="part-express-form"]')).toBeVisible();

    // Material field MUST be visible for Raw Material (the previous bug
    // hid it, blocking the hasBasics gate forever).
    const materialField = page.locator('[data-testid="express-material"]');
    await expect(materialField).toBeVisible();

    // Material-flavored inputs need explicit focus before fill — Playwright's
    // bare .fill() doesn't reliably trigger Angular Material's binding
    // pipeline on first interaction (real users naturally click first).
    const nameInput = page.locator('[data-testid="express-name"] input');
    await nameInput.click();
    await nameInput.fill(uniqueName);
    const matInput = page.locator('[data-testid="express-material"] input');
    await matInput.click();
    await matInput.fill('Polyethylene HDPE');
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

  test('Raw Material express: empty material is blocked PRE-submit (form invalid)', async ({ page }) => {
    await page.goto(`${BASE_URL}/parts`, { waitUntil: 'networkidle' });
    await page.locator('[data-testid="new-part-btn"]').click();
    await page.locator('[data-testid="fork-type-RawMaterial"]').click();
    await page.locator('[data-testid="fork-continue"]').click();
    await page.waitForURL(/\/parts\/(new|\d+)\?.*workflow=part-raw-material-express-v1/, { timeout: 15000 });

    const nameInput = page.locator('[data-testid="express-name"] input');
    await nameInput.click();
    await nameInput.fill(`e2e-blocked-${Date.now()}`);
    const costInput = page.locator('[data-testid="express-manual-override"] input');
    await costInput.click();
    await costInput.fill('1.00');
    await costInput.press('Tab');

    // Save button should be disabled (form invalid because material required)
    await expect(page.locator('[data-testid="express-save-btn"]')).toBeDisabled();
  });

  test('Raw Material express: empty cost is blocked PRE-submit (form invalid)', async ({ page }) => {
    await page.goto(`${BASE_URL}/parts`, { waitUntil: 'networkidle' });
    await page.locator('[data-testid="new-part-btn"]').click();
    await page.locator('[data-testid="fork-type-RawMaterial"]').click();
    await page.locator('[data-testid="fork-continue"]').click();
    await page.waitForURL(/\/parts\/(new|\d+)\?.*workflow=part-raw-material-express-v1/, { timeout: 15000 });

    const nameInput = page.locator('[data-testid="express-name"] input');
    await nameInput.click();
    await nameInput.fill(`e2e-nocost-${Date.now()}`);
    const matInput = page.locator('[data-testid="express-material"] input');
    await matInput.click();
    await matInput.fill('Steel');
    await matInput.press('Tab');

    // Save button should be disabled (form invalid because cost required)
    await expect(page.locator('[data-testid="express-save-btn"]')).toBeDisabled();
  });
});
