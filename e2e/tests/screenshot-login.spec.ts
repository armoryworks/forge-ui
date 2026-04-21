import { test } from '@playwright/test';

const BASE_URL = 'http://localhost:4200';

test('screenshot /login (empty + invalid state)', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
  const page = await context.newPage();

  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  // Crop the login card region
  const card = page.locator('.auth-card').first();
  await card.screenshot({ path: 'e2e/screenshots/login-empty.png' });

  // Click submit trigger — button is disabled so click the validation icon instead
  const validationBtn = page.locator('.validation-button__trigger').first();
  if (await validationBtn.count() > 0) {
    await validationBtn.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'e2e/screenshots/login-validation-open.png', fullPage: true });
  } else {
    await page.screenshot({ path: 'e2e/screenshots/login-no-trigger.png', fullPage: true });
  }

  await context.close();
});
