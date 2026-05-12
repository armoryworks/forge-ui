import { test, request } from '@playwright/test';
import { SEED_PASSWORD } from '../helpers/auth.helper';

const BASE_URL = 'http://localhost:4200';
const API_BASE = 'http://localhost:5000/api/v1/';

async function seedAuth(page: any) {
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
}

test('sidebar expanded root', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  await seedAuth(page);
  await page.evaluate(() => localStorage.setItem('forge-sidebar-collapsed', 'false'));
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.locator('aside.sidebar').screenshot({ path: 'e2e/screenshots/sidebar-expanded-root.png' });
  await context.close();
});

test('sidebar expanded admin drilled L2', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  await seedAuth(page);
  await page.evaluate(() => localStorage.setItem('forge-sidebar-collapsed', 'false'));
  await page.goto(`${BASE_URL}/admin`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.locator('aside.sidebar').screenshot({ path: 'e2e/screenshots/sidebar-admin-L2.png' });
  await context.close();
});

test('sidebar expanded admin drilled L3', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  await seedAuth(page);
  await page.evaluate(() => localStorage.setItem('forge-sidebar-collapsed', 'false'));
  await page.goto(`${BASE_URL}/admin/users`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.locator('aside.sidebar').screenshot({ path: 'e2e/screenshots/sidebar-admin-L3-users.png' });
  await context.close();
});

test('sidebar collapsed root', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  await seedAuth(page);
  await page.evaluate(() => localStorage.setItem('forge-sidebar-collapsed', 'true'));
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.locator('aside.sidebar').screenshot({ path: 'e2e/screenshots/sidebar-collapsed-root.png' });
  await context.close();
});

test('sidebar drill-from-user-click expands', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  await seedAuth(page);
  await page.evaluate(() => localStorage.setItem('forge-sidebar-collapsed', 'true'));
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  // Click the 'Sales' group icon while collapsed — should auto-expand + drill.
  // Match by aria-label which is the translated group label.
  await page.locator('aside.sidebar button[aria-label="Sales"]').click();
  await page.waitForTimeout(500);
  await page.locator('aside.sidebar').screenshot({ path: 'e2e/screenshots/sidebar-drill-autoexpand.png' });
  await context.close();
});
