import { test, request } from '@playwright/test';
import { SEED_PASSWORD } from '../helpers/auth.helper';

const BASE_URL = 'http://localhost:4200';
const API_BASE = 'http://localhost:5000/api/v1/';

test('expense create dialog with receipt upload', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
  const page = await context.newPage();

  const apiContext = await request.newContext({ baseURL: API_BASE });
  const loginRes = await apiContext.post('auth/login', {
    data: { email: 'admin@qbengineer.local', password: SEED_PASSWORD },
  });
  const loginData = await loginRes.json();

  // Toggle requireReceipt ON so the gating appears in the screenshot
  await apiContext.put('expenses/settings', {
    headers: { Authorization: `Bearer ${loginData.token}` },
    data: {
      allowSelfApproval: false,
      autoApproveThreshold: null,
      maxAmount: 500,
      requireReceipt: true,
      minDescriptionLength: 10,
    },
  });
  await apiContext.dispose();

  await page.goto(BASE_URL, { waitUntil: 'commit' });
  await page.evaluate(({ token, user }) => {
    localStorage.setItem('qbe-token', token);
    localStorage.setItem('qbe-user', JSON.stringify(user));
    localStorage.setItem('language', 'en');
  }, { token: loginData.token, user: loginData.user });

  await page.goto(`${BASE_URL}/expenses`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  await page.getByTestId('new-expense-btn').click();
  await page.waitForTimeout(800);

  await page.screenshot({ path: 'e2e/screenshots/expense-dialog-empty.png' });

  // Fill amount above max and short description to provoke validation
  await page.getByTestId('expense-amount').locator('input').fill('750');
  await page.getByTestId('expense-description').locator('textarea').fill('short');
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'e2e/screenshots/expense-dialog-invalid.png' });

  // Hover save button to show violation popover
  await page.getByTestId('expense-save-btn').hover();
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'e2e/screenshots/expense-dialog-popover.png' });

  await context.close();
});
