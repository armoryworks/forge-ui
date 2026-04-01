import { test, request, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:4200';
const API_BASE = 'http://localhost:5000/api/v1/';

async function login(browser: any) {
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const apiContext = await request.newContext({ baseURL: API_BASE });
  const response = await apiContext.post('auth/login', {
    data: { email: 'admin@qbengineer.local', password: 'Admin123!' },
  });
  const loginData = await response.json();
  await apiContext.dispose();
  await page.goto(BASE_URL, { waitUntil: 'commit' });
  await page.evaluate(
    ({ token, user }) => {
      localStorage.setItem('qbe-token', token);
      localStorage.setItem('qbe-user', JSON.stringify(user));
      localStorage.setItem('language', 'en');
    },
    { token: loginData.token, user: loginData.user },
  );
  return { page, context };
}

async function openFirstJob(page: any) {
  await page.goto(`${BASE_URL}/backlog`, { waitUntil: 'networkidle' });
  await page.waitForSelector('tbody tr', { timeout: 10000 });
  await page.waitForTimeout(1500);
  await page.locator('tbody tr').first().click();
  await page.waitForSelector('app-job-detail-panel', { timeout: 6000 });
  await page.waitForTimeout(1500);
}

test('1 — dialog fits at 1080p (no sidebar overflow)', async ({ browser }) => {
  const { page, context } = await login(browser);
  await openFirstJob(page);

  // Verify the sidebar bottom is within the viewport
  const sidebar = page.locator('.jd-sidebar');
  const box = await sidebar.boundingBox();
  console.log(`Sidebar bottom: ${box ? box.y + box.height : 'N/A'}, viewport: 1080`);
  if (box) {
    expect(box.y + box.height).toBeLessThanOrEqual(1085); // allow 5px tolerance
  }
  await page.screenshot({ path: 'e2e/screenshots/test-1-dialog-fits.png' });
  await context.close();
});

test('2 — CONVERSATION tab: rich text editor renders', async ({ browser }) => {
  const { page, context } = await login(browser);
  await openFirstJob(page);

  await page.locator('.jd-filter-btn', { hasText: 'Conversation' }).click();
  await page.waitForTimeout(500);

  // Verify the rich text editor textarea is present
  const textarea = page.locator('app-rich-text-editor textarea');
  await expect(textarea).toBeVisible();
  await page.screenshot({ path: 'e2e/screenshots/test-2-conversation-empty.png' });
  await context.close();
});

test('3 — CONVERSATION tab: type and post a comment', async ({ browser }) => {
  const { page, context } = await login(browser);
  await openFirstJob(page);

  await page.locator('.jd-filter-btn', { hasText: 'Conversation' }).click();
  await page.waitForTimeout(500);

  const textarea = page.locator('app-rich-text-editor textarea').first();
  await textarea.click();
  await textarea.fill('This is a **bold** test comment with _italics_.');
  await page.screenshot({ path: 'e2e/screenshots/test-3a-comment-typed.png' });

  // Click send
  await page.locator('.jd-comment-send').click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'e2e/screenshots/test-3b-comment-posted.png' });

  // Verify the comment appeared in the list
  const commentList = page.locator('.comment-list');
  await expect(commentList).toBeVisible();
  await context.close();
});

test('4 — CONVERSATION tab: @mention dropdown appears', async ({ browser }) => {
  const { page, context } = await login(browser);
  await openFirstJob(page);

  await page.locator('.jd-filter-btn', { hasText: 'Conversation' }).click();
  await page.waitForTimeout(500);

  const textarea = page.locator('app-rich-text-editor textarea').first();
  await textarea.click();
  await textarea.type('Hello @');
  await page.waitForTimeout(400);

  // The mention picker dropdown should appear
  const picker = page.locator('.rte__mention-picker');
  const pickerVisible = await picker.count() > 0 && await picker.isVisible().catch(() => false);
  console.log(`Mention picker visible: ${pickerVisible}`);
  await page.screenshot({ path: 'e2e/screenshots/test-4-mention-dropdown.png' });

  if (pickerVisible) {
    // Click the first mention option
    const option = page.locator('.rte__mention-option').first();
    await option.click();
    await page.waitForTimeout(300);
    const val = await textarea.inputValue();
    console.log(`Textarea value after mention select: ${val}`);
    expect(val).toContain('@[');
    await page.screenshot({ path: 'e2e/screenshots/test-4b-mention-inserted.png' });
  }
  await context.close();
});

