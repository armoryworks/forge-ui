import { test, expect, request } from '@playwright/test';

import { loginViaApi, getAuthToken, SEED_PASSWORD } from '../helpers/auth.helper';

const API_BASE = 'http://localhost:5000/api/v1/';

test.describe('Clock Event Workflow', () => {
  test('time tracking page loads and clock status API returns valid data', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await context.newPage();

    // Login
    await loginViaApi(page, 'admin@qbengineer.local', SEED_PASSWORD);

    // Navigate to time tracking
    await page.goto('/time-tracking', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Verify page loaded
    await expect(page).toHaveURL(/time-tracking/);

    // Verify key page elements exist
    const pageContent = page.locator('app-page-layout, app-page-header, [class*="time-tracking"]');
    await expect(pageContent.first()).toBeVisible({ timeout: 10_000 });

    // Verify clock status via API
    const token = await getAuthToken('admin@qbengineer.local', SEED_PASSWORD);
    const apiContext = await request.newContext({
      baseURL: API_BASE,
      extraHTTPHeaders: { Authorization: `Bearer ${token}` },
    });

    const clockStatusRes = await apiContext.get('time-tracking/clock-status');
    expect(clockStatusRes.ok()).toBeTruthy();

    const clockStatus = await clockStatusRes.json();
    expect(clockStatus).toHaveProperty('isClockedIn');

    await apiContext.dispose();
    await context.close();
  });
});
