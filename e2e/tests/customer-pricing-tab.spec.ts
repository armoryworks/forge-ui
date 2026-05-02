import { test, expect } from '@playwright/test';
import { loginViaApi, SEED_PASSWORD } from '../helpers/auth.helper';

const BASE_URL = 'http://localhost:4200';
const API_BASE = process.env['SIM_API_BASE'] ?? 'http://localhost:5000/api/v1/';

/**
 * Customer Pricing tab — happy-path coverage.
 *
 * Seeds a customer + a price list (via API) and then drives the UI to add
 * a price entry through the dialog. Asserts the row appears in the table.
 *
 * Skips if no parts / customers are available in the seed (defensive — the
 * Pillar 4 demo seed includes both, but local dev DBs may not).
 */
test.describe('Customer Pricing tab — add entry', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaApi(page, 'admin@qbengineer.local', SEED_PASSWORD);
  });

  test('opens the Pricing tab on a customer and adds a price entry', async ({ page, request }) => {
    const token = await page.evaluate(() => localStorage.getItem('qbe-token'));
    expect(token).toBeTruthy();

    const partsResp = await request.get(`${API_BASE}parts?pageSize=1`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const customersResp = await request.get(`${API_BASE}customers?pageSize=1&isActive=true`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!partsResp.ok() || !customersResp.ok()) {
      test.skip(true, 'Seed data unavailable — skipping pricing tab e2e');
      return;
    }
    const partsData: { items?: { id: number }[]; data?: { id: number }[] } = await partsResp.json();
    const customersData: { items?: { id: number }[]; data?: { id: number }[] } = await customersResp.json();
    const partItems = partsData.items ?? partsData.data ?? [];
    const customerItems = customersData.items ?? customersData.data ?? [];
    if (partItems.length === 0 || customerItems.length === 0) {
      test.skip(true, 'No parts or customers in seed; cannot exercise the pricing tab');
      return;
    }

    const customerId = customerItems[0].id;

    // Ensure CAP-MD-PRICELIST is enabled (default-off in the catalog).
    await request.put(`${API_BASE}capabilities/CAP-MD-PRICELIST/enabled`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { enabled: true },
    });

    // Seed a customer-scoped price list with one entry so the tab has
    // something to render. We do this through the create endpoint so we
    // don't need to drive the (out-of-scope) "create new list" UX.
    const createListResp = await request.post(`${API_BASE}price-lists`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {
        name: `E2E Pricing ${Date.now()}`,
        description: null,
        customerId,
        isDefault: false,
        effectiveFrom: null,
        effectiveTo: null,
        entries: [{ partId: partItems[0].id, unitPrice: 10, minQuantity: 1 }],
      },
    });
    expect(createListResp.ok()).toBe(true);

    // Navigate to the customer's pricing tab.
    await page.goto(`${BASE_URL}/customers/${customerId}/pricing`, { waitUntil: 'networkidle' });

    // The pricing-tab content section should mount.
    await expect(page.locator('[data-testid="price-list-entries-section"]')).toBeVisible({ timeout: 15000 });

    // Click "Add Entry".
    await page.locator('[data-testid="price-list-entry-add-btn"]').first().click();

    // Form dialog should open with the part picker.
    await expect(page.locator('[data-testid="price-list-entry-part"]')).toBeVisible({ timeout: 10000 });

    // Use a different part if there's a second one, otherwise reuse the
    // first (different MinQuantity makes the (list, part, minQty) key unique).
    const partsPickResp = await request.get(`${API_BASE}parts?pageSize=2`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const partsPickData: { items?: { id: number; partNumber?: string }[]; data?: { id: number; partNumber?: string }[] } = await partsPickResp.json();
    const partsPickItems = partsPickData.items ?? partsPickData.data ?? [];
    const targetPart = partsPickItems[1] ?? partsPickItems[0];
    const search = (targetPart.partNumber ?? '').slice(0, 3) || 'a';

    const partInput = page.locator('[data-testid="price-list-entry-part"] input').first();
    await partInput.click();
    await partInput.fill(search);
    await page.locator(`mat-option:has-text("${targetPart.partNumber ?? ''}")`).first().click({ timeout: 10000 });

    // Fill price + min qty.
    await page.locator('[data-testid="price-list-entry-unit-price"] input').click();
    await page.locator('[data-testid="price-list-entry-unit-price"] input').fill('15.75');
    await page.locator('[data-testid="price-list-entry-min-qty"] input').click();
    await page.locator('[data-testid="price-list-entry-min-qty"] input').fill('25');

    // Save.
    const saveBtn = page.locator('[data-testid="price-list-entry-save-btn"]');
    await expect(saveBtn).toBeEnabled({ timeout: 5000 });
    await saveBtn.click();

    // Dialog closes; new row appears.
    await expect(page.locator('app-price-list-entries-table')).toBeVisible({ timeout: 15000 });
    await expect(
      page.locator('app-price-list-entries-table:has-text("15.75"), app-price-list-entries-table:has-text("$15.75")').first(),
    ).toBeVisible({ timeout: 10000 });
  });

  test('creates a new price list via the New Price List dialog and edits its name', async ({ page, request }) => {
    const token = await page.evaluate(() => localStorage.getItem('qbe-token'));
    expect(token).toBeTruthy();

    const customersResp = await request.get(`${API_BASE}customers?pageSize=1&isActive=true`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!customersResp.ok()) {
      test.skip(true, 'No customers in seed; cannot exercise the pricing tab CRUD');
      return;
    }
    const customersData: { items?: { id: number }[]; data?: { id: number }[] } = await customersResp.json();
    const customerItems = customersData.items ?? customersData.data ?? [];
    if (customerItems.length === 0) {
      test.skip(true, 'No customers in seed; cannot exercise the pricing tab CRUD');
      return;
    }
    const customerId = customerItems[0].id;

    // Ensure CAP-MD-PRICELIST is enabled.
    await request.put(`${API_BASE}capabilities/CAP-MD-PRICELIST/enabled`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { enabled: true },
    });

    await page.goto(`${BASE_URL}/customers/${customerId}/pricing`, { waitUntil: 'networkidle' });

    // Click "New price list" → dialog opens.
    await page.locator('[data-testid="price-list-new-btn"]').first().click();
    await expect(page.locator('[data-testid="price-list-name"]')).toBeVisible({ timeout: 10000 });

    const initialName = `E2E PL ${Date.now()}`;
    await page.locator('[data-testid="price-list-name"] input').fill(initialName);

    // Submit creates the list.
    const saveBtn = page.locator('[data-testid="price-list-save-btn"]');
    await expect(saveBtn).toBeEnabled({ timeout: 5000 });
    await saveBtn.click();

    // Dialog closes; the new list is selected and its name appears in the header.
    await expect(page.locator('[data-testid="price-list-entries-section"]')).toBeVisible({ timeout: 15000 });
    await expect(
      page.locator(`[data-testid="price-list-header-name"]:has-text("${initialName}")`),
    ).toBeVisible({ timeout: 10000 });

    // Now click Edit → rename → save → header reflects the new name.
    await page.locator('[data-testid="price-list-edit-btn"]').first().click();
    await expect(page.locator('[data-testid="price-list-name"]')).toBeVisible({ timeout: 10000 });

    const renamed = `${initialName} (edited)`;
    const nameInput = page.locator('[data-testid="price-list-name"] input');
    await nameInput.fill('');
    await nameInput.fill(renamed);

    const saveBtn2 = page.locator('[data-testid="price-list-save-btn"]');
    await expect(saveBtn2).toBeEnabled({ timeout: 5000 });
    await saveBtn2.click();

    await expect(
      page.locator(`[data-testid="price-list-header-name"]:has-text("${renamed}")`),
    ).toBeVisible({ timeout: 10000 });
  });

  /**
   * CSV bulk-import flow — file picker → preview → apply. Mirrors the
   * preview-then-commit convention surveyed in
   * phase-4-output/pricelist-entry-edit-ux.md.
   */
  test('imports price list entries from a CSV via the bulk-import dialog', async ({ page, request }) => {
    const token = await page.evaluate(() => localStorage.getItem('qbe-token'));
    expect(token).toBeTruthy();

    const partsResp = await request.get(`${API_BASE}parts?pageSize=1`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const customersResp = await request.get(`${API_BASE}customers?pageSize=1&isActive=true`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!partsResp.ok() || !customersResp.ok()) {
      test.skip(true, 'Seed data unavailable — skipping bulk import e2e');
      return;
    }
    const partsData: { items?: { id: number; partNumber?: string }[]; data?: { id: number; partNumber?: string }[] } = await partsResp.json();
    const customersData: { items?: { id: number }[]; data?: { id: number }[] } = await customersResp.json();
    const partItems = partsData.items ?? partsData.data ?? [];
    const customerItems = customersData.items ?? customersData.data ?? [];
    if (partItems.length === 0 || customerItems.length === 0) {
      test.skip(true, 'No parts or customers in seed; cannot exercise bulk import');
      return;
    }
    const customerId = customerItems[0].id;
    const partNumber = partItems[0].partNumber;
    if (!partNumber) {
      test.skip(true, 'Seed part has no partNumber; bulk import requires it');
      return;
    }

    // Ensure capability is enabled.
    await request.put(`${API_BASE}capabilities/CAP-MD-PRICELIST/enabled`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { enabled: true },
    });

    // Seed an empty price list to import into. Unique min-quantities below
    // keep the (list, part, minQty) keys distinct.
    const createResp = await request.post(`${API_BASE}price-lists`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: {
        name: `E2E Bulk Import ${Date.now()}`,
        description: null,
        customerId,
        isDefault: false,
        effectiveFrom: null,
        effectiveTo: null,
        entries: [],
      },
    });
    expect(createResp.ok()).toBe(true);

    await page.goto(`${BASE_URL}/customers/${customerId}/pricing`, { waitUntil: 'networkidle' });
    await expect(page.locator('[data-testid="price-list-entries-section"]')).toBeVisible({ timeout: 15000 });

    // Open the bulk-import dialog.
    await page.locator('[data-testid="price-list-bulk-import-btn"]').first().click();
    await expect(page.locator('[data-testid="price-list-entry-bulk-browse-btn"]')).toBeVisible({ timeout: 10000 });

    // Build a tiny CSV referencing the seeded part, with two distinct
    // min-quantities so both rows insert as new entries.
    const csv = `partNumber,unitPrice,minQuantity\n${partNumber},2.50,500\n${partNumber},2.25,1000\n`;
    await page.setInputFiles(
      'app-price-list-entry-bulk-import-dialog input[type="file"]',
      { name: 'import.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) },
    );

    // Preview state appears with our 2 add rows.
    await expect(page.locator('[data-testid="price-list-entry-bulk-preview"]')).toBeVisible({ timeout: 10000 });
    const applyBtn = page.locator('[data-testid="price-list-entry-bulk-apply-btn"]');
    await expect(applyBtn).toBeEnabled({ timeout: 10000 });

    // Apply — dialog closes and entries appear in the parent table.
    await applyBtn.click();
    await expect(page.locator('app-price-list-entries-table')).toBeVisible({ timeout: 15000 });
    await expect(
      page.locator(`app-price-list-entries-table:has-text("${partNumber}")`).first(),
    ).toBeVisible({ timeout: 10000 });
  });
});
