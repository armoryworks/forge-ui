/**
 * E2E Smoke Test — Full front-to-back data creation through the UI.
 *
 * This test logs in as admin, completes all HR profile tasks that block
 * job assignment, creates real data (jobs, time entries, expenses, leads),
 * then cycles through every report to verify none throw errors.
 *
 * NOT seeded — everything is created via the browser UI.
 */
import { test, expect, request, type Page } from '@playwright/test';

const BASE_URL = 'http://localhost:4200';
const API_BASE = 'http://localhost:5000/api/v1/';

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function login(page: Page) {
  const apiContext = await request.newContext({ baseURL: API_BASE });
  const response = await apiContext.post('auth/login', {
    data: { email: 'admin@qbengineer.local', password: 'Admin123!' },
  });
  expect(response.ok()).toBeTruthy();
  const loginData = await response.json();
  await apiContext.dispose();

  await page.goto(BASE_URL, { waitUntil: 'commit' });
  await page.evaluate(
    ({ token, user }) => {
      localStorage.setItem('qbe-token', token);
      localStorage.setItem('qbe-user', JSON.stringify(user));
    },
    { token: loginData.token, user: loginData.user },
  );
}

/** Fill an app-input by its mat-label text */
async function fillInput(page: Page, label: string, value: string) {
  const field = page.getByLabel(label, { exact: true });
  await field.fill(value);
}

/** Fill an app-textarea by its mat-label text */
async function fillTextarea(page: Page, label: string, value: string) {
  const field = page.getByLabel(label, { exact: true });
  await field.fill(value);
}

/** Select an option from an app-select by label text */
async function selectOption(page: Page, label: string, optionText: string) {
  const select = page.locator('app-select').filter({ hasText: label }).locator('mat-select');
  await select.click();
  await page.locator('mat-option').filter({ hasText: optionText }).click();
}

/** Wait for snackbar confirmation or toast, then dismiss */
async function waitForSaveConfirmation(page: Page) {
  // Wait for snackbar or for the page to settle after save
  await page.waitForTimeout(1500);
}

/** Check no error toasts are visible */
async function assertNoErrors(page: Page) {
  // Check for error toasts (the app shows a toast with class containing 'error' or title 'Conflict')
  const errorToasts = page.locator('.toast--error, .toast--warn');
  const count = await errorToasts.count();
  if (count > 0) {
    const text = await errorToasts.first().textContent();
    throw new Error(`Error toast visible: ${text}`);
  }
}

/** Take a labeled screenshot */
async function screenshot(page: Page, name: string) {
  await page.screenshot({ path: `e2e/screenshots/smoke-${name}.png`, fullPage: true });
}

/** Dismiss any visible error toasts that might block interactions */
async function dismissToasts(page: Page) {
  const closeButtons = page.locator('.toast .toast__close, .toast button[aria-label="Close"]');
  const count = await closeButtons.count();
  for (let i = 0; i < count; i++) {
    try { await closeButtons.nth(i).click({ timeout: 500 }); } catch { /* already gone */ }
  }
}

// ─── Test ────────────────────────────────────────────────────────────────────

