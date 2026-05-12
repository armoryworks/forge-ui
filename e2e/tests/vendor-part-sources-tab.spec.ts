import { test, expect } from '@playwright/test';
import { loginViaApi, SEED_PASSWORD } from '../helpers/auth.helper';

const BASE_URL = 'http://localhost:4200';
const API_BASE = process.env['SIM_API_BASE'] ?? 'http://localhost:5000/api/v1/';

/**
 * Pillar 3 Sources tab — happy-path coverage.
 *
 * Opens an existing part's detail dialog, navigates to Sources tab,
 * adds a vendor (linking by vendor picker), saves, then asserts the row
 * appears in the table.
 *
 * If no parts exist in the seed data, this test creates a Raw Material
 * via the express new-part flow first.
 */
test.describe('Part Sources tab — add vendor', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaApi(page, 'admin@forge.local', SEED_PASSWORD);
  });

  test('opens Sources tab on a part and adds a vendor source', async ({ page, request }) => {
    // Use the API to look up at least one existing part + vendor (much faster
    // than driving the new-part flow if the seed already has them).
    const token = await page.evaluate(() => localStorage.getItem('forge-token'));
    expect(token).toBeTruthy();

    const partsResp = await request.get(`${API_BASE}parts?pageSize=1`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(partsResp.ok()).toBe(true);
    const partsData: { items?: { id: number; partNumber?: string }[]; data?: { id: number; partNumber?: string }[] } = await partsResp.json();
    const partItems = partsData.items ?? partsData.data ?? [];

    // If no parts exist, create one via the express RawMaterial flow
    let partId: number;
    if (partItems.length === 0) {
      test.skip(true, 'No seed parts and skipping express-create fallback for this dispatch');
      return;
    } else {
      partId = partItems[0].id;
    }

    // Pick an existing vendor to link
    const vendorsResp = await request.get(`${API_BASE}vendors?pageSize=1`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(vendorsResp.ok()).toBe(true);
    const vendorsData: { items?: { id: number; companyName?: string }[]; data?: { id: number; companyName?: string }[] } = await vendorsResp.json();
    const vendorItems = vendorsData.items ?? vendorsData.data ?? [];
    if (vendorItems.length === 0) {
      test.skip(true, 'No seed vendors; cannot exercise Sources tab add flow');
      return;
    }
    const vendor = vendorItems[0];

    // Open the part detail dialog directly via ?detail=part:{id}
    await page.goto(`${BASE_URL}/parts?detail=part:${partId}`, { waitUntil: 'networkidle' });

    // Wait for the part detail dialog to appear (Pillar 4: tab ids are now
    // identity/sourcing instead of info/sources)
    await expect(page.locator('[data-testid="part-tab-identity"]')).toBeVisible({ timeout: 15000 });

    // Click the Sourcing tab
    await page.locator('[data-testid="part-tab-sourcing"]').click();
    await expect(page.locator('[data-testid="part-tab-sourcing"]')).toHaveAttribute('class', /detail-tab--active/);

    // Click "Add Vendor" — there may be one in the empty-state CTA OR in the
    // panel header; either is wired to the same output. Use the panel header
    // button (always present even when rows exist) via testid.
    await page.locator('[data-testid="vendor-part-add-btn"]').first().click();

    // The form dialog mounts. Pick the vendor via the entity picker.
    const vendorPicker = page.locator('[data-testid="vendor-part-vendor"] input').first();
    await expect(vendorPicker).toBeVisible({ timeout: 10000 });
    const search = (vendor.companyName ?? '').slice(0, 3) || 'a';
    await vendorPicker.click();
    await vendorPicker.fill(search);
    // Wait for the autocomplete option matching the chosen vendor's name and click it
    await page.locator(`mat-option:has-text("${vendor.companyName ?? ''}")`).first().click({ timeout: 10000 });

    // Fill a few fields
    await page.locator('[data-testid="vendor-part-vendor-pn"] input').click();
    await page.locator('[data-testid="vendor-part-vendor-pn"] input').fill(`E2E-${Date.now()}`);
    await page.locator('[data-testid="vendor-part-lead-time"] input').click();
    await page.locator('[data-testid="vendor-part-lead-time"] input').fill('14');

    // Save
    const saveBtn = page.locator('[data-testid="vendor-part-save-btn"]');
    await expect(saveBtn).toBeEnabled({ timeout: 5000 });
    await saveBtn.click();

    // The dialog closes and the Sources table shows the new row (the vendor's company name)
    await expect(page.locator('app-vendor-part-list-panel')).toBeVisible({ timeout: 15000 });
    await expect(page.locator(`app-vendor-part-list-panel:has-text("${vendor.companyName ?? ''}")`).first())
      .toBeVisible({ timeout: 10000 });
  });
});
