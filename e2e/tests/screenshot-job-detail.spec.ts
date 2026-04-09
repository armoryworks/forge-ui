import { test, request } from '@playwright/test';
import { SEED_PASSWORD } from '../helpers/auth.helper';

const BASE_URL = 'http://localhost:4200';
const API_BASE = 'http://localhost:5000/api/v1/';

test('screenshot job detail dialog', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const page = await context.newPage();

  const apiContext = await request.newContext({ baseURL: API_BASE });
  const response = await apiContext.post('auth/login', {
    data: { email: 'admin@qbengineer.local', password: SEED_PASSWORD },
  });
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

  await page.goto(`${BASE_URL}/backlog`, { waitUntil: 'networkidle' });
  // Wait for data rows to load
  await page.waitForSelector('td', { timeout: 10000 }).catch(() => null);
  await page.waitForTimeout(2000);

  // Click the first data row (tbody tr)
  const row = page.locator('tbody tr').first();
  if (await row.count() > 0) {
    await row.click();
    await page.waitForSelector('app-job-detail-panel', { timeout: 5000 }).catch(() => null);
    await page.waitForTimeout(1500);
  }

  await page.screenshot({ path: `e2e/screenshots/job-detail-all-tab.png`, fullPage: false });

  // Click the CONVERSATION tab
  const convBtn = page.locator('.jd-filter-btn', { hasText: 'Conversation' });
  if (await convBtn.count() > 0) {
    await convBtn.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: `e2e/screenshots/job-detail-conversation-tab.png`, fullPage: false });
  }

  // Click the NOTES tab
  const notesBtn = page.locator('.jd-filter-btn', { hasText: 'Notes' });
  if (await notesBtn.count() > 0) {
    await notesBtn.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: `e2e/screenshots/job-detail-notes-tab.png`, fullPage: false });
  }
  await context.close();
});
