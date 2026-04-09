import { test, request } from '@playwright/test';
import { SEED_PASSWORD } from '../helpers/auth.helper';

const BASE_URL = 'http://localhost:4200';
const API_BASE = 'http://localhost:5000/api/v1/';
const SCREENSHOT_DIR = 'e2e/screenshots';
const VIEWPORT = { width: 1280, height: 800 };
const SCALE = 2;
const SETTLE_MS = 2500;

async function loginAndSeedStorage(page: any, token: string, user: any) {
  await page.goto(BASE_URL, { waitUntil: 'commit' });
  await page.evaluate(
    ({ tok, usr }: { tok: string; usr: any }) => {
      localStorage.setItem('qbe-token', tok);
      localStorage.setItem('qbe-user', JSON.stringify(usr));
      localStorage.setItem('language', 'en');
    },
    { tok: token, usr: user },
  );
}

async function navigateAndSettle(page: any, path: string) {
  await page.goto(`${BASE_URL}${path}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(SETTLE_MS);
}

test.describe('Engineering Audit Screenshots', () => {
  let token: string;
  let user: any;

  test.beforeAll(async () => {
    const apiContext = await request.newContext({ baseURL: API_BASE });
    const response = await apiContext.post('auth/login', {
      data: { email: 'admin@qbengineer.local', password: SEED_PASSWORD },
    });
    if (!response.ok()) {
      throw new Error(`Login failed: ${response.status()} ${await response.text()}`);
    }
    const data = await response.json();
    token = data.token;
    user = data.user;
    await apiContext.dispose();
  });

  test('1 - parts list', async ({ browser }) => {
    const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: SCALE });
    const page = await context.newPage();
    await loginAndSeedStorage(page, token, user);
    await navigateAndSettle(page, '/parts');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/eng-audit-parts.png`, fullPage: true });
    await context.close();
  });

  test('2 - parts detail panel', async ({ browser }) => {
    const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: SCALE });
    const page = await context.newPage();
    await loginAndSeedStorage(page, token, user);
    await navigateAndSettle(page, '/parts');

    // Click the first data row in the parts data table
    const firstRow = page.locator('app-data-table tbody tr').first();
    const rowCount = await page.locator('app-data-table tbody tr').count();
    if (rowCount > 0) {
      await firstRow.click();
      await page.waitForTimeout(SETTLE_MS);
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/eng-audit-part-detail.png`, fullPage: true });
    await context.close();
  });

  test('3 - kanban job detail panel', async ({ browser }) => {
    const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: SCALE });
    const page = await context.newPage();
    await loginAndSeedStorage(page, token, user);
    await navigateAndSettle(page, '/kanban');

    // Click the first visible job card on the board
    const firstCard = page.locator('app-job-card').first();
    const cardCount = await page.locator('app-job-card').count();
    if (cardCount > 0) {
      await firstCard.click();
      await page.waitForTimeout(SETTLE_MS);
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/eng-audit-job-detail.png`, fullPage: true });
    await context.close();
  });

  test('4 - purchase orders', async ({ browser }) => {
    const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: SCALE });
    const page = await context.newPage();
    await loginAndSeedStorage(page, token, user);
    await navigateAndSettle(page, '/purchase-orders');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/eng-audit-po.png`, fullPage: true });
    await context.close();
  });

  test('5 - quality', async ({ browser }) => {
    const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: SCALE });
    const page = await context.newPage();
    await loginAndSeedStorage(page, token, user);
    await navigateAndSettle(page, '/quality');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/eng-audit-quality.png`, fullPage: true });
    await context.close();
  });

  test('6 - inventory stock levels tab', async ({ browser }) => {
    const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: SCALE });
    const page = await context.newPage();
    await loginAndSeedStorage(page, token, user);
    await navigateAndSettle(page, '/inventory');

    // Try to click the STOCK LEVELS tab — look for tab button with that label
    const stockTab = page.locator('.tab', { hasText: /stock/i }).first();
    const tabCount = await stockTab.count();
    if (tabCount > 0) {
      await stockTab.click();
      await page.waitForTimeout(SETTLE_MS);
    } else {
      // Fallback: navigate directly via URL if routing supports it
      await page.goto(`${BASE_URL}/inventory/stock`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(SETTLE_MS);
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/eng-audit-inventory-stock.png`, fullPage: true });
    await context.close();
  });

  test('7 - vendors', async ({ browser }) => {
    const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: SCALE });
    const page = await context.newPage();
    await loginAndSeedStorage(page, token, user);
    await navigateAndSettle(page, '/vendors');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/eng-audit-vendors.png`, fullPage: true });
    await context.close();
  });

  test('8 - calendar', async ({ browser }) => {
    const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: SCALE });
    const page = await context.newPage();
    await loginAndSeedStorage(page, token, user);
    await navigateAndSettle(page, '/calendar');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/eng-audit-calendar.png`, fullPage: true });
    await context.close();
  });

  test('9 - quotes', async ({ browser }) => {
    const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: SCALE });
    const page = await context.newPage();
    await loginAndSeedStorage(page, token, user);
    await navigateAndSettle(page, '/quotes');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/eng-audit-quotes.png`, fullPage: true });
    await context.close();
  });

  test('10 - sales orders', async ({ browser }) => {
    const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: SCALE });
    const page = await context.newPage();
    await loginAndSeedStorage(page, token, user);
    await navigateAndSettle(page, '/sales-orders');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/eng-audit-sales-orders.png`, fullPage: true });
    await context.close();
  });
});