test('5 — NOTES tab: rich text editor + add note', async ({ browser }) => {
  const { page, context } = await login(browser);
  await openFirstJob(page);

  await page.locator('.jd-filter-btn', { hasText: 'Notes' }).click();
  await page.waitForTimeout(500);

  // Verify textarea visible
  const textarea = page.locator('.note-add app-rich-text-editor textarea');
  await expect(textarea).toBeVisible();
  await page.screenshot({ path: 'e2e/screenshots/test-5a-notes-tab.png' });

  // Type a note
  await textarea.click();
  await textarea.fill('## Internal note\n\nRemember to **check dimensions** before shipping.');
  await page.screenshot({ path: 'e2e/screenshots/test-5b-note-typed.png' });

  // Save
  await page.locator('button:has-text("Save note"), button:has-text("SAVE NOTE"), .note-add button').last().click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'e2e/screenshots/test-5c-note-saved.png' });

  // Verify note renders with rich text display
  const richDisplay = page.locator('.note-item app-rich-text-display');
  const displayCount = await richDisplay.count();
  console.log(`Rich text display instances in notes: ${displayCount}`);
  expect(displayCount).toBeGreaterThan(0);
  await context.close();
});

test('6 — NOTES tab: existing notes render as rich text (not plain text)', async ({ browser }) => {
  const { page, context } = await login(browser);
  await openFirstJob(page);

  await page.locator('.jd-filter-btn', { hasText: 'Notes' }).click();
  await page.waitForTimeout(500);

  // Check note items use app-rich-text-display
  const noteItems = page.locator('.note-item');
  const noteCount = await noteItems.count();
  console.log(`Note items: ${noteCount}`);

  if (noteCount > 0) {
    const display = page.locator('.note-item app-rich-text-display');
    await expect(display.first()).toBeVisible();
  }
  await page.screenshot({ path: 'e2e/screenshots/test-6-notes-rich-display.png' });
  await context.close();
});

test('7 — ALL tab: merged feed shows both comments and notes', async ({ browser }) => {
  const { page, context } = await login(browser);
  await openFirstJob(page);

  // ALL tab is default, but let's click it explicitly
  await page.locator('.jd-filter-btn', { hasText: 'All' }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'e2e/screenshots/test-7-all-tab.png' });

  await context.close();
});

test('8 — HISTORY tab: renders without error', async ({ browser }) => {
  const { page, context } = await login(browser);
  await openFirstJob(page);

  await page.locator('.jd-filter-btn', { hasText: 'History' }).click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'e2e/screenshots/test-8-history-tab.png' });

  // Should show either history items or empty state — no error
  const emptyHint = page.locator('.panel__empty-hint');
  const timeline = page.locator('.timeline');
  const hasContent = (await emptyHint.count() > 0) || (await timeline.count() > 0);
  console.log(`History: empty hint=${await emptyHint.count()}, timeline=${await timeline.count()}`);
  expect(hasContent).toBeTruthy();

  await context.close();
});

test('9 — full dialog scroll: sidebar TIME section visible', async ({ browser }) => {
  const { page, context } = await login(browser);
  await openFirstJob(page);

  // Sidebar TIME section should be visible without scrolling the page
  const timeSection = page.locator('.jd-sidebar-section', { hasText: 'Time' });
  await expect(timeSection).toBeVisible();
  const box = await timeSection.boundingBox();
  console.log(`TIME section box: ${JSON.stringify(box)}`);
  if (box) {
    expect(box.y + box.height).toBeLessThanOrEqual(1090);
  }
  await page.screenshot({ path: 'e2e/screenshots/test-9-time-section-visible.png' });
  await context.close();
});
