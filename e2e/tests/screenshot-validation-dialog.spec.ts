import { test, request } from '@playwright/test';
import { SEED_PASSWORD } from '../helpers/auth.helper';

const BASE_URL = 'http://localhost:4200';
const API_BASE = 'http://localhost:5000/api/v1/';

test('screenshot dialog validation button (new job dialog)', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
  const page = await context.newPage();

  const apiContext = await request.newContext({ baseURL: API_BASE });
  const response = await apiContext.post('auth/login', {
    data: { email: 'admin@qbengineer.local', password: SEED_PASSWORD },
  });
  if (!response.ok()) throw new Error(`Login failed: ${response.status()}`);
  const loginData = await response.json();
  await apiContext.dispose();

  await page.goto(BASE_URL, { waitUntil: 'commit' });
  await page.evaluate(
    ({ token, user }) => {
      localStorage.setItem('qbe-token', token);
      localStorage.setItem('qbe-user', JSON.stringify(user));
      localStorage.setItem('language', 'en');
    },
    { token: loginData.token, user: loginData.user },
  );

  await page.goto(`${BASE_URL}/kanban`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Try to open the job create dialog — usually "New Job" button
  const newJobBtn = page.locator('button:has-text("New Job")').first();
  if (await newJobBtn.count() > 0) {
    await newJobBtn.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'e2e/screenshots/dialog-validation-initial.png', fullPage: false });

    // Click the validation icon (inside the dialog footer)
    const validationBtn = page.locator('.validation-button__trigger').first();
    if (await validationBtn.count() > 0) {
      await validationBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: 'e2e/screenshots/dialog-validation-open.png', fullPage: false });
    }
  }

  await context.close();
});
