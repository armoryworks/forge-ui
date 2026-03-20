import { test, request } from '@playwright/test';

const BASE_URL = 'http://localhost:4200';
const API_BASE = 'http://localhost:5000/api/v1/';
const TARGET_PATH = process.env.TARGET_PATH?.replace(/^[A-Z]:\/Git/i, '') || '/dashboard';

test(`screenshot ${TARGET_PATH}`, async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
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
    ({ token, user, lang }) => {
      localStorage.setItem('qbe-token', token);
      localStorage.setItem('qbe-user', JSON.stringify(user));
      localStorage.setItem('language', lang);
    },
    { token: loginData.token, user: loginData.user, lang: process.env.LANG_OVERRIDE || 'en' },
  );

  // Navigate to target page
  await page.goto(`${BASE_URL}${TARGET_PATH}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000); // Let dynamic content render

  // Generate filename from path
  const filename = TARGET_PATH.replace(/^\//, '').replace(/\//g, '-') || 'home';
  await page.screenshot({ path: `e2e/screenshots/${filename}.png`, fullPage: true });

  // Crop step sections by finding step-number text
  const stepSections = page.locator('.gov-form__step');
  const stepCount = await stepSections.count();
  for (let i = 0; i < stepCount; i++) {
    const stepNum = await stepSections.nth(i).locator('.gov-form__step-number').textContent();
    if (stepNum?.includes('Step 3')) {
      await stepSections.nth(i).screenshot({ path: `e2e/screenshots/w4-step3.png` });
    }
  }
  // Crop Steps 3+4 combined
  const step3Boxes: { step3: any; step4: any } = { step3: null, step4: null };
  for (let i = 0; i < stepCount; i++) {
    const stepNum = await stepSections.nth(i).locator('.gov-form__step-number').textContent();
    if (stepNum?.includes('Step 3')) step3Boxes.step3 = await stepSections.nth(i).boundingBox();
    if (stepNum?.includes('Step 4')) step3Boxes.step4 = await stepSections.nth(i).boundingBox();
  }
  if (step3Boxes.step3 && step3Boxes.step4) {
    const b3 = step3Boxes.step3;
    const b4 = step3Boxes.step4;
    await page.screenshot({
      path: `e2e/screenshots/w4-steps3-4.png`,
      clip: { x: b3.x - 5, y: b3.y - 5, width: Math.max(b3.width, b4.width) + 10, height: (b4.y + b4.height) - b3.y + 10 },
    });
  }

  // Crop Step 2 section
  for (let i = 0; i < stepCount; i++) {
    const stepNum = await stepSections.nth(i).locator('.gov-form__step-number').textContent();
    if (stepNum?.includes('Step 2')) {
      await stepSections.nth(i).screenshot({ path: `e2e/screenshots/w4-step2.png` });
    }
  }

  // Crop exempt row + Step 5 area (between Step 4 and footer)
  const exemptSection = page.locator('.gov-form__exempt');
  if (await exemptSection.count() > 0) {
    await exemptSection.first().screenshot({ path: `e2e/screenshots/w4-exempt.png` });
  }

  await context.close();
});
