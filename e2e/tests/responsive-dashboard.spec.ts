import { test, request } from '@playwright/test';
import { SEED_PASSWORD } from '../helpers/auth.helper';

const BASE_URL = 'http://localhost:4200';
const API_BASE = 'http://localhost:5000/api/v1/';

const VIEWPORTS = [
  { name: 'desktop-wide', width: 1920, height: 1080 },
  { name: 'desktop', width: 1500, height: 900 },
  { name: 'desktop-narrow', width: 1280, height: 800 },
  { name: 'tablet-landscape', width: 1024, height: 768 },
  { name: 'tablet-portrait', width: 768, height: 1024 },
  { name: 'mobile', width: 375, height: 812 },
];

// Use a single test to avoid rate limiting on login
test('dashboard responsive screenshots', async ({ browser }) => {
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
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await context.newPage();

    // Seed localStorage — clear any saved dashboard layout to test defaults
    await page.goto(BASE_URL, { waitUntil: 'commit' });
    await page.evaluate(
      ({ token, user }) => {
        localStorage.setItem('qbe-token', token);
        localStorage.setItem('qbe-user', JSON.stringify(user));
        localStorage.removeItem('dashboard:layout:v5');
      },
      { token: loginData.token, user: loginData.user },
    );

    // Navigate to dashboard
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    await page.screenshot({
      path: `e2e/screenshots/dashboard-${vp.name}.png`,
      fullPage: true,
    });

    await context.close();
  }
});
