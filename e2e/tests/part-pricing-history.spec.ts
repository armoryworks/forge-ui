import { test, expect } from '@playwright/test';
import { loginViaApi, SEED_PASSWORD } from '../helpers/auth.helper';

const BASE_URL = 'http://localhost:4200';
const API_BASE = process.env['SIM_API_BASE'] ?? 'http://localhost:5000/api/v1/';

/**
 * Dispatch C — Pricing tab on Part detail surfaces the resolver-current
 * effective price and the chronological history of PartPrice rows. Edit
 * mode lets the user post a new effective price; the server closes out
 * the prior open row.
 */
test.describe('Dispatch C — Part pricing tab', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaApi(page, 'admin@qbengineer.local', SEED_PASSWORD);
  });

  test('opens Pricing tab, shows current price + history table, posts a new effective price', async ({ page, request }) => {
    const token = await page.evaluate(() => localStorage.getItem('qbe-token'));
    expect(token).toBeTruthy();

    // Find any non-Phantom part — Pricing tab is excluded only for Phantom.
    const partsResp = await request.get(`${API_BASE}parts?pageSize=50`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(partsResp.ok()).toBe(true);
    const partsData: { items?: { id: number; procurementSource?: string; inventoryClass?: string }[] } = await partsResp.json();
    const items = partsData.items ?? [];
    const target = items.find(p => p.procurementSource && p.procurementSource !== 'Phantom') ?? items[0];
    if (!target) {
      test.skip(true, 'No seed parts available for pricing-tab verification');
      return;
    }

    await page.goto(`${BASE_URL}/parts?detail=part:${target.id}`, { waitUntil: 'networkidle' });

    // Pricing tab is present for non-Phantom combos.
    await expect(page.locator('[data-testid="part-tab-pricing"]')).toBeVisible({ timeout: 15000 });

    await page.locator('[data-testid="part-tab-pricing"]').click();
    await expect(page.locator('[data-testid="part-tab-pricing"]')).toHaveAttribute(
      'class', /detail-tab--active/,
    );
    await expect.poll(() => page.url(), { timeout: 5000 }).toContain('tab=pricing');

    // The pricing cluster mounts.
    await expect(page.locator('app-part-pricing-cluster')).toBeVisible({ timeout: 10000 });

    // Toggle into edit mode so the add-new-price form is exposed.
    await page.locator('[data-testid="part-detail-edit-toggle"]').click();

    // Fill in the new-price form. The currency input is a CVA wrapper;
    // we reach into the inner numeric input by its data-testid.
    const unitPriceInput = page.locator('[data-testid="part-price-unit-price"] input');
    await expect(unitPriceInput).toBeVisible({ timeout: 10000 });
    await unitPriceInput.fill('19.99');

    // Submit.
    await page.locator('[data-testid="part-price-save-btn"]').click();

    // After save the snackbar fires + the table reloads. Assert the new
    // amount appears somewhere in the cluster.
    await expect(page.locator('app-part-pricing-cluster').getByText(/19[.,]99/)).toBeVisible({
      timeout: 10000,
    });
  });
});
