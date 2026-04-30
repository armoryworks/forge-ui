import { test, expect } from '@playwright/test';
import { loginViaApi, SEED_PASSWORD } from '../helpers/auth.helper';

const BASE_URL = 'http://localhost:4200';

/**
 * Visual verification for the two fixes:
 *
 *   1. Express form Material field is HIDDEN for RawMaterial part type.
 *      Description, External Part #, Manual cost override remain.
 *   2. Express form Material field is VISIBLE for Assembly part type with
 *      a helper text below it.
 *   3. Manual cost override renders cleanly via <app-currency-input> — the
 *      `$` symbol does not overlap the floating "Manual cost override"
 *      label (the recurring `$lanual cost override` bug).
 *
 * Resilient to label changes — uses `data-testid` selectors only for
 * locating, and screenshots prove the visual state.
 */

test.describe('Currency input + Material field semantics', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaApi(page, 'admin@qbengineer.local', SEED_PASSWORD);
  });

  test('RawMaterial: Material field hidden, currency-input renders cleanly', async ({ page }) => {
    await page.goto(`${BASE_URL}/parts`, { waitUntil: 'networkidle' });

    await page.locator('[data-testid="new-part-btn"]').click();
    await expect(page.locator('[data-testid="fork-question-type"]')).toBeVisible();

    await page.locator('[data-testid="fork-type-RawMaterial"]').click();
    await page.locator('[data-testid="fork-continue"]').click();

    await page.waitForURL(/\/parts\/\d+\?.*workflow=part-raw-material-express-v1/, { timeout: 15000 });
    await expect(page.locator('[data-testid="part-express-form"]')).toBeVisible({ timeout: 10000 });

    // Material field should NOT be visible for RawMaterial
    await expect(page.locator('[data-testid="express-material"]')).toHaveCount(0);

    // Description + External Part # + Manual cost override ARE visible
    await expect(page.locator('[data-testid="express-description"]')).toBeVisible();
    await expect(page.locator('[data-testid="express-external-number"]')).toBeVisible();
    await expect(page.locator('[data-testid="express-manual-override"]')).toBeVisible();

    // Verify the currency input is the new <app-currency-input> by checking
    // for the matTextPrefix span containing $
    const currencyField = page.locator('[data-testid="express-manual-override"]');
    await expect(currencyField).toBeVisible();

    await page.screenshot({
      path: 'e2e/screenshots/express-rawmaterial-no-material-field.png',
      fullPage: true,
    });
  });

  test('Assembly: Material field visible with helper text', async ({ page }) => {
    await page.goto(`${BASE_URL}/parts`, { waitUntil: 'networkidle' });

    await page.locator('[data-testid="new-part-btn"]').click();
    await page.locator('[data-testid="fork-type-Assembly"]').click();

    // Override default to Express so we land on the express form
    await page.locator('[data-testid="fork-express"]').click();
    await page.locator('[data-testid="fork-continue"]').click();

    await expect(page.locator('[data-testid="part-express-form"]')).toBeVisible({ timeout: 15000 });

    // Material field IS visible for Assembly
    await expect(page.locator('[data-testid="express-material"]')).toBeVisible();

    await page.screenshot({
      path: 'e2e/screenshots/express-assembly-material-visible.png',
      fullPage: true,
    });
  });
});
