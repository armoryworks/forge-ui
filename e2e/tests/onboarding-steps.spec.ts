import { test } from '@playwright/test';
import { loginViaApi, SEED_PASSWORD } from '../helpers/auth.helper';

test('screenshot all onboarding steps', async ({ page }) => {
  await loginViaApi(page, 'admin@qbengineer.local', SEED_PASSWORD);
  await page.goto('http://localhost:4200/onboarding');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'e2e/screenshots/onboarding-step1.png' });

  // Click Continue to advance steps (without filling required fields — just screenshots)
  const continueBtn = page.locator('button').filter({ hasText: /continue/i }).first();

  for (let step = 2; step <= 7; step++) {
    await continueBtn.click({ force: true }).catch(() => {});
    await page.waitForTimeout(700);
    await page.screenshot({ path: `e2e/screenshots/onboarding-step${step}.png` });
  }
});
