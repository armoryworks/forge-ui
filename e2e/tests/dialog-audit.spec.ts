import { test, request, Page } from '@playwright/test';
import { SEED_PASSWORD } from '../helpers/auth.helper';

const BASE_URL = 'http://localhost:4200';
const API_BASE = 'http://localhost:5000/api/v1/';

async function setup(browser: any) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const api = await request.newContext({ baseURL: API_BASE });
  const r = await api.post('auth/login', { data: { email: 'admin@qbengineer.local', password: SEED_PASSWORD } });
  const d = await r.json();
  await api.dispose();
  await page.goto(BASE_URL, { waitUntil: 'commit' });
  await page.evaluate(({ token, user }) => {
    localStorage.setItem('qbe-token', token);
    localStorage.setItem('qbe-user', JSON.stringify(user));
  }, { token: d.token, user: d.user });
  return { page, ctx };
}

async function snap(page: Page, name: string) {
  await page.waitForTimeout(600);
  await page.screenshot({ path: `e2e/screenshots/audit-${name}.png` });
}

test('parts - new part dialog', async ({ browser }) => {
  const { page, ctx } = await setup(browser);
  await page.goto(`${BASE_URL}/parts`, { waitUntil: 'networkidle' });
  await page.click('button:has-text("Create Part"), button:has-text("New Part"), button[aria-label*="Part"]');
  await snap(page, 'parts-new');
  await ctx.close();
});

test('quotes - new quote dialog', async ({ browser }) => {
  const { page, ctx } = await setup(browser);
  await page.goto(`${BASE_URL}/quotes`, { waitUntil: 'networkidle' });
  await page.click('button:has-text("New Quote"), button:has-text("Create Quote")');
  await snap(page, 'quotes-new');
  await ctx.close();
});

test('purchase orders - new po dialog', async ({ browser }) => {
  const { page, ctx } = await setup(browser);
  await page.goto(`${BASE_URL}/purchase-orders`, { waitUntil: 'networkidle' });
  await page.click('button:has-text("New Order"), button:has-text("New PO"), button:has-text("Purchase Order")');
  await snap(page, 'po-new');
  await ctx.close();
});

test('vendors - new vendor dialog', async ({ browser }) => {
  const { page, ctx } = await setup(browser);
  await page.goto(`${BASE_URL}/vendors`, { waitUntil: 'networkidle' });
  await page.click('button:has-text("New Vendor"), button:has-text("Add Vendor")');
  await snap(page, 'vendor-new');
  await ctx.close();
});

test('expenses - new expense dialog', async ({ browser }) => {
  const { page, ctx } = await setup(browser);
  await page.goto(`${BASE_URL}/expenses`, { waitUntil: 'networkidle' });
  await page.click('button:has-text("New Expense"), button:has-text("Add Expense"), button:has-text("Submit")');
  await snap(page, 'expense-new');
  await ctx.close();
});

test('customers - new customer dialog', async ({ browser }) => {
  const { page, ctx } = await setup(browser);
  await page.goto(`${BASE_URL}/customers`, { waitUntil: 'networkidle' });
  await page.click('button:has-text("New Customer"), button:has-text("Add Customer")');
  await snap(page, 'customer-new');
  await ctx.close();
});

test('invoices - new invoice dialog', async ({ browser }) => {
  const { page, ctx } = await setup(browser);
  await page.goto(`${BASE_URL}/invoices`, { waitUntil: 'networkidle' });
  await page.click('button:has-text("New Invoice"), button:has-text("Create Invoice")');
  await snap(page, 'invoice-new');
  await ctx.close();
});
