import { test } from '@playwright/test';

/**
 * Step 2 of the setup wizard. Fills step 1 with valid data, advances,
 * then screenshots the company-details surface so we can eyeball the
 * validation button height + address-validation parity with the `*`
 * marks.
 */
test('setup wizard step 2 — visual verification', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  await page.goto('http://localhost:4200/setup', { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  // Fill step 1 with values that pass every validator. Inputs are
  // selected by their autocomplete attribute (real DOM attribute on
  // the underlying <input>, since formControlName lives on the
  // wrapping <app-input>).
  await page.locator('input[autocomplete="given-name"]').fill('Demo');
  await page.locator('input[autocomplete="family-name"]').fill('User');
  await page.locator('input[autocomplete="email"]').fill('demo@local');
  await page.locator('input[autocomplete="new-password"]').fill('Demo1234');
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(1500);

  await page.screenshot({ path: 'e2e/screenshots/setup-step2.png', fullPage: true });
  const card = page.locator('.auth-card').first();
  if (await card.isVisible()) {
    await card.screenshot({ path: 'e2e/screenshots/setup-step2-card.png' });
  }
});
