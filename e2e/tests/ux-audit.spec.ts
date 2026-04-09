import { test, request } from '@playwright/test';
import { SEED_PASSWORD } from '../helpers/auth.helper';

const BASE_URL = 'http://localhost:4200';
const API_BASE = 'http://localhost:5000/api/v1/';

async function loginAndSeedStorage(browser: any) {
  const apiContext = await request.newContext({ baseURL: API_BASE });
  const response = await apiContext.post('auth/login', {
    data: { email: 'admin@qbengineer.local', password: SEED_PASSWORD },
  });

  if (!response.ok()) {
    throw new Error(`Login failed: ${response.status()} ${await response.text()}`);
  }

  const loginData = await response.json();
  await apiContext.dispose();

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  // Seed localStorage
  await page.goto(BASE_URL, { waitUntil: 'commit' });
  await page.evaluate(
    ({ token, user }) => {
      localStorage.setItem('qbe-token', token);
      localStorage.setItem('qbe-user', JSON.stringify(user));
      localStorage.setItem('language', 'en');
    },
    { token: loginData.token, user: loginData.user },
  );

  return { page, context };
}

test('ux-audit-dashboard', async ({ browser }) => {
  const { page, context } = await loginAndSeedStorage(browser);
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'e2e/screenshots/ux-audit-dashboard.png', fullPage: true });
  await context.close();
});

test('ux-audit-kanban', async ({ browser }) => {
  const { page, context } = await loginAndSeedStorage(browser);
  await page.goto(`${BASE_URL}/kanban`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'e2e/screenshots/ux-audit-kanban.png', fullPage: true });
  await context.close();
});

test('ux-audit-job-dialog', async ({ browser }) => {
  const { page, context } = await loginAndSeedStorage(browser);
  await page.goto(`${BASE_URL}/kanban`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Try to find and click the "+ New Job" or "NEW JOB" button
  const newJobBtn = page.locator('button').filter({ hasText: /new job/i }).first();
  if (await newJobBtn.count() > 0) {
    await newJobBtn.click();
    await page.waitForTimeout(1000);
  } else {
    // Try alternative selectors
    const addBtn = page.locator('button').filter({ hasText: /^\+/ }).first();
    if (await addBtn.count() > 0) {
      await addBtn.click();
      await page.waitForTimeout(1000);
    }
  }

  await page.screenshot({ path: 'e2e/screenshots/ux-audit-job-dialog.png', fullPage: true });
  await context.close();
});

test('ux-audit-tax-forms', async ({ browser }) => {
  const { page, context } = await loginAndSeedStorage(browser);
  await page.goto(`${BASE_URL}/account/tax-forms`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'e2e/screenshots/ux-audit-tax-forms.png', fullPage: true });
  await context.close();
});

test('ux-audit-w4', async ({ browser }) => {
  const { page, context } = await loginAndSeedStorage(browser);
  await page.goto(`${BASE_URL}/account/tax-forms`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Click on W-4 row
  const w4Row = page.locator('tr, .form-row, [data-form-type], td').filter({ hasText: /w-?4/i }).first();
  if (await w4Row.count() > 0) {
    await w4Row.click();
    await page.waitForTimeout(1500);
  } else {
    // Try navigating directly
    await page.goto(`${BASE_URL}/account/tax-forms/w4`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
  }

  await page.screenshot({ path: 'e2e/screenshots/ux-audit-w4.png', fullPage: true });
  await context.close();
});

test('ux-audit-backlog', async ({ browser }) => {
  const { page, context } = await loginAndSeedStorage(browser);
  await page.goto(`${BASE_URL}/backlog`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'e2e/screenshots/ux-audit-backlog.png', fullPage: true });
  await context.close();
});

test('ux-audit-settings', async ({ browser }) => {
  const { page, context } = await loginAndSeedStorage(browser);
  await page.goto(`${BASE_URL}/admin/settings`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'e2e/screenshots/ux-audit-settings.png', fullPage: true });
  await context.close();
});

test('ux-audit-planning', async ({ browser }) => {
  const { page, context } = await loginAndSeedStorage(browser);
  await page.goto(`${BASE_URL}/planning`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'e2e/screenshots/ux-audit-planning.png', fullPage: true });
  await context.close();
});
