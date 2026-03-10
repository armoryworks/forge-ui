import { test, expect } from '@playwright/test';

test.describe('Loading Overlay', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:4200/dev-tools/loading');
    await expect(page.locator('.demo-content')).toBeVisible({ timeout: 10000 });
    await page.evaluate(() => document.querySelector('vite-error-overlay')?.remove());
  });

  test('single global overlay — 2s', async ({ page }) => {
    await page.click('button:text-is("2s — \\"Loading...\\"")');
    const overlay = page.locator('.loading-overlay');
    await expect(overlay).toBeVisible({ timeout: 1000 });

    await expect(page.locator('.loading-overlay__svg')).toBeVisible();
    await expect(page.locator('.loading-overlay__cause')).toContainText('Loading...');

    await expect(overlay).not.toBeVisible({ timeout: 4000 });
  });

  test('all-at-once — 3 messages visible simultaneously', async ({ page }) => {
    await page.click('button:has-text("all at once")');

    // All 3 causes should appear immediately
    await expect(page.locator('.loading-overlay__cause')).toHaveCount(3, { timeout: 1000 });
    await expect(page.locator('.loading-overlay__cause').nth(0)).toContainText('Loading parts...');
    await expect(page.locator('.loading-overlay__cause').nth(1)).toContainText('Loading inventory...');
    await expect(page.locator('.loading-overlay__cause').nth(2)).toContainText('Syncing data...');

    // After 2s, first cause exits — 2 remain active (+ 1 exiting briefly)
    await page.waitForTimeout(2200);
    const activeCauses = page.locator('.loading-overlay__cause:not(.loading-overlay__cause--exit-left):not(.loading-overlay__cause--exit-right)');
    await expect(activeCauses).toHaveCount(2, { timeout: 1000 });

    // Overlay fully dismissed after all causes complete
    const overlay = page.locator('.loading-overlay');
    await expect(overlay).not.toBeVisible({ timeout: 4000 });
  });

  test('staggered — messages appear and exit independently', async ({ page }) => {
    await page.click('button:has-text("staggered")');

    // First cause appears immediately
    await expect(page.locator('.loading-overlay__cause')).toHaveCount(1, { timeout: 1000 });

    // Second cause joins at ~800ms
    await expect(page.locator('.loading-overlay__cause')).toHaveCount(2, { timeout: 2000 });

    // Overlay fully dismissed
    const overlay = page.locator('.loading-overlay');
    await expect(overlay).not.toBeVisible({ timeout: 6000 });
  });

  test('block-level loading toggles', async ({ page }) => {
    await page.click('button:has-text("Toggle Block A")');
    const blockA = page.locator('.demo-block').first();
    await expect(blockA.locator('[style*="position: absolute"]')).toBeVisible({ timeout: 1000 });

    await page.click('button:has-text("Toggle Block A")');
    await expect(blockA.locator('[style*="position: absolute"]')).not.toBeVisible({ timeout: 1000 });
  });

  test('no performance regression — rapid toggling', async ({ page }) => {
    for (let i = 0; i < 3; i++) {
      await page.click('button:has-text("all at once")');
      await page.waitForTimeout(500);
    }

    await page.waitForTimeout(6000);

    const overlay = page.locator('.loading-overlay');
    await expect(overlay).not.toBeVisible({ timeout: 5000 });

    const heading = page.locator('text=Loading Demo');
    await expect(heading).toBeVisible();
  });
});
