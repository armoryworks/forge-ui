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
    data: { email: 'admin@qbengineer.local', password: SEED_PASSWORD },
  });
  if (!response.ok()) throw new Error(`Login failed: ${response.status()}`);
  const loginData = await response.json();
  await apiContext.dispose();

  // Seed localStorage
  await page.goto(BASE_URL, { waitUntil: 'commit' });
  await page.evaluate(
    ({ token, user }) => {
      localStorage.setItem('qbe-token', token);
      localStorage.setItem('qbe-user', JSON.stringify(user));
    },
    { token: loginData.token, user: loginData.user },
  );

  // Navigate to discovery
  await page.goto(`${BASE_URL}/admin/discovery`, { waitUntil: 'networkidle' });

  // First question should be Q-O1 (headcount)
  const firstQuestion = page.locator('[data-testid="discovery-question"]').first();
  await expect(firstQuestion).toBeVisible({ timeout: 10000 });
  await expect(firstQuestion).toContainText('Q-O1');

  // Pick "1-2" headcount
  await page.locator('input[name="Q-O1"][value="1-2"]').click();
  await page.waitForTimeout(300);
  await page.locator('[data-testid="discovery-next-btn"]').click();

  // Q-O2 (free-text walk-through)
  await expect(firstQuestion).toContainText('Q-O2');
  // Skip free-text — just advance
  await page.locator('[data-testid="discovery-next-btn"]').click();

  // Q-O3 (make / resell)
  await page.locator('input[name="Q-O3"][value="make"]').click();
  await page.waitForTimeout(300);
  await page.locator('[data-testid="discovery-next-btn"]').click();

  // Q-O4 (regulated). Click the radio input directly.
  await page.locator('input[name="Q-O4"][value="no"]').click({ timeout: 5000 });
  await page.waitForTimeout(300);
  await page.locator('[data-testid="discovery-next-btn"]').click();

  // Q-O5 (sites)
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

  await context.close();
});
