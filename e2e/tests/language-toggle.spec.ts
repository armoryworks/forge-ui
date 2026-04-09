import { test, expect, request } from '@playwright/test';
import { SEED_PASSWORD } from '../helpers/auth.helper';

const BASE_URL = 'http://localhost:4200';
const API_BASE = 'http://localhost:5000/api/v1/';

test.describe('Language Toggle', () => {
  test('sidebar and header translate to Spanish', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await context.newPage();

    // Login via API
    const apiContext = await request.newContext({ baseURL: API_BASE });
    const response = await apiContext.post('auth/login', {
      data: { email: 'admin@qbengineer.local', password: SEED_PASSWORD },
    });
    expect(response.ok()).toBeTruthy();
    const loginData = await response.json();
    await apiContext.dispose();

    // Seed localStorage with English
    await page.goto(BASE_URL, { waitUntil: 'commit' });
    await page.evaluate(
      ({ token, user }) => {
        localStorage.setItem('qbe-token', token);
        localStorage.setItem('qbe-user', JSON.stringify(user));
        localStorage.setItem('language', 'en');
      },
      { token: loginData.token, user: loginData.user },
    );

    // Navigate to dashboard
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    await page.locator('.loading-overlay').waitFor({ state: 'hidden', timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(2000);

    // Expand sidebar
    const toggleBtn = page.locator('.nav-item--toggle');
    await toggleBtn.click();
    await page.waitForTimeout(500);

    // Screenshot English state
    await page.screenshot({ path: 'e2e/screenshots/lang-english.png', fullPage: true });

    // Open user menu
    const userTrigger = page.locator('.user-trigger');
    await userTrigger.click();
    await page.waitForTimeout(300);

    // Screenshot user menu showing language toggle
    await page.screenshot({ path: 'e2e/screenshots/lang-menu.png', fullPage: true });

    // Click Español button
    const espBtn = page.locator('.user-menu__lang-btn', { hasText: 'Español' });
    await espBtn.click();
    await page.waitForTimeout(1000);

    // Close menu
    await page.locator('.user-menu-backdrop').click().catch(() => {});
    await page.waitForTimeout(500);

    // Screenshot Spanish state
    await page.screenshot({ path: 'e2e/screenshots/lang-spanish.png', fullPage: true });

    // Verify sidebar labels are in Spanish
    const sidebarLabels = page.locator('.nav-item__label');
    const firstLabel = await sidebarLabels.first().textContent();
    expect(firstLabel?.trim()).toBe('Contraer');

    // Verify second label is "Panel" (Dashboard in Spanish)
    const dashLabel = await sidebarLabels.nth(1).textContent();
    expect(dashLabel?.trim()).toBe('Panel');

    await context.close();
  });
});
