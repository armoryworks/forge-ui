import { test, request } from '@playwright/test';

const BASE_URL = 'http://localhost:4200';
const API_BASE = 'http://localhost:5000/api/v1/';
const TARGET_PATH = process.env.TARGET_PATH || '/dashboard';

test(`screenshot ${TARGET_PATH}`, async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  // Login via API
  const apiContext = await request.newContext({ baseURL: API_BASE });
  const response = await apiContext.post('auth/login', {
    data: { email: 'admin@qbengineer.local', password: 'Admin123!' },
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

  // Navigate to target page
  await page.goto(`${BASE_URL}${TARGET_PATH}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000); // Let dynamic content render

  // Generate filename from path
  const filename = TARGET_PATH.replace(/^\//, '').replace(/\//g, '-') || 'home';
  await page.screenshot({ path: `e2e/screenshots/${filename}.png`, fullPage: true });

  await context.close();
});