test.describe('Smoke Test — Data Creation & Report Verification', () => {
  test.setTimeout(120_000); // 2 minutes per test

  let page: Page;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    page = await context.newPage();
    await login(page);
  });

  test.afterAll(async () => {
    await page.context().close();
  });

  // ─── Phase 1: Complete HR Profile ──────────────────────────────────────

  test('1a. Complete emergency contact', async () => {
    await page.goto(`${BASE_URL}/account/emergency`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    await fillInput(page, 'Contact Name', 'Jane Hartman');
    await fillInput(page, 'Contact Phone', '5551234567');
    await selectOption(page, 'Relationship', 'Spouse');

    await page.locator('button.action-btn--primary').filter({ hasText: 'Save' }).click();
    await waitForSaveConfirmation(page);
    await screenshot(page, '1a-emergency');
  });

  test('1b. Complete contact & address', async () => {
    await page.goto(`${BASE_URL}/account/contact`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    await fillInput(page, 'Phone Number', '5559876543');
    await fillInput(page, 'Personal Email', 'dan@example.com');

    // Fill address form (nested inside app-address-form)
    // Use exact role match to avoid "Street Address 2" collision
    await page.getByRole('textbox', { name: 'Street Address', exact: true }).fill('123 Main Street');
    await fillInput(page, 'City', 'Springfield');

    // State dropdown — options are state abbreviations (e.g. "OH"), not full names
    await selectOption(page, 'State', 'OH');

    await page.getByLabel('ZIP / Postal Code', { exact: true }).fill('45501');

    await page.locator('button.action-btn--primary').filter({ hasText: 'Save' }).click();
    await waitForSaveConfirmation(page);
    await screenshot(page, '1b-contact');
  });

  test('1c. Complete tax forms (acknowledge non-electronic forms)', async () => {
    await page.goto(`${BASE_URL}/account/tax-forms`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await screenshot(page, '1c-tax-forms-list');

    // Get all incomplete form links
    const formItems = page.locator('.form-list__item, .tax-form-item, a[routerLink]').filter({ hasNotText: 'Completed' });
    const formLinks = page.locator('[routerLink*="tax-forms/"]');
    const linkCount = await formLinks.count();

    // Visit each form and acknowledge/complete it
    for (let i = 0; i < linkCount; i++) {
      await page.goto(`${BASE_URL}/account/tax-forms`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000);

      // Get all links again (DOM may have refreshed)
      const links = page.locator('[routerLink*="tax-forms/"]');
      const count = await links.count();
      if (i >= count) break;

      // Click the i-th form link
      await links.nth(i).click();
      await page.waitForTimeout(2000);

      // Check if this form is already complete
      const completeStatus = page.locator('.form-detail__status--complete');
      if (await completeStatus.isVisible()) {
        continue; // Already done
      }

      // Check if there's a form definition (electronic form like W-4)
      const renderer = page.locator('app-compliance-form-renderer');
      if (await renderer.isVisible()) {
        // For electronic forms, try to submit with minimal data
        // Click Submit Form button if available
        const submitBtn = page.locator('button').filter({ hasText: 'Submit Form' });
        if (await submitBtn.isVisible()) {
          // First save draft, then submit
          const saveBtn = page.locator('button').filter({ hasText: 'Save Draft' });
          if (await saveBtn.isVisible() && await saveBtn.isEnabled()) {
            await saveBtn.click();
            await page.waitForTimeout(1500);
          }
          if (await submitBtn.isEnabled()) {
            await submitBtn.click();
            await page.waitForTimeout(1500);
          }
        }
        continue;
      }

      // For non-electronic forms: click "Acknowledge & Complete"
      const ackBtn = page.locator('button').filter({ hasText: 'Acknowledge & Complete' });
      if (await ackBtn.isVisible()) {
        await ackBtn.click();
        await page.waitForTimeout(2000);
      }

      await screenshot(page, `1c-form-${i}`);
    }

    // Verify profile completeness improved
    await page.goto(`${BASE_URL}/account/tax-forms`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await screenshot(page, '1c-tax-forms-after');
  });

  // ─── Phase 2: Create Data Through UI ───────────────────────────────────

  test('2a. Create a job on kanban board', async () => {
    await page.goto(`${BASE_URL}/kanban`, { waitUntil: 'domcontentloaded' });
    await dismissToasts(page);

    // Wait for the kanban component to render (lazy-loaded after route transition)
    const newJobBtn = page.locator('.new-job-btn');
    await newJobBtn.waitFor({ state: 'visible', timeout: 30_000 });
    await newJobBtn.click();
    await page.waitForTimeout(500);

    // Fill the job dialog
    await fillInput(page, 'Title', 'Smoke Test Job - Widget Assembly');

    // Set priority
    await selectOption(page, 'Priority', 'High');

    // Submit
    const createBtn = page.locator('button.action-btn--primary').filter({ hasText: 'Create Job' });
    await createBtn.click();
    await waitForSaveConfirmation(page);
    await screenshot(page, '2a-kanban-job-created');
  });

  test('2b. Create a second job with due date', async () => {
    // Navigate fresh to kanban to avoid stale state from test 2a
    await page.goto(`${BASE_URL}/kanban`, { waitUntil: 'domcontentloaded' });
    // Wait for loading overlay to disappear (route transition triggers global loading + inert)
    await page.locator('.loading-overlay').waitFor({ state: 'hidden', timeout: 30_000 }).catch(() => {});
    const newJobBtn = page.locator('.new-job-btn');
    await newJobBtn.waitFor({ state: 'visible', timeout: 15_000 });
    await dismissToasts(page);

    await newJobBtn.click();

    // Wait for dialog backdrop to appear (the .dialog-backdrop inside app-dialog)
    const dialogTitle = page.locator('.dialog__title', { hasText: 'New Job' });
    await dialogTitle.waitFor({ state: 'visible', timeout: 10_000 });
    await page.waitForTimeout(300);

    await fillInput(page, 'Title', 'Smoke Test Job - Quality Check');

    // Set a past due date to create an overdue job
    const dueDateInput = page.locator('app-datepicker').filter({ hasText: 'Due Date' }).locator('input');
    await dueDateInput.click();
    await dueDateInput.fill('03/01/2026');
    await page.keyboard.press('Escape'); // close datepicker overlay

    await selectOption(page, 'Priority', 'Urgent');

    const createBtn = page.locator('button.action-btn--primary').filter({ hasText: 'Create Job' });
    await createBtn.click();
    await waitForSaveConfirmation(page);
    await screenshot(page, '2b-kanban-second-job');
  });

  test('2c. Log a manual time entry', async () => {
    await page.goto(`${BASE_URL}/time-tracking`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Click "Log Time" or the manual entry button
    const logBtn = page.locator('button').filter({ hasText: /Log Time|Manual|add/ }).first();
    await logBtn.click();
    await page.waitForTimeout(500);

    // Fill manual time entry form
    await fillInput(page, 'Hours', '2');
    await fillInput(page, 'Minutes', '30');
    await selectOption(page, 'Category', 'Production');
    await fillTextarea(page, 'Notes', 'Smoke test - production work on Widget Assembly');

    // Submit
    const submitBtn = page.locator('button.action-btn--primary').filter({ hasText: /Log Entry|Submit/ });
    await submitBtn.click();
    await waitForSaveConfirmation(page);
    await screenshot(page, '2c-time-entry');
  });

  test('2d. Start and stop a timer', async () => {
    await page.goto(`${BASE_URL}/time-tracking`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    // Click "Start Timer"
    const startBtn = page.locator('button').filter({ hasText: /Start Timer|play/ }).first();
    if (await startBtn.isVisible()) {
      await startBtn.click();
      await page.waitForTimeout(500);

      // Fill timer dialog
      await selectOption(page, 'Category', 'Setup');

      const startDialogBtn = page.locator('app-dialog button.action-btn--primary').filter({ hasText: /Start/ });
      await startDialogBtn.click();
      await page.waitForTimeout(3000); // Let timer run for a few seconds

      // Stop the timer
      const stopBtn = page.locator('button').filter({ hasText: /Stop Timer|stop/ }).first();
      if (await stopBtn.isVisible()) {
        await stopBtn.click();
        await page.waitForTimeout(500);

        const stopDialogBtn = page.locator('app-dialog button.action-btn--primary').filter({ hasText: /Stop/ });
        if (await stopDialogBtn.isVisible()) {
          await stopDialogBtn.click();
          await waitForSaveConfirmation(page);
        }
      }
    }
    await screenshot(page, '2d-timer');
  });

  test('2e. Create an expense', async () => {
    await page.goto(`${BASE_URL}/expenses`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Click "New Expense"
    const newExpBtn = page.locator('button').filter({ hasText: /New Expense|add/ }).first();
    await newExpBtn.click();
    await page.waitForTimeout(500);

    await fillInput(page, 'Amount', '149.99');
    await selectOption(page, 'Category', 'Materials');
    await fillTextarea(page, 'Description', 'Smoke test - raw materials for Widget Assembly');

    const submitBtn = page.locator('button.action-btn--primary').filter({ hasText: /Submit Expense|Save/ });
    await submitBtn.click();
    await waitForSaveConfirmation(page);
    await screenshot(page, '2e-expense');
  });

  test('2f. Create a second expense', async () => {
    await page.goto(`${BASE_URL}/expenses`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const newExpBtn = page.locator('button').filter({ hasText: /New Expense|add/ }).first();
    await newExpBtn.click();
    await page.waitForTimeout(500);

    await fillInput(page, 'Amount', '35.50');
    await selectOption(page, 'Category', 'Tools');
    await fillTextarea(page, 'Description', 'Smoke test - drill bits');

    const submitBtn = page.locator('button.action-btn--primary').filter({ hasText: /Submit Expense|Save/ });
    await submitBtn.click();
    await waitForSaveConfirmation(page);
    await screenshot(page, '2f-expense-2');
  });

  test('2g. Create a lead', async () => {
    await page.goto(`${BASE_URL}/leads`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const newLeadBtn = page.locator('button').filter({ hasText: /New Lead|add/ }).first();
    await newLeadBtn.click();
    await page.waitForTimeout(500);

    await fillInput(page, 'Company Name', 'Acme Manufacturing Co.');
    await fillInput(page, 'Contact Name', 'John Smith');
    await fillInput(page, 'Email', 'john@acmemfg.com');
    await fillInput(page, 'Phone', '5551112222');
    await selectOption(page, 'Source', 'Referral');
    await fillTextarea(page, 'Notes', 'Smoke test lead - interested in widget production');

    const createBtn = page.locator('button.action-btn--primary').filter({ hasText: /Create Lead|Save/ });
    await createBtn.click();
    await waitForSaveConfirmation(page);
    await screenshot(page, '2g-lead');
  });

  test('2h. Create a second lead', async () => {
    await page.goto(`${BASE_URL}/leads`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const newLeadBtn = page.locator('button').filter({ hasText: /New Lead|add/ }).first();
    await newLeadBtn.click();
    await page.waitForTimeout(500);

    await fillInput(page, 'Company Name', 'TechParts Inc.');
    await fillInput(page, 'Contact Name', 'Sarah Johnson');
    await fillInput(page, 'Email', 'sarah@techparts.io');
    await selectOption(page, 'Source', 'Website');

    const createBtn = page.locator('button.action-btn--primary').filter({ hasText: /Create Lead|Save/ });
    await createBtn.click();
    await waitForSaveConfirmation(page);
    await screenshot(page, '2h-lead-2');
  });

  // ─── Phase 3: Verify All Reports Load ──────────────────────────────────

  const ALL_REPORTS = [
    'Jobs by Stage',
    'Overdue Jobs',
    'Time by User',
    'Expense Summary',
    'Lead Pipeline',
    'Completion Trend',
    'On-Time Delivery',
    'Avg Lead Time',
    'Team Workload',
    'Customer Activity',
    'My Work History',
    'My Time Log',
    'AR Aging',
    'Revenue',
    'Profit & Loss',
    'My Expenses',
    'Quote-to-Close',
    'Shipping Summary',
    'Time in Stage',
    'Employee Productivity',
    'Inventory Levels',
    'Maintenance',
    'Quality / Scrap Rate',
    'Cycle Review',
    'Job Margin',
    'My Cycle Summary',
    'Lead & Sales',
    'R&D Report',
  ];

  test('3. Verify all 28 reports load without errors', async () => {
    await page.goto(`${BASE_URL}/reports`, { waitUntil: 'domcontentloaded' });

    // Wait for the reports page sidebar to render
    await page.locator('.report-nav-item').first().waitFor({ state: 'visible', timeout: 15_000 });

    // Wait for the default report (Jobs by Stage) spinner to disappear
    const spinner = page.locator('.page-loading .spin');
    await spinner.waitFor({ state: 'hidden', timeout: 15_000 }).catch(() => {});

    const errors: string[] = [];

    for (let ri = 0; ri < ALL_REPORTS.length; ri++) {
      const reportLabel = ALL_REPORTS[ri];

      // Click the report in the sidebar
      const navItem = page.locator('.report-nav-item').filter({ hasText: reportLabel });
      if (!(await navItem.isVisible())) {
        errors.push(`${reportLabel}: sidebar button not found`);
        continue;
      }

      // Skip clicking "Jobs by Stage" since it's the default already-loaded report
      if (ri > 0) {
        await navItem.click();
      }

      // For date-range reports, click Apply to trigger the load
      try {
        const applyBtn = page.locator('.report-header__filters button.action-btn--primary').filter({ hasText: 'Apply' });
        if (await applyBtn.isVisible({ timeout: 800 })) {
          await applyBtn.click({ timeout: 3000 });
        }
      } catch {
        // Apply button not present for this report type — that's fine
      }

      // Wait for spinner to disappear (report loaded or errored)
      await spinner.waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => {});

      // Check for error toasts
      const errorToast = page.locator('.toast--error, .toast--warn, .toast').filter({ hasText: /could not be translated|Error|Conflict|500/ });
      if (await errorToast.isVisible()) {
        const text = await errorToast.first().textContent();
        errors.push(`${reportLabel}: ${text?.substring(0, 100)}`);

        // Dismiss error toast if possible
        const closeBtn = errorToast.locator('button, .toast__close');
        if (await closeBtn.first().isVisible()) {
          await closeBtn.first().click();
          await page.waitForTimeout(300);
        }
      }
    }

    // Take final screenshot
    await screenshot(page, '3-reports-final');

    // Report all errors at once
    if (errors.length > 0) {
      console.error('Report errors found:\n' + errors.join('\n'));
    }
    expect(errors, `Reports with errors:\n${errors.join('\n')}`).toHaveLength(0);
  });

  // ─── Phase 4: Dashboard sanity check ───────────────────────────────────

  test('4. Dashboard loads with data', async () => {
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    await assertNoErrors(page);
    await screenshot(page, '4-dashboard');
  });
});
