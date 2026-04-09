import { test, request } from '@playwright/test';
import { SEED_PASSWORD } from '../helpers/auth.helper';

const BASE_URL = 'http://localhost:4200';
const API_BASE = 'http://localhost:5000/api/v1/';

const PAGES = [
  { name: 'dashboard', path: '/dashboard' },
  { name: 'board', path: '/board' },
  { name: 'backlog', path: '/backlog' },
  { name: 'parts', path: '/parts' },
  { name: 'inventory-stock', path: '/inventory/stock' },
  { name: 'inventory-receiving', path: '/inventory/receiving' },
  { name: 'leads', path: '/leads' },
  { name: 'expenses', path: '/expenses' },
  { name: 'assets', path: '/assets' },
  { name: 'time-tracking', path: '/time-tracking' },
  { name: 'vendors', path: '/vendors' },
  { name: 'purchase-orders', path: '/purchase-orders' },
  { name: 'sales-orders', path: '/sales-orders' },
  { name: 'quotes', path: '/quotes' },
  { name: 'shipments', path: '/shipments' },
  { name: 'invoices', path: '/invoices' },
  { name: 'payments', path: '/payments' },
  { name: 'planning', path: '/planning' },
  { name: 'reports', path: '/reports' },
  { name: 'calendar', path: '/calendar' },
  { name: 'admin-users', path: '/admin/users' },
  { name: 'admin-track-types', path: '/admin/track-types' },
  { name: 'admin-reference-data', path: '/admin/reference-data' },
  { name: 'admin-terminology', path: '/admin/terminology' },
  { name: 'admin-integrations', path: '/admin/integrations' },
  { name: 'admin-system', path: '/admin/system' },
  { name: 'admin-compliance', path: '/admin/compliance' },
  { name: 'account-profile', path: '/account/profile' },
  { name: 'account-contact', path: '/account/contact' },
  { name: 'account-security', path: '/account/security' },
  { name: 'account-preferences', path: '/account/preferences' },
];

const VIEWPORTS = [
  { name: 'desktop', width: 1920, height: 1080 },
  { name: 'tablet', width: 1024, height: 768 },
  { name: 'mobile', width: 375, height: 812 },
];

// Single test to avoid rate limiting on login
test('full app screenshots', async ({ browser }) => {
  // Login via API once
  const apiContext = await request.newContext({ baseURL: API_BASE });
  const response = await apiContext.post('auth/login', {
    data: { email: 'admin@qbengineer.local', password: SEED_PASSWORD },
  });

  if (!response.ok()) {
    throw new Error(`Login failed: ${response.status()}`);
  }

  const loginData = await response.json();
  await apiContext.dispose();

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
    });
    const page = await context.newPage();

    // Seed localStorage
    await page.goto(BASE_URL, { waitUntil: 'commit' });
    await page.evaluate(
      ({ token, user }) => {
        localStorage.setItem('qbe-token', token);
        localStorage.setItem('qbe-user', JSON.stringify(user));
        localStorage.removeItem('dashboard:layout:v5');
      },
      { token: loginData.token, user: loginData.user },
    );

    for (const pg of PAGES) {
      await page.goto(`${BASE_URL}${pg.path}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500);

      await page.screenshot({
        path: `e2e/screenshots/audit/${vp.name}/${pg.name}.png`,
        fullPage: true,
      });
    }

    await context.close();
  }
});
