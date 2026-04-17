import { test, devices, request } from '@playwright/test';
import { SEED_PASSWORD } from '../helpers/auth.helper';

const BASE_URL = 'http://localhost:4200';
const API_BASE = 'http://localhost:5000/api/v1/';

async function login(apiRequest: typeof request) {
  const apiContext = await apiRequest.newContext({ baseURL: API_BASE });
  const response = await apiContext.post('auth/login', {
    data: { email: 'admin@qbengineer.local', password: SEED_PASSWORD },
  });
  if (!response.ok()) throw new Error(`Login failed: ${response.status()}`);
  const loginData = await response.json();
  await apiContext.dispose();
  return loginData;
}

async function seedAuth(page: any, loginData: any) {
  await page.goto(BASE_URL, { waitUntil: 'commit' });
  await page.evaluate(
    ({ token, user }: { token: string; user: any }) => {
      localStorage.setItem('qbe-token', token);
      localStorage.setItem('qbe-user', JSON.stringify(user));
      localStorage.setItem('language', 'en');
    },
    { token: loginData.token, user: loginData.user },
  );
}

// ── Desktop Chat Module (1920x1080) ──
test('desktop chat — full module audit', async ({ browser }) => {
  const loginData = await login(request);

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();
  await seedAuth(page, loginData);

  // 1. Chat list page (full route)
  await page.goto(`${BASE_URL}/chat`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'e2e/screenshots/chat-desktop-list.png' });

  // 2. Click "General" channel
  const generalBtn = page.locator('button.channel-item', { hasText: 'General' });
  if (await generalBtn.count() > 0) {
    await generalBtn.first().click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'e2e/screenshots/chat-desktop-channel-general.png' });

    // 3. Back to list
    const backBtn = page.locator('button.chat-panel__back, button.icon-btn:has(span:text("arrow_back"))');
    if (await backBtn.count() > 0) {
      await backBtn.first().click();
      await page.waitForTimeout(500);
    }
  }

  // 4. Click "Announcements" channel
  const announceBtn = page.locator('button.channel-item', { hasText: 'Announcements' });
  if (await announceBtn.count() > 0) {
    await announceBtn.first().click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'e2e/screenshots/chat-desktop-channel-announcements.png' });

    const backBtn = page.locator('button.chat-panel__back, button.icon-btn:has(span:text("arrow_back"))');
    if (await backBtn.count() > 0) {
      await backBtn.first().click();
      await page.waitForTimeout(500);
    }
  }

  // 5. Click + to open "New DM" user picker
  const newDmBtn = page.locator('button.channel-section__action').first();
  if (await newDmBtn.count() > 0) {
    await newDmBtn.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'e2e/screenshots/chat-desktop-user-picker.png' });

    // Cancel back
    const cancelBtn = page.locator('button.icon-btn:has(span:text("close"))');
    if (await cancelBtn.count() > 0) {
      await cancelBtn.first().click();
      await page.waitForTimeout(500);
    }
  }

  // 6. Click + to open "New Channel" dialog
  const newChannelBtn = page.locator('button.channel-section__action').nth(1);
  if (await newChannelBtn.count() > 0) {
    await newChannelBtn.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'e2e/screenshots/chat-desktop-create-channel-dialog.png' });

    // Close dialog via ESC
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }

  // 7. Admin > Announcements
  await page.goto(`${BASE_URL}/admin/announcements`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'e2e/screenshots/chat-desktop-admin-announcements.png' });

  // 8. Account > Customization (chat notification toggles)
  await page.goto(`${BASE_URL}/account/customization`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'e2e/screenshots/chat-desktop-account-customization.png' });

  // 9. Pop-out chat route
  await page.goto(`${BASE_URL}/chat/popout`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'e2e/screenshots/chat-desktop-popout.png' });

  await context.close();
});

// ── Mobile Chat Module (iPhone 15 Pro) ──
test('mobile chat — full module audit', async ({ browser }) => {
  const loginData = await login(request);

  const device = devices['iPhone 15 Pro'];
  const context = await browser.newContext({ ...device });
  const page = await context.newPage();
  await seedAuth(page, loginData);

  // 1. Mobile chat list
  await page.goto(`${BASE_URL}/m/chat`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'e2e/screenshots/chat-mobile-list.png' });

  // 2. Click "General" channel
  const generalBtn = page.locator('button.mobile-chat__channel-item', { hasText: 'General' });
  if (await generalBtn.count() > 0) {
    await generalBtn.first().click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'e2e/screenshots/chat-mobile-channel-general.png' });

    // Back to list
    const backBtn = page.locator('button.icon-btn:has(span:text("arrow_back"))');
    if (await backBtn.count() > 0) {
      await backBtn.first().click();
      await page.waitForTimeout(500);
    }
  }

  // 3. Click "Announcements" channel
  const announceBtn = page.locator('button.mobile-chat__channel-item', { hasText: 'Announcements' });
  if (await announceBtn.count() > 0) {
    await announceBtn.first().click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'e2e/screenshots/chat-mobile-channel-announcements.png' });

    const backBtn = page.locator('button.icon-btn:has(span:text("arrow_back"))');
    if (await backBtn.count() > 0) {
      await backBtn.first().click();
      await page.waitForTimeout(500);
    }
  }

  // 4. New DM user picker
  const newDmBtn = page.locator('button.mobile-section__action').first();
  if (await newDmBtn.count() > 0) {
    await newDmBtn.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'e2e/screenshots/chat-mobile-user-picker.png' });

    const cancelBtn = page.locator('button.icon-btn:has(span:text("arrow_back"))');
    if (await cancelBtn.count() > 0) {
      await cancelBtn.first().click();
      await page.waitForTimeout(500);
    }
  }

  // 5. New channel dialog
  const newChannelBtn = page.locator('button.mobile-section__action').nth(1);
  if (await newChannelBtn.count() > 0) {
    await newChannelBtn.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'e2e/screenshots/chat-mobile-create-channel-dialog.png' });

    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }

  // 6. Mobile account page
  await page.goto(`${BASE_URL}/m/account`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'e2e/screenshots/chat-mobile-account.png' });

  await context.close();
});
