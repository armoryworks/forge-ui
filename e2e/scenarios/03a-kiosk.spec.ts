import { test, expect, type Page } from '@playwright/test';
import { loginViaApi } from '../helpers/auth.helper';
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
 * 03a — Kiosk / Shop Floor
 *
 * Requires: 01-foundation → 02a-onboarding
 * Interactive: YES — user scans badge, clocks in/out, views tasks
 *
 * Workflow:
 *   Automation creates 3 jobs assigned to the new employee
 *   ⏸ USER: navigate to shop floor display
 *   ⏸ USER: scan badge or enter employee identifier
 *   ⏸ USER: clock in via kiosk
 *   ⏸ USER: view assigned tasks
 *   ⏸ USER: clock out via kiosk
 */

test.describe.serial('03a Kiosk', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    await loginViaApi(page, 'admin@qbengineer.local', 'Admin123!');
    await navigateTo(page, '/');
    await page.waitForLoadState('networkidle');
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('create jobs for the new employee', async () => {
    phase('Creating jobs assigned to Carlos Rivera');
    await navigateTo(page, '/kanban');
    await brief(page, 1500);

    const jobs = [
      { title: 'Machine Housing Batch — Run 1', desc: 'First run of 25 aluminum housings. Use program HOU-001-v2.' },
      { title: 'Brass Bushing Order — Acme', desc: 'Turn 100 brass bushings per drawing REV-C. 0.002" tolerance on ID.' },
      { title: 'Fixture Assembly — Shaft Turner', desc: 'Assemble shaft turning fixture. Verify alignment with indicator.' },
    ];

    for (const j of jobs) {
      await clickButton(page, 'New Job');
      await waitForDialog(page, 'New Job');
      await fillInput(page, 'Title', j.title);
      await fillTextarea(page, 'Description', j.desc);

      // Try to select Production track
      const trackSelect = page.locator('mat-form-field', { has: page.locator('mat-label:text-is("Track Type")') });
      if (await trackSelect.isVisible()) {
        await selectOption(page, 'Track Type', 'Production');
      }

      // Assign to Carlos Rivera (the new employee)
      const assigneeSelect = page.locator('mat-form-field', { has: page.locator('mat-label:text-is("Assignee")') });
      if (await assigneeSelect.isVisible()) {
        await assigneeSelect.locator('mat-select').click();
        // Try to find Carlos in the dropdown
        const carlosOption = page.locator('mat-option', { hasText: /Rivera|Carlos|C\. Rivera/i }).first();
        if (await carlosOption.isVisible()) {
          await carlosOption.click();
        } else {
          // Fall back to pressing Escape if Carlos isn't listed yet
          await page.keyboard.press('Escape');
        }
        await brief(page, 300);
      }

      await selectOption(page, 'Priority', 'High');
      await clickButton(page, 'Create Job');
      await waitForAnySnackbar(page);
      await dismissSnackbar(page);
      await brief(page, 800);
      step(`✓ ${j.title}`);
    }
  });

  test('shop floor kiosk — clock in', async () => {
    await checkpoint(page, 'SHOP FLOOR KIOSK — CLOCK IN', [
      '3 jobs have been assigned to Carlos Rivera on the kanban board.',
      '',
      'YOUR TASKS:',
      '  1. Navigate to the Shop Floor display:',
      '     http://localhost:4200/display/shop-floor',
      '     OR use the sidebar → Shop Floor → Clock tab',
      '',
      '  2. Find the clock in/out interface',
      '',
      '  3. Clock IN as a worker:',
      '     - If barcode scan is available, try typing a barcode value',
      '       quickly (simulates scanner wedge)',
      '     - Or click on the worker card to clock in',
      '',
      '  4. Verify the worker moves from "Not Clocked In" to "Clocked In"',
      '',
      '  5. Note the clock-in timestamp displayed',
      '',
      'Click RESUME when done.',
    ]);
    step('✓ Clock-in checkpoint passed');
  });

  test('shop floor kiosk — view tasks and clock out', async () => {
    await checkpoint(page, 'SHOP FLOOR KIOSK — VIEW TASKS & CLOCK OUT', [
      'Now test the task view and clock out:',
      '',
      'YOUR TASKS:',
      '  1. While on the shop floor display, look for:',
      '     - Assigned tasks / job list for the clocked-in worker',
      '     - Quick action buttons (start task, pause, complete)',
      '',
      '  2. If a task list is visible, try:',
      '     - Starting a task (if there\'s a play button)',
      '     - Viewing task details',
      '',
      '  3. Clock OUT:',
      '     - Click the worker card again or use the clock out action',
      '     - Verify the worker moves back to "Not Clocked In"',
      '',
      '  4. Try clocking in/out with a DIFFERENT worker too',
      '',
      'Click RESUME when done.',
    ]);
    step('✓ Tasks & clock-out checkpoint passed');
  });
});
