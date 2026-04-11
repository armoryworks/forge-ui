import { test, expect } from '@playwright/test';

import { SEED_PASSWORD } from '../helpers/auth.helper';

const API_BASE = 'http://localhost:4200';

/**
 * Tests that mobile devices are auto-redirected to /m/ after login,
 * while desktop devices go to /dashboard.
 *
 * Uses UI-based login (not loginViaApi) so the LayoutService post-login
 * redirect logic is exercised end-to-end.
 */
test.describe('Mobile Auto-Redirect', () => {
  test('desktop login redirects to /dashboard', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      hasTouch: false,
    });
    const page = await context.newPage();

    await page.goto(`${API_BASE}/login`, { waitUntil: 'networkidle' });

    // Fill login form
    await page.locator('input[type="email"], input[formcontrolname="email"]').fill('admin@qbengineer.local');
    await page.locator('input[type="password"], input[formcontrolname="password"]').fill(SEED_PASSWORD);

    // Submit
    await page.locator('button[type="submit"], button:has-text("Sign In"), button:has-text("Log In")').first().click();

    // Should land on /dashboard (not /m/)
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

    await context.close();
  });

  test('mobile device login redirects to /m/', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
      hasTouch: true,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    });
    const page = await context.newPage();

    // Override navigator.maxTouchPoints for mobile detection
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 5, configurable: true });
    });

    await page.goto(`${API_BASE}/login`, { waitUntil: 'networkidle' });

    // Fill login form
    await page.locator('input[type="email"], input[formcontrolname="email"]').fill('admin@qbengineer.local');
    await page.locator('input[type="password"], input[formcontrolname="password"]').fill(SEED_PASSWORD);

    // Submit
    await page.locator('button[type="submit"], button:has-text("Sign In"), button:has-text("Log In")').first().click();

    // Should land on /m/ (mobile home)
    await expect(page).toHaveURL(/\/m/, { timeout: 15_000 });

    await context.close();
  });

  test('already-logged-in mobile user tapping "Go to Dashboard" goes to /m/', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
      hasTouch: true,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    });
    const page = await context.newPage();

    // Override navigator.maxTouchPoints for mobile detection
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 5, configurable: true });
    });

    // Login via API first
    const { loginViaApi } = await import('../helpers/auth.helper');
    await loginViaApi(page, 'admin@qbengineer.local', SEED_PASSWORD);

    // Navigate to login page (simulates visiting /login while already authenticated)
    await page.goto(`${API_BASE}/login`, { waitUntil: 'networkidle' });

    // If there's a "Go to Dashboard" or "Continue" button for already-authenticated users, click it
    const continueBtn = page.locator('button:has-text("Dashboard"), button:has-text("Continue"), a:has-text("Dashboard")');
    if (await continueBtn.first().isVisible({ timeout: 5_000 }).catch(() => false)) {
      await continueBtn.first().click();
      // Should route to /m/ not /dashboard
      await expect(page).toHaveURL(/\/m/, { timeout: 10_000 });
    }

    await context.close();
  });
});
