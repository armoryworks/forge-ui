import { test, type Page } from '@playwright/test';
import { loginViaApi } from '../helpers/auth.helper';
import {
  fillInput,
  fillTextarea,
  selectOption,
  fillDate,
  clickButton,
  waitForDialog,
  navigateTo,
  waitForAnySnackbar,
  brief,
  dismissSnackbar,
} from '../helpers/ui.helper';
import { checkpoint, step, phase } from '../helpers/interactive.helper';

/**
 * 02c — Production Floor
 *
 * Requires: 01-foundation
 * Interactive: YES — user drags jobs, assigns work, starts timers
 *
 * Workflow:
 *   Automation creates 8 jobs across stages with different priorities
 *   ⏸ USER: drag jobs between kanban stages
 *   ⏸ USER: assign jobs to engineers
 *   ⏸ USER: bulk select + bulk move/assign
 *   ⏸ USER: open job detail, add comment, create subtask
 *   ⏸ USER: start timer on a job, work, stop timer
 *   ⏸ USER: create manual time entry
 */

test.describe.serial('02c Production', () => {
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

  test('create production jobs', async () => {
    phase('Creating 8 production jobs');
    await navigateTo(page, '/kanban');
    await brief(page, 1500);

    const jobs = [
      { title: 'Machine Housing Batch — TechPro', customer: 'TechPro Industries', priority: 'High', desc: 'CNC machine 50 aluminum housings per DWG-HOU-100 Rev A' },
      { title: 'Titanium Pin Run — Quantum', customer: 'Quantum Dynamics', priority: 'Normal', desc: 'Precision grind 100 titanium pins. ±0.0005" tolerance.' },
      { title: 'Valve Assembly — TechPro', customer: 'TechPro Industries', priority: 'High', desc: 'Assemble 10 hydraulic valve units. Torque specs in work packet.' },
      { title: 'Motor Mount Weld — NorthStar', customer: 'NorthStar Aerospace', priority: 'Urgent', desc: 'Weld 5 motor mount assemblies. AS9100 cert required. NDE after weld.' },
      { title: 'Control Panel Build — Pacific Rim', customer: 'Pacific Rim Manufacturing', priority: 'Normal', desc: 'Build 8 control panel assemblies. Wire per schematic CP-200.' },
      { title: 'Bushing Order — Acme', customer: 'Acme Corp', priority: 'Low', desc: 'Turn 200 brass bushings per customer print Rev C. Ship in 2 lots.' },
      { title: 'Bracket Fabrication — Internal', priority: 'Normal', desc: 'Fabricate 20 carbon steel brackets for shop floor fixtures.' },
      { title: 'Guide Rail Replacement — Maintenance', priority: 'High', desc: 'Machine new UHMW guide rails for Haas VF-2SS table. Urgent — machine down.' },
    ];

    for (const j of jobs) {
      await clickButton(page, 'New Job');
      await waitForDialog(page, 'New Job');
      await fillInput(page, 'Title', j.title);
      await fillTextarea(page, 'Description', j.desc);

      const trackSelect = page.locator('mat-form-field', { has: page.locator('mat-label:text-is("Track Type")') });
      if (await trackSelect.isVisible()) {
        await selectOption(page, 'Track Type', 'Production');
      }

      if (j.customer) {
        await selectOption(page, 'Customer', j.customer);
      }
      await selectOption(page, 'Priority', j.priority);

      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 7 + Math.floor(Math.random() * 21));
      const dueDateStr = `${dueDate.getMonth() + 1}/${dueDate.getDate()}/${dueDate.getFullYear()}`;
      await fillDate(page, 'Due Date', dueDateStr);

      await clickButton(page, 'Create Job');
      await waitForAnySnackbar(page);
      await dismissSnackbar(page);
      await brief(page, 800);
      step(`✓ ${j.title}`);
    }
  });

  test('user manages kanban board', async () => {
    await checkpoint(page, 'KANBAN BOARD — DRAG, DROP, ASSIGN', [
      '8 new jobs are on the kanban board (plus seeded jobs).',
      'All new jobs start in the first stage (Quote Requested).',
      '',
      'YOUR TASKS:',
      '  1. DRAG AND DROP:',
      '     - Drag "Motor Mount Weld" to "In Production" stage',
      '     - Drag "Machine Housing Batch" to "Materials Ordered"',
      '     - Drag "Bushing Order" to "Quoted" stage',
      '     - Try dragging a job BACKWARD — it should work',
      '       (unless the stage is irreversible)',
      '',
      '  2. ASSIGN WORK:',
      '     - Click on "Motor Mount Weld" card',
      '     - In the detail panel, click "Edit"',
      '     - Assign to A. Kim',
      '     - Save',
      '     - Assign "Titanium Pin Run" to D. Hart',
      '',
      '  3. BULK OPERATIONS:',
      '     - Ctrl+Click on 3 jobs in the same column',
      '     - Use the bulk action bar to Move them to a new stage',
      '     - Or Bulk Assign them to J. Silva',
      '',
      '  4. JOB DETAIL:',
      '     - Click any job card to open detail panel',
      '     - Switch to the Activity tab — see creation log',
      '     - Switch to Subtasks tab — add a subtask',
      '       (e.g., "Verify tooling setup")',
      '     - Switch to Files tab — try uploading a file',
      '',
      'Click RESUME when done.',
    ]);
    step('✓ Kanban management checkpoint passed');
  });

  test('user tracks time', async () => {
    await checkpoint(page, 'TIME TRACKING — TIMER + MANUAL', [
      'Test the time tracking system:',
      '',
      'YOUR TASKS:',
      '  1. Navigate to /time-tracking',
      '',
      '  2. START A TIMER:',
      '     - Click "Start Timer"',
      '     - Select a category (Production, Setup, etc.)',
      '     - Add notes: "Working on housing batch"',
      '     - Click Start',
      '     - Watch the running timer in the header',
      '     - Wait 10-15 seconds, then click "Stop Timer"',
      '     - Add stop notes if prompted',
      '     - Verify the entry appears in the table',
      '',
      '  3. MANUAL TIME ENTRY:',
      '     - Click "Manual Entry"',
      '     - Set date to today',
      '     - Enter hours: 4, minutes: 30',
      '     - Select category: Production',
      '     - Add notes: "Completed housing units 1-25"',
      '     - Click "Log Entry"',
      '     - Verify it appears in the table',
      '',
      '  4. Check the total hours shown in the page header',
      '',
      'Click RESUME when done.',
    ]);
    step('✓ Time tracking checkpoint passed');
  });
});
