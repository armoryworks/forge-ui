import { test, request } from '@playwright/test';

const BASE_URL = 'http://localhost:4200';
const API_BASE = 'http://localhost:5000/api/v1/';

const PAGES = [
  { name: 'parts', path: '/parts' },
  { name: 'expenses', path: '/expenses' },
  { name: 'leads', path: '/leads' },
  { name: 'vendors', path: '/vendors' },
  { name: 'purchase-orders', path: '/purchase-orders' },
  { name: 'sales-orders', path: '/sales-orders' },
  { name: 'quotes', path: '/quotes' },
  { name: 'shipments', path: '/shipments' },
  { name: 'invoices', path: '/invoices' },
  { name: 'payments', path: '/payments' },
  { name: 'assets', path: '/assets' },
  { name: 'backlog', path: '/backlog' },
  { name: 'admin-users', path: '/admin/users' },
  { name: 'account-profile', path: '/account/profile' },
  { name: 'account-contact', path: '/account/contact' },
  { name: 'account-security', path: '/account/security' },
  { name: 'account-emergency', path: '/account/emergency' },
  { name: 'account-documents', path: '/account/documents' },
  { name: 'account-tax-forms', path: '/account/tax-forms' },
];

test('button width audit', async ({ browser }) => {
  const apiContext = await request.newContext({ baseURL: API_BASE });
  const response = await apiContext.post('auth/login', {
    data: { email: 'admin@qbengineer.local', password: 'Admin123!' },
  });

  if (!response.ok()) {
    throw new Error(`Login failed: ${response.status()}`);
  }

  const loginData = await response.json();
  await apiContext.dispose();

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });
  const page = await context.newPage();

  await page.goto(BASE_URL, { waitUntil: 'commit' });
  await page.evaluate(
    ({ token, user }) => {
      localStorage.setItem('qbe-token', token);
      localStorage.setItem('qbe-user', JSON.stringify(user));
    },
    { token: loginData.token, user: loginData.user },
  );

  for (const pg of PAGES) {
    await page.goto(`${BASE_URL}${pg.path}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: `e2e/screenshots/audit/buttons/${pg.name}.png`,
      fullPage: true,
    });
  }

  await context.close();
});
