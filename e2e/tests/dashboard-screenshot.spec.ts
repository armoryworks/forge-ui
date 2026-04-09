import { test, request } from '@playwright/test';
import { SEED_PASSWORD } from '../helpers/auth.helper';

const BASE_URL = 'http://localhost:4200';
const API_BASE = 'http://localhost:5000/api/v1/';

test('capture dashboard screenshot', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  // Login via API
  const apiContext = await request.newContext({ baseURL: API_BASE });
  const response = await apiContext.post('auth/login', {
    data: { email: 'admin@qbengineer.local', password: SEED_PASSWORD },
  });

  if (!response.ok()) {
    throw new Error(`Login failed: ${response.status()}`);
  }

  const loginData = await response.json();
  await apiContext.dispose();

  // Seed localStorage
  await page.goto(BASE_URL, { waitUntil: 'commit' });
  await page.evaluate(
    ({ token, user }) => {
      localStorage.setItem('qbe-token', token);
      localStorage.setItem('qbe-user', JSON.stringify(user));
    },
    { token: loginData.token, user: loginData.user },
  );

  // Navigate to dashboard
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000); // Let GridStack render
  await page.screenshot({ path: 'e2e/screenshots/dashboard.png', fullPage: true });

  await context.close();
});
