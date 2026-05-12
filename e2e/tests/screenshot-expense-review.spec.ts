import { test, request } from '@playwright/test';
import { SEED_PASSWORD } from '../helpers/auth.helper';

const BASE_URL = 'http://localhost:4200';
const API_BASE = 'http://localhost:5000/api/v1/';

test('screenshot expense review dialog (decline modes)', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
  const page = await context.newPage();

  const apiContext = await request.newContext({ baseURL: API_BASE });
  const response = await apiContext.post('auth/login', {
    data: { email: 'admin@forge.local', password: SEED_PASSWORD },
  });
  if (!response.ok()) throw new Error(`Login failed: ${response.status()}`);
  const loginData = await response.json();
  await apiContext.dispose();

  await page.goto(BASE_URL, { waitUntil: 'commit' });
  await page.evaluate(({ token, user }) => {
    localStorage.setItem('forge-token', token);
    localStorage.setItem('forge-user', JSON.stringify(user));
    localStorage.setItem('language', 'en');
  }, { token: loginData.token, user: loginData.user });

  await page.goto(`${BASE_URL}/expenses/approval`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  // Click first row's check icon to open the review dialog
  const firstApproveBtn = page.locator('button.icon-btn--success').first();
  await firstApproveBtn.click();
  await page.waitForTimeout(600);

  // Screenshot dialog with empty note (buttons disabled)
  await page.screenshot({ path: 'e2e/screenshots/expense-review-empty.png', fullPage: false });

  // Type a note exceeding the minimum length
  const noteField = page.locator('textarea').first();
  await noteField.click();
  await noteField.fill('Missing receipt photo — please attach and resubmit.');
  await page.waitForTimeout(400);

  // Screenshot dialog with valid note (buttons enabled, hint green)
  await page.screenshot({ path: 'e2e/screenshots/expense-review-filled.png', fullPage: false });

  await context.close();
});
