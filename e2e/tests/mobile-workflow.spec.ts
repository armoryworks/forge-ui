import { test, expect } from '@playwright/test';

import { loginViaApi, SEED_PASSWORD } from '../helpers/auth.helper';

test.describe('Mobile Workflow', () => {
  test('mobile home and clock pages load successfully', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();

    // Login
    await loginViaApi(page, 'admin@qbengineer.local', SEED_PASSWORD);

    // Navigate to mobile home
    await page.goto('/m/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Verify mobile home loaded
    await expect(page).toHaveURL(/\/m/);

    // Verify greeting or home content is visible
    const homeContent = page.locator('[class*="greeting"], [class*="welcome"], [class*="home"], [class*="mobile"]');
    await expect(homeContent.first()).toBeVisible({ timeout: 10_000 });

    // Navigate to mobile clock page
    await page.goto('/m/clock', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Verify clock page loaded
    await expect(page).toHaveURL(/\/m\/clock/);

    // Verify clock content is visible
    const clockContent = page.locator('[class*="clock"], [class*="timer"], [class*="status"], button');
    await expect(clockContent.first()).toBeVisible({ timeout: 10_000 });

    await context.close();
  });
});
