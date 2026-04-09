import { test, type Page } from '@playwright/test';
import { loginViaApi, SEED_PASSWORD } from '../helpers/auth.helper';
import {
  fillInput,
  fillTextarea,
  selectOption,
  clickButton,
  waitForDialog,
  navigateTo,
  waitForAnySnackbar,
  brief,
  dismissSnackbar,
} from '../helpers/ui.helper';
import { checkpoint, step, phase } from '../helpers/interactive.helper';

/**
 * 03d — Expense Approval Workflow
 *
 * Requires: 01-foundation → 02c-production
 * Interactive: YES — user submits expenses as engineer, approves as manager
 *
 * Workflow:
 *   Automation submits 4 expenses as different engineers
 *   ⏸ USER (as engineer): submit an expense with receipt
 *   Automation switches to manager account
 *   ⏸ USER (as manager): review and approve/reject expenses
 */

test.describe.serial('03d Expenses', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await loginViaApi(page, 'admin@qbengineer.local', SEED_PASSWORD);
    await navigateTo(page, '/');
    await page.waitForLoadState('networkidle');
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('engineers submit expenses', async () => {
    phase('Submitting expenses as different engineers');

    // Submit as A. Kim
    await loginViaApi(page, 'akim@qbengineer.local', SEED_PASSWORD);
    await navigateTo(page, '/expenses');
    await brief(page, 1000);

    const kimExpenses = [
      { amount: '245.00', category: 'Tooling', desc: 'Replacement end mills for housing batch — CNMG120408 x10' },
      { amount: '89.50', category: 'Material', desc: 'Emergency aluminum bar stock — short 2 bars for TechPro job' },
    ];

    for (const exp of kimExpenses) {
      await clickButton(page, 'New Expense');
      await waitForDialog(page, 'New Expense');
      await fillInput(page, 'Amount', exp.amount);
      await selectOption(page, 'Category', exp.category);
      await fillTextarea(page, 'Description', exp.desc);
      await clickButton(page, 'Submit Expense');
      await waitForAnySnackbar(page);
      await dismissSnackbar(page);
      await brief(page, 600);
      step(`✓ A. Kim: $${exp.amount} — ${exp.category}`);
    }

    // Submit as D. Hart
    await loginViaApi(page, 'dhart@qbengineer.local', SEED_PASSWORD);
    await navigateTo(page, '/expenses');
    await brief(page, 1000);

    const hartExpenses = [
      { amount: '1250.00', category: 'Tooling', desc: 'New precision grinding wheel for titanium pin job — Quantum Dynamics' },
      { amount: '55.00', category: 'Shipping', desc: 'Overnight shipping for NorthStar motor mount samples to customer' },
    ];

    for (const exp of hartExpenses) {
      await clickButton(page, 'New Expense');
      await waitForDialog(page, 'New Expense');
      await fillInput(page, 'Amount', exp.amount);
      await selectOption(page, 'Category', exp.category);
      await fillTextarea(page, 'Description', exp.desc);
      await clickButton(page, 'Submit Expense');
      await waitForAnySnackbar(page);
      await dismissSnackbar(page);
      await brief(page, 600);
      step(`✓ D. Hart: $${exp.amount} — ${exp.category}`);
    }
  });

  test('user submits expense with receipt', async () => {
    // Stay as D. Hart for the interactive part
    await navigateTo(page, '/expenses');

    await checkpoint(page, 'SUBMIT EXPENSE WITH RECEIPT', [
      '4 expenses have been auto-submitted by A. Kim and D. Hart.',
      'You are currently logged in as D. Hart (Engineer).',
      '',
      'YOUR TASKS:',
      '  1. Click "New Expense"',
      '  2. Enter amount: $180.00',
      '  3. Select category: Travel',
      '  4. Description: "Customer site visit — TechPro quality review"',
      '  5. If a receipt upload area is available:',
      '     - Upload a photo or PDF as the receipt',
      '  6. Click "Submit Expense"',
      '',
      '  7. Verify your expenses appear in the table',
      '  8. Note the "Pending" status on each one',
      '',
      'Click RESUME when done.',
    ]);
    step('✓ Expense submission checkpoint passed');
  });

  test('manager reviews and approves expenses', async () => {
    // Switch to admin (who has Manager capabilities)
    await loginViaApi(page, 'admin@qbengineer.local', SEED_PASSWORD);
    await navigateTo(page, '/expenses/approval-queue');
    await brief(page, 1000);

    await checkpoint(page, 'EXPENSE APPROVAL — MANAGER REVIEW', [
      'You are now logged in as Admin (has Manager privileges).',
      'You are on the Expense Approval Queue page.',
      '',
      'YOUR TASKS:',
      '  1. Review the pending expenses in the approval queue',
      '     (should see 5-6 pending expenses from Kim and Hart)',
      '',
      '  2. APPROVE an expense:',
      '     - Click on the $245 tooling expense (A. Kim)',
      '     - Review the details in the dialog/panel',
      '     - Add approval note: "Approved — expected for housing job"',
      '     - Click "Approve"',
      '     - Verify it disappears from the queue',
      '',
      '  3. REJECT an expense:',
      '     - Click on the $1,250 grinding wheel expense (D. Hart)',
      '     - Add rejection note: "Need PO for purchases over $1,000"',
      '     - Click "Reject"',
      '',
      '  4. APPROVE the remaining expenses',
      '',
      '  5. Verify the queue is empty (or shows approved/rejected)',
      '',
      '  BONUS:',
      `  6. Switch back to akim@qbengineer.local (${SEED_PASSWORD})`,
      '  7. Navigate to /expenses',
      '  8. Verify expenses show Approved/Rejected status',
      '',
      'Click RESUME when done.',
    ]);
    step('✓ Expense approval checkpoint passed');
  });
});
