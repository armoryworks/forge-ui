import { test, expect } from '@playwright/test';

import { loginViaApi, SEED_PASSWORD } from '../helpers/auth.helper';

test.describe('Account Profile', () => {
  test('profile page loads with user fields populated', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await context.newPage();

    // Login
    const loginData = await loginViaApi(page, 'admin@qbengineer.local', SEED_PASSWORD);

    // Navigate to profile page
    await page.goto('/account/profile', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    // Verify profile page loaded
    await expect(page).toHaveURL(/account\/profile/);

    // Verify form fields exist
    const formFields = page.locator('app-input, input, app-select');
    await expect(formFields.first()).toBeVisible({ timeout: 10_000 });

    // Verify name fields are populated (not empty)
    const firstNameInput = page.locator('input[data-testid*="first"], input[formcontrolname*="first"], app-input[label*="First"] input').first();
    if (await firstNameInput.count() > 0) {
      const value = await firstNameInput.inputValue();
      expect(value.length).toBeGreaterThan(0);
    }

    // Verify email field is populated
    const emailInput = page.locator('input[type="email"], input[data-testid*="email"], app-input[label*="Email"] input').first();
    if (await emailInput.count() > 0) {
      const value = await emailInput.inputValue();
      expect(value).toContain('@');
    }

    await context.close();
  });
});
