import { test, expect, request } from '@playwright/test';
import { loginViaApi, SEED_PASSWORD } from '../helpers/auth.helper';

const BASE_URL = process.env['SIM_APP_BASE'] ?? 'http://localhost:4200';
const API_BASE = process.env['SIM_API_BASE'] ?? 'http://localhost:5000/api/v1/';

/**
 * Regression for armoryworks/forge#7 — the dashboard "goto" for a PO landed on
 * `/purchase-orders?detail=purchase-order:{id}` but the detail dialog didn't
 * open (auto-open was tied to the list-load HTTP callback, which races the
 * route and doesn't re-run on an already-mounted component). The fix reacts to
 * the `?detail=` query param directly, so landing on the URL opens the dialog.
 */
test.describe('forge#7 — PO detail auto-opens from ?detail= URL', () => {
  test('navigating directly to ?detail=purchase-order:{id} opens the detail dialog', async ({ page }) => {
    await loginViaApi(page, 'admin@forge.local', SEED_PASSWORD);

    // Find any PO id via the API (status-agnostic; the bug was reported on
    // drafts but the auto-open path is the same for every status).
    const token = await page.evaluate(() => localStorage.getItem('forge-token'));
    const api = await request.newContext({ baseURL: API_BASE });
    const resp = await api.get('purchase-orders?pageSize=1', { headers: { Authorization: `Bearer ${token}` } });
    const body = await resp.json();
    const items = body.items ?? body.data ?? [];
    await api.dispose();
    if (items.length === 0) {
      test.skip(true, 'No purchase orders seeded');
      return;
    }
    const poId = items[0].id;

    await page.goto(`${BASE_URL}/purchase-orders?detail=purchase-order:${poId}`, { waitUntil: 'networkidle' });

    // The fix: the detail dialog opens from the URL param without a second nav.
    await expect(page.locator('app-po-detail-dialog')).toBeVisible({ timeout: 15000 });
  });
});
