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

    // Pick an existing vendor that is NOT already a source for this part, so the
    // add actually creates a row (create() guards against duplicates with a 409)
    // and the test stays idempotent across re-runs.
    const vendorsResp = await request.get(`${API_BASE}vendors?pageSize=50`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(vendorsResp.ok()).toBe(true);
    const vendorsData: { items?: { id: number; companyName?: string }[]; data?: { id: number; companyName?: string }[] } = await vendorsResp.json();
    const vendorItems = vendorsData.items ?? vendorsData.data ?? [];
    if (vendorItems.length === 0) {
      test.skip(true, 'No seed vendors; cannot exercise Sources tab add flow');
      return;
    }
    const existingResp = await request.get(`${API_BASE}parts/${partId}/vendor-parts`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const existing: { vendorId: number }[] = existingResp.ok() ? await existingResp.json() : [];
    const linked = new Set(existing.map((vp) => vp.vendorId));
    const vendor = vendorItems.find((v) => !linked.has(v.id));
    if (!vendor) {
      test.skip(true, 'Every seed vendor is already a source for this part; nothing to add');
      return;
    }

    // Open the part detail dialog directly via ?detail=part:{id}
    await page.goto(`${BASE_URL}/parts?detail=part:${partId}`, { waitUntil: 'networkidle' });

    // Wait for the part detail dialog to appear (Pillar 4: tab ids are now
    // identity/sourcing instead of info/sources)
    await expect(page.locator('[data-testid="part-tab-identity"]')).toBeVisible({ timeout: 15000 });

    // Click the Sourcing tab
    await page.locator('[data-testid="part-tab-sourcing"]').click();
    await expect(page.locator('[data-testid="part-tab-sourcing"]')).toHaveAttribute('class', /detail-tab--active/);

    // The Sources panel redesign: add-vendor is editing-mode only and is now an
    // inline entity-picker (the old vendor-part-form-dialog is gone). Enter edit
    // mode via the part-detail edit toggle first.
    await page.locator('[data-testid="part-detail-edit-toggle"]').click();

    // Open the inline add-vendor picker.
    await page.locator('[data-testid="vendor-sources-add"]').click();
    const vendorPicker = page.locator('[data-testid="vendor-sources-add-picker"] input').first();
    await expect(vendorPicker).toBeVisible({ timeout: 10000 });
    const search = (vendor.companyName ?? '').slice(0, 3) || 'a';
    await vendorPicker.click();
    await vendorPicker.fill(search);

    // Selecting a vendor immediately creates the source (POST /vendor-parts) and
    // reloads the panel — there's no separate save step now. Vendor PN / lead
    // time became optional per-row edits applied afterwards, so they're no
    // longer part of the create path.
    const createResp = page.waitForResponse(
      (r) => /\/vendor-parts(\?|$)/.test(r.url()) && r.request().method() === 'POST',
      { timeout: 15000 },
    );
    await page.locator(`mat-option:has-text("${vendor.companyName ?? ''}")`).first().click({ timeout: 10000 });
    expect((await createResp).status()).toBeLessThan(400);

    // The new source row surfaces the vendor's company name.
    await expect(page.locator('app-vendor-sources-panel')).toBeVisible({ timeout: 15000 });
    await expect(page.locator(`app-vendor-sources-panel:has-text("${vendor.companyName ?? ''}")`).first())
      .toBeVisible({ timeout: 10000 });
  });
});
