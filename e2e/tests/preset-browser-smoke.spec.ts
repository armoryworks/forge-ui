import { test, expect, request } from '@playwright/test';
import { SEED_PASSWORD } from '../helpers/auth.helper';

const BASE_URL = 'http://localhost:4200';
const API_BASE = 'http://localhost:5000/api/v1/';

/**
 * Phase 4 Phase-G — Preset browser smoke test. Verifies:
 *   1. Browser landing page loads with all 8 preset cards.
 *   2. Click into a preset detail page; deltas + capabilities render.
 *   3. Compare mode selects 2-4 presets and renders the matrix.
 *   4. Custom builder loads and shows catalog defaults.
 *   5. Onboarding banner "Browse presets" navigates to /admin/presets.
 *
 * Does NOT apply (avoids mutating install state across test runs). The
 * actual apply is exercised by the server-side PresetBrowserTests.
 */
test('preset browser renders presets, detail, compare, and custom builder', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  // Login via API
  const apiContext = await request.newContext({ baseURL: API_BASE });
  const response = await apiContext.post('auth/login', {
    data: { email: 'admin@qbengineer.local', password: SEED_PASSWORD },
  });
  if (!response.ok()) throw new Error(`Login failed: ${response.status()}`);
  const loginData = await response.json();
  await apiContext.dispose();

  await page.goto(BASE_URL, { waitUntil: 'commit' });
  await page.evaluate(
    ({ token, user }) => {
      localStorage.setItem('qbe-token', token);
      localStorage.setItem('qbe-user', JSON.stringify(user));
    },
    { token: loginData.token, user: loginData.user },
  );

  // ─── 1. Preset browser landing page ────────────────────────────────────
  await page.goto(`${BASE_URL}/admin/presets`, { waitUntil: 'networkidle' });
  const grid = page.locator('[data-testid="preset-browser-grid"]');
  await expect(grid).toBeVisible({ timeout: 10000 });

  // All 8 cards should render.
  for (const id of ['PRESET-01', 'PRESET-02', 'PRESET-03', 'PRESET-04', 'PRESET-05', 'PRESET-06', 'PRESET-07', 'PRESET-CUSTOM']) {
    await expect(page.locator(`[data-testid="preset-card-${id}"]`)).toBeVisible();
  }

  await page.screenshot({
    path: 'e2e/screenshots/preset-browser.png',
    fullPage: true,
  });

  // ─── 2. Detail page ────────────────────────────────────────────────────
  await page.locator('[data-testid="preset-card-PRESET-04"]').click();
  await page.waitForURL(/\/admin\/presets\/PRESET-04$/);
  await expect(page.locator('[data-testid="preset-detail-stat-count"]')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('[data-testid="preset-detail-apply-btn"]')).toBeVisible();

  await page.screenshot({
    path: 'e2e/screenshots/preset-detail.png',
    fullPage: true,
  });

  // ─── 3. Compare mode ───────────────────────────────────────────────────
  await page.goto(`${BASE_URL}/admin/presets`, { waitUntil: 'networkidle' });
  await page.locator('[data-testid="preset-browser-compare-toggle"]').click();
  await page.locator('[data-testid="preset-card-compare-PRESET-01"]').click();
  await page.locator('[data-testid="preset-card-compare-PRESET-04"]').click();
  await page.locator('[data-testid="preset-card-compare-PRESET-07"]').click();
  await page.locator('[data-testid="preset-browser-run-compare"]').click();
  await page.waitForURL(/\/admin\/presets\/compare/);
  const matrix = page.locator('[data-testid="preset-compare-matrix"]');
  await expect(matrix).toBeVisible({ timeout: 10000 });
  await expect(page.locator('[data-testid="preset-compare-col-PRESET-01"]')).toBeVisible();
  await expect(page.locator('[data-testid="preset-compare-col-PRESET-04"]')).toBeVisible();
  await expect(page.locator('[data-testid="preset-compare-col-PRESET-07"]')).toBeVisible();

  await page.screenshot({
    path: 'e2e/screenshots/preset-compare.png',
    fullPage: true,
  });

  // ─── 4. Custom builder ─────────────────────────────────────────────────
  await page.goto(`${BASE_URL}/admin/presets/custom`, { waitUntil: 'networkidle' });
  await expect(page.locator('[data-testid="preset-custom-capabilities"]')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('[data-testid="preset-custom-apply-btn"]')).toBeVisible();

  await page.screenshot({
    path: 'e2e/screenshots/preset-custom.png',
    fullPage: true,
  });

  // ─── 5. Onboarding banner CTA ──────────────────────────────────────────
  // Navigate to capabilities page; if banner is shown, click "Browse Presets"
  await page.goto(`${BASE_URL}/admin/capabilities`, { waitUntil: 'networkidle' });
  const bannerBtn = page.locator('[data-testid="capability-banner-presets-btn"]');
  if (await bannerBtn.isVisible()) {
    // Verify it's enabled (not disabled like before).
    await expect(bannerBtn).toBeEnabled();
    await bannerBtn.click();
    await page.waitForURL(/\/admin\/presets$/);
    await expect(page.locator('[data-testid="preset-browser-grid"]')).toBeVisible();
  }

  await context.close();
});
