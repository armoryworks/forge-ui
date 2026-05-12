import { test, expect } from '@playwright/test';
import { loginViaApi, SEED_PASSWORD } from '../helpers/auth.helper';

const BASE_URL = 'http://localhost:4200';

/**
 * Pre-beta — axis-based fork dialog.
 *
 * The dialog now answers four questions (procurement → inventory class →
 * item kind → mode) per the audit. Each test exercises one of the 11
 * viable (procurement × inventory) combos plus a mode override path.
 *
 * Auth seeded via API helper. Each flow uses `data-testid` selectors.
 */

test.describe('Workflow Pattern — Part axis-based fork (pre-beta)', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaApi(page, 'admin@forge.local', SEED_PASSWORD);
  });

  test('Buy + Raw default: express recommended → continue → express form mounts', async ({ page }) => {
    await page.goto(`${BASE_URL}/parts`, { waitUntil: 'networkidle' });

    // Click New Part — fork dialog should open with Step 1 visible.
    await page.locator('[data-testid="new-part-btn"]').click();
    await expect(page.locator('[data-testid="fork-step-procurement"]')).toBeVisible();

    // Step 1 — Buy
    await page.locator('[data-testid="fork-procurement-Buy"]').click();
    await expect(page.locator('[data-testid="fork-step-inventory-class"]')).toBeVisible();

    // Step 2 — Raw
    await page.locator('[data-testid="fork-inventory-class-Raw"]').click();

    // Step 4 — Express recommended for B1 (Buy + Raw).
    await expect(page.locator('[data-testid="fork-mode-express"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-testid="fork-mode-guided"]')).toHaveAttribute('aria-pressed', 'false');

    await page.locator('[data-testid="fork-continue"]').click();

    // Workflow page mounts with the buy-raw express definition.
    await page.waitForURL(/\/parts\/(?:new|\d+)\?.*workflow=part-buy-raw-v1/, { timeout: 15000 });
    await expect(page.locator('[data-testid="part-workflow-shell"]')).toBeVisible({ timeout: 10000 });

    await page.screenshot({ path: 'e2e/screenshots/fork-buy-raw-express.png', fullPage: true });
  });

  test('Make + Subassembly default: guided recommended → continue → guided shell with rail', async ({ page }) => {
    await page.goto(`${BASE_URL}/parts`, { waitUntil: 'networkidle' });

    await page.locator('[data-testid="new-part-btn"]').click();
    await page.locator('[data-testid="fork-procurement-Make"]').click();
    await page.locator('[data-testid="fork-inventory-class-Subassembly"]').click();

    // Step 4 — Guided recommended for M2 (Make + Subassembly).
    await expect(page.locator('[data-testid="fork-mode-guided"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-testid="fork-mode-express"]')).toHaveAttribute('aria-pressed', 'false');

    await page.locator('[data-testid="fork-continue"]').click();

    // Guided shell mounts with the make-subassembly definition.
    await page.waitForURL(/\/parts\/(?:new|\d+)\?.*workflow=part-make-subassembly-v1/, { timeout: 15000 });
    await expect(page.locator('[data-testid="part-workflow-shell"]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid="workflow-rail"]')).toBeVisible();

    await page.screenshot({ path: 'e2e/screenshots/fork-make-subassembly-guided.png', fullPage: true });
  });

  test('Phantom Step-1 filters Step-2 to Subassembly + FinishedGood only', async ({ page }) => {
    await page.goto(`${BASE_URL}/parts`, { waitUntil: 'networkidle' });

    await page.locator('[data-testid="new-part-btn"]').click();
    await page.locator('[data-testid="fork-procurement-Phantom"]').click();

    // Phantom + Raw / Phantom + Component / Phantom + Consumable etc. are
    // not viable combos — those buttons must not exist in the DOM.
    await expect(page.locator('[data-testid="fork-inventory-class-Subassembly"]')).toBeVisible();
    await expect(page.locator('[data-testid="fork-inventory-class-FinishedGood"]')).toBeVisible();
    await expect(page.locator('[data-testid="fork-inventory-class-Raw"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="fork-inventory-class-Component"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="fork-inventory-class-Consumable"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="fork-inventory-class-Tool"]')).toHaveCount(0);
  });

  test('Buy + Raw with mode override → guided', async ({ page }) => {
    await page.goto(`${BASE_URL}/parts`, { waitUntil: 'networkidle' });

    await page.locator('[data-testid="new-part-btn"]').click();
    await page.locator('[data-testid="fork-procurement-Buy"]').click();
    await page.locator('[data-testid="fork-inventory-class-Raw"]').click();
    await expect(page.locator('[data-testid="fork-mode-express"]')).toHaveAttribute('aria-pressed', 'true');

    // User overrides to guided.
    await page.locator('[data-testid="fork-mode-guided"]').click();
    await expect(page.locator('[data-testid="fork-mode-guided"]')).toHaveAttribute('aria-pressed', 'true');

    await page.locator('[data-testid="fork-continue"]').click();

    // Definition is still buy-raw (definition keys off the combo, not the mode).
    await page.waitForURL(/\/parts\/(?:new|\d+)\?.*workflow=part-buy-raw-v1/, { timeout: 15000 });
  });
});
