import { test } from '@playwright/test';

/**
 * Visual verification for the /setup page (first-time-install admin wizard).
 * Runs WITHOUT auth — the page is accessible pre-auth when no admin
 * user exists (setupRequiredGuard lets it through on empty installs).
 */
test('setup wizard step 1 — visual verification', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  await page.goto('http://localhost:4200/setup', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);  // Let any transitions finish.

  await page.screenshot({ path: 'e2e/screenshots/setup-step1.png', fullPage: true });

  // Also screenshot just the auth-card so spacing diffs are easier to read.
  const card = page.locator('.auth-card').first();
  if (await card.isVisible()) {
    await card.screenshot({ path: 'e2e/screenshots/setup-step1-card.png' });
  }
});
