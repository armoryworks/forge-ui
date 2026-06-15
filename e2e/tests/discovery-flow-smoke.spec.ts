import { test, expect, request } from '@playwright/test';
import { SEED_PASSWORD } from '../helpers/auth.helper';

const BASE_URL = 'http://localhost:4200';
const API_BASE = 'http://localhost:5000/api/v1/';

/**
 * Phase 4 Phase-F — Discovery wizard smoke test. Walks through the opening
 * questions, verifies the live preview surfaces, and lands on the
 * recommendation step. Does NOT apply (avoids mutating install state across
 * test runs).
 */
test('discovery wizard renders, advances steps, and surfaces recommendation', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  // Login via API
  const apiContext = await request.newContext({ baseURL: API_BASE });
  const response = await apiContext.post('auth/login', {
    data: { email: 'admin@forge.local', password: SEED_PASSWORD },
  });
  if (!response.ok()) throw new Error(`Login failed: ${response.status()}`);
  const loginData = await response.json();
  await apiContext.dispose();

  // Seed localStorage
  await page.goto(BASE_URL, { waitUntil: 'commit' });
  await page.evaluate(
    ({ token, user }) => {
      localStorage.setItem('forge-token', token);
      localStorage.setItem('forge-user', JSON.stringify(user));
    },
    { token: loginData.token, user: loginData.user },
  );

  // Navigate to discovery
  await page.goto(`${BASE_URL}/admin/discovery`, { waitUntil: 'networkidle' });

  // The wizard opens on the top-of-funnel fork Q-S1 (added ahead of the Q-O*
  // opening block). Assert by the stable data-question-id rather than the raw
  // code being present in the rendered text.
  const firstQuestion = page.locator('[data-testid="discovery-question"]').first();
  await expect(firstQuestion).toBeVisible({ timeout: 10000 });
  await expect(firstQuestion).toHaveAttribute('data-question-id', 'Q-S1');

  // Q-S1 — pick "products" to fall through to the manufacturing opening
  // questions (Q-O1..Q-O6). "services" routes to Pro Services; "both" → Hybrid.
  await page.locator('input[name="Q-S1"][value="products"]').click();
  await page.waitForTimeout(300);
  await page.locator('[data-testid="discovery-next-btn"]').click();

  // Q-O1 (headcount) — pick "1-2"
  await expect(firstQuestion).toHaveAttribute('data-question-id', 'Q-O1');
  await page.locator('input[name="Q-O1"][value="1-2"]').click();
  await page.waitForTimeout(300);
  await page.locator('[data-testid="discovery-next-btn"]').click();

  // Q-O2 (free-text walk-through)
  await expect(firstQuestion).toHaveAttribute('data-question-id', 'Q-O2');
  // Skip free-text — just advance
  await page.locator('[data-testid="discovery-next-btn"]').click();

  // Q-O3 (make / resell / services) — now MultiChoice, so options render as
  // mat-checkboxes with no name/value; select by the option's label text.
  await expect(firstQuestion).toHaveAttribute('data-question-id', 'Q-O3');
  await page.getByRole('checkbox', { name: /We make physical products/ }).check();
  await page.waitForTimeout(300);
  await page.locator('[data-testid="discovery-next-btn"]').click();

  // Q-O4 (regulated) — also MultiChoice (check-all-that-apply). Pick "none".
  await expect(firstQuestion).toHaveAttribute('data-question-id', 'Q-O4');
  await page.getByRole('checkbox', { name: /none of these apply/i }).check();
  await page.waitForTimeout(300);
  await page.locator('[data-testid="discovery-next-btn"]').click();

  // Q-O5 (sites) — SingleChoice radio.
  await expect(firstQuestion).toHaveAttribute('data-question-id', 'Q-O5');
  await page.locator('input[name="Q-O5"][value="1"]').click();
  await page.waitForTimeout(300);
  await page.locator('[data-testid="discovery-next-btn"]').click();

  // Q-O6 (audit probe — free text, skip)
  await page.locator('[data-testid="discovery-next-btn"]').click();

  // Now branch A questions should show. Verify the live preview surfaced.
  await page.waitForTimeout(1000);
  const livePreview = page.locator('[data-testid="discovery-live-preview"]');
  await expect(livePreview).toBeVisible({ timeout: 5000 });

  // Take a screenshot at this stage.
  await page.screenshot({
    path: 'e2e/screenshots/discovery-mid-flow.png',
    fullPage: true,
  });

  // Click the "Jump to recommendation" link (should be visible after Q-O6).
  const jumpBtn = page.locator('[data-testid="discovery-jump-btn"]');
  if (await jumpBtn.isVisible()) {
    await jumpBtn.click();
    await page.waitForTimeout(1500);
  }

  // Verify the recommendation review step.
  const rec = page.locator('[data-testid="discovery-recommendation"]');
  await expect(rec).toBeVisible({ timeout: 10000 });

  // Take a screenshot of the recommendation review.
  await page.screenshot({
    path: 'e2e/screenshots/discovery-recommendation.png',
    fullPage: true,
  });

  // Phase 4 Phase-H — verify the apply button now opens the shared
  // PresetApplyDialogComponent confirmation modal (instead of mutating
  // immediately). We cancel out so install state isn't modified.
  const applyBtn = page.locator('[data-testid="discovery-apply-btn"]');
  if (await applyBtn.isVisible()) {
    await applyBtn.click();
    const dialog = page.locator('app-preset-apply-dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });
    await page.screenshot({
      path: 'e2e/screenshots/discovery-apply-dialog.png',
      fullPage: false,
    });
    // Cancel — do not mutate install state.
    await page.keyboard.press('Escape');
  }

  await context.close();
});
