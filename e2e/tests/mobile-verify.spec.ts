import { test, devices, request } from '@playwright/test';
import { SEED_PASSWORD } from '../helpers/auth.helper';

const BASE_URL = 'http://localhost:4200';
const API_BASE = 'http://localhost:5000/api/v1/';

const MOBILE_DEVICES = [
  { name: 'Pixel 9 Pro', device: devices['Pixel 7'] },       // closest to Pixel 9 Pro (412x915)
  { name: 'iPhone 15 Pro', device: devices['iPhone 15 Pro'] },
  { name: 'Galaxy S23', device: { viewport: { width: 360, height: 780 }, userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36', deviceScaleFactor: 3, isMobile: true, hasTouch: true } },
];

for (const { name, device } of MOBILE_DEVICES) {
  test(`mobile redirect — ${name}`, async ({ browser }) => {
    const context = await browser.newContext({ ...device });
    const page = await context.newPage();

    // Login via API
    const apiContext = await request.newContext({ baseURL: API_BASE });
    const response = await apiContext.post('auth/login', {
      data: { email: 'admin@qbengineer.local', password: SEED_PASSWORD },
    });
    if (!response.ok()) throw new Error(`Login failed: ${response.status()}`);
    const loginData = await response.json();
    await apiContext.dispose();

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

    // Navigate to desktop route — should redirect to /m/
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    const slug = name.toLowerCase().replace(/\s+/g, '-');
    await page.screenshot({ path: `e2e/screenshots/mobile-${slug}.png`, fullPage: false });

    // Log the final URL to verify redirect
    console.log(`${name}: final URL = ${page.url()}`);

    await context.close();
  });
}
