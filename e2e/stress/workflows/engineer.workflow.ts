import type { Page } from 'playwright';
import type { Workflow } from '../orchestrator';
import { fillByTestId, selectByTestId, selectNthByTestId, clickByTestId, fillDateByTestId, fillForm, fillEntityPickerByTestId } from '../../lib/form.lib';
import { closeDialog } from '../../lib/dialog.lib';
import { waitForAnySnackbar, dismissSnackbar } from '../../lib/snackbar.lib';
import { waitForTable, sortByColumn } from '../../lib/data-table.lib';
import { randomDelay, testId, maybe, randomPick, randomInt, randomDate, randomAmount } from '../../lib/random.lib';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NAV_TIMEOUT = 15_000;
const ELEMENT_TIMEOUT = 8_000;

// ---------------------------------------------------------------------------
// Data pools
// ---------------------------------------------------------------------------

const TRACK_TYPES = ['Production', 'R&D/Tooling', 'Maintenance'];
const CUSTOMERS = ['Acme Corp', 'Apex Manufacturing', 'Quantum Dynamics', 'Meridian Systems'];
const PRIORITIES = ['Low', 'Normal', 'High', 'Urgent'];

const JOB_TITLES = [
  'CNC bracket assembly — 6061-T6 aluminum',
  'Hydraulic manifold block — cross-drilled',
  'Prototype housing weldment — A36 steel',
  'Drive coupling rework — replace spline teeth',
  'Fixture build — modular clamp system',
  'Precision shaft machining — 4140 HT steel',
  'Adapter plate fabrication — 304SS waterjet',
  'Motor mount redesign — FEA-optimized',
  'Gearbox housing — cast iron, 5-axis finish',
  'Pneumatic valve body — brass, tight bore tolerance',
];

const JOB_DESCRIPTIONS = [
  'CNC bracket assembly — 6061-T6 aluminum, 5-axis mill, tight positional tolerance on mounting holes. Need to verify fixture clearance before programming.',
  'Hydraulic manifold block — cross-drilled ports, burst-test required before ship. Customer spec: 3000 PSI working pressure, 4:1 safety factor.',
  'Prototype housing weldment — A36 steel frame with stainless cover plate, powder coat finish. First article required before production run.',
  'Drive coupling rework — replace worn spline teeth, balance to G2.5 at 3600 RPM. Existing coupling has 12k hours, customer wants refurb vs. replace analysis.',
  'Fixture build for production run — modular clamp system, quick-change tooling interface. Must accommodate 3 part families with single base plate.',
  'Precision shaft machining — 4140 HT steel, ground OD to h6, concentricity within 0.0005". Heat treat to 28-32 HRC before final grind.',
  'Adapter plate fabrication — waterjet cut 0.5" 304SS, match-drill to existing bolt pattern. Surface finish 125 Ra max on mating face.',
  'Motor mount redesign — FEA-optimized topology, reduce mass 15% while maintaining stiffness. Natural frequency must clear 120 Hz operating range.',
];

const TIMER_START_NOTES = [
  'Starting CAD modeling for new bracket assembly',
  'Beginning tolerance stack-up analysis',
  'Programming 5-axis toolpaths in Mastercam',
  'Reviewing customer spec package and generating RFQ response',
  'Working on BOM updates after design review feedback',
  'Setting up FEA simulation for motor mount',
  'Drafting inspection plan for first article',
  'Reviewing and marking up shop drawings',
];

const TIMER_STOP_NOTES = [
  'Completed initial 3D model — ready for design review',
  'Stack-up shows 0.002" margin — acceptable, documenting results',
  'Roughing toolpaths done, finishing passes tomorrow',
  'RFQ response drafted — needs manager review before sending',
  'BOM updated with revised quantities and lead times',
  'FEA converged — max stress 18 ksi, well below 36 ksi yield',
  'Inspection plan complete — 14 characteristics, 3 critical',
  'Shop drawings marked up and returned to drafting',
];

const TIME_ENTRY_NOTES = [
  'CAD modeling for bracket assembly — completed 3D model and initial drawing set',
  'GD&T review with QC — updated callouts on housing weldment drawing',
  'Tolerance stack-up analysis for manifold block port alignment',
  'Programming 5-axis toolpaths in CAM — roughing and finishing ops',
  'Design review meeting — discussed material substitution for cost reduction',
  'First article inspection — all dims within spec, released to production',
  'Updated BOM quantities after prototype feedback from shop floor',
  'FEA simulation run — verified deflection under max load condition',
];

const EXPENSE_DESCRIPTIONS = [
  'CAD/CAM software annual license renewal',
  'Precision measuring instruments — digital micrometer set',
  'Engineering reference handbook — Machinery\'s Handbook 31st edition',
  'Calibration service for height gauge and indicator set',
  'Technical training course — advanced GD&T workshop',
  'Replacement carbide inserts for prototype machining',
  'Safety glasses and hearing protection for shop floor visits',
  '3D printing filament for rapid prototyping — PLA and PETG spools',
];

const CHAT_MESSAGES = [
  'Engineering update: released new drawing revision for the bracket assembly',
  'Design review complete — all action items resolved, ready for production release',
  'FEA results look good — max stress is well below yield, proceeding with current design',
  'Updated BOM with revised quantities after prototype build feedback',
  'Material cert received and verified — meets ASTM A36 requirements',
  'First article passed all dimensional checks — Cpk 1.67 on critical features',
  'Heads up: tolerance on bore diameter tightened to +/- 0.001" per customer request',
  'Toolpath simulation clean — no collisions, cycle time estimate 42 min per part',
];

const AI_QUESTIONS = [
  'What is the recommended feed rate for 6061-T6 aluminum on a 5-axis mill?',
  'Show me all jobs that are currently in QC review',
  'What surface finish can I expect from a 0.5" ball end mill at 8000 RPM?',
  'How many open purchase orders do we have for 4140 steel?',
  'What is the typical heat treat specification for 4140 HT steel shafts?',
  'Find all parts with a tolerance tighter than 0.001"',
];

// ---------------------------------------------------------------------------
// Workflow definition
// ---------------------------------------------------------------------------

/**
 * Engineer workflow — simulates a full engineering shift (39 steps).
 *
 * Covers: dashboard, kanban (create job), backlog, parts catalog,
 * quality (inspections/lots/gages), inventory, time tracking (timer + manual),
 * expenses, chat, MRP, scheduling, OEE, purchase orders, reports,
 * planning, training, calendar, AI assistant, notifications, account,
 * global search, security/MFA, customer returns, events, payroll,
 * tax forms, lot records.
 *
 * Creates real data: jobs, time entries, expenses, chat messages.
 */
export function getEngineerWorkflow(): Workflow {
  return {
    name: 'engineer',
    steps: [
      // ---------------------------------------------------------------
      // 1. Dashboard — review KPIs and widgets
      // ---------------------------------------------------------------
      {
        id: 'eng-01',
        name: 'Review dashboard KPIs',
        category: 'browse',
        tags: ['dashboard'],
        execute: async (page: Page) => {
          try {
            await page.goto('/dashboard', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForTimeout(randomDelay(800, 1500));

            const widget = page.locator('app-dashboard-widget, app-kpi-chip').first();
            await widget.waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT }).catch(() => {});
            await page.waitForTimeout(randomDelay(1000, 2000));

            // Scroll through widgets like reading a dashboard
            await page.evaluate(() => window.scrollBy(0, 300)).catch(() => {});
            await page.waitForTimeout(randomDelay(500, 1000));
            await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
          } catch (err) {
            console.log(`[engineer] eng-01 dashboard: ${err instanceof Error ? err.message : err}`);
          }
        },
      },

      // ---------------------------------------------------------------
      // 2. Start timer — begin engineering shift
      // ---------------------------------------------------------------
      {
        id: 'eng-02',
        name: 'Start engineering timer',
        category: 'timer-start',
        tags: ['time-tracking'],
        execute: async (page: Page) => {
          try {
            await page.goto('/time-tracking', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForTimeout(randomDelay(800, 1500));

            // Check if timer is already running (stop button visible)
            const stopBtn = page.locator('[data-testid="stop-timer-btn"]');
            const startBtn = page.locator('[data-testid="start-timer-btn"]');

            if (await stopBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
              console.log('[engineer] eng-02 timer already running — will stop and restart');
              // Timer already running — just note it and continue
              await page.waitForTimeout(randomDelay(500, 1000));
            } else if (await startBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
              await startBtn.click();
              await page.waitForTimeout(randomDelay(500, 1000));

              // Wait for timer dialog
              const dlg = page.locator('app-dialog .dialog').first();
              if (await dlg.isVisible({ timeout: 5000 }).catch(() => false)) {
                try {
                  await selectByTestId(page, 'timer-category', 'Other');
                } catch {
                  // Category may differ — skip
                }
                await page.waitForTimeout(randomDelay(200, 400));

                await fillByTestId(page, 'timer-notes', randomPick(TIMER_START_NOTES));
                await page.waitForTimeout(randomDelay(300, 600));

                await page.evaluate(() => {
                  const btn = document.querySelector('[data-testid="timer-start-btn"]') as HTMLButtonElement;
                  if (btn && !btn.disabled) btn.click();
                });

                const snackbar = await waitForAnySnackbar(page, ELEMENT_TIMEOUT).catch(() => '');
                console.log(`[engineer] eng-02 timer started — snackbar: "${snackbar}"`);
                await dismissSnackbar(page);
              }
              await page.waitForTimeout(randomDelay(500, 1000));
            } else {
              console.log('[engineer] eng-02 no timer buttons visible — skipping');
            }
          } catch (err) {
            console.log(`[engineer] eng-02 start timer: ${err instanceof Error ? err.message : err}`);
            try { await closeDialog(page); } catch { /* ignore */ }
          }
        },
      },

      // ---------------------------------------------------------------
      // 3. Kanban board — browse Production track
      // ---------------------------------------------------------------
      {
        id: 'eng-03',
        name: 'Browse kanban board',
        category: 'browse',
        tags: ['kanban'],
        execute: async (page: Page) => {
          try {
            await page.goto('/kanban', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForTimeout(randomDelay(800, 1500));

            const column = page.locator('app-board-column, .board').first();
            await column.waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT }).catch(() => {});
            await page.waitForTimeout(randomDelay(1000, 2000));

            // Scroll the board horizontally to see all stages
            const board = page.locator('.kanban-board, .board-container').first();
            if (await board.isVisible({ timeout: 2000 }).catch(() => false)) {
              await board.evaluate((el) => el.scrollBy(400, 0)).catch(() => {});
              await page.waitForTimeout(randomDelay(500, 1000));
              await board.evaluate((el) => el.scrollTo(0, 0)).catch(() => {});
            }
          } catch (err) {
            console.log(`[engineer] eng-03 kanban browse: ${err instanceof Error ? err.message : err}`);
          }
        },
      },

      // ---------------------------------------------------------------
      // 4. CREATE JOB — star step, every field filled
      // ---------------------------------------------------------------
      {
        id: 'eng-04',
        name: 'Create new job on kanban board',
        category: 'create',
        tags: ['kanban'],
        execute: async (page: Page) => {
          try {
            // Navigate to kanban and wait for board
            await page.goto('/kanban', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForTimeout(2000);

            // Open the new job dialog
            const newJobBtn = page.locator('[data-testid="new-job-btn"]');
            if (!await newJobBtn.isVisible({ timeout: 8000 }).catch(() => false)) {
              console.log('[engineer] eng-04 new-job-btn not visible — skipping');
              return;
            }
            await newJobBtn.click();
            await page.waitForTimeout(1000);

            // Wait for dialog content to appear
            const dlg = page.locator('app-dialog .dialog').first();
            if (!await dlg.isVisible({ timeout: 5000 }).catch(() => false)) {
              console.log('[engineer] eng-04 dialog not visible — skipping');
              return;
            }

            // Wait for form fields to load (loadingRefs must finish)
            const titleField = page.locator('[data-testid="job-title"]');
            if (!await titleField.isVisible({ timeout: 8000 }).catch(() => false)) {
              console.log('[engineer] eng-04 form fields not visible (possible permissions issue) — skipping');
              await closeDialog(page);
              return;
            }

            // --- Fill every field ---

            // Title — unique engineering job name
            const jobTitle = testId('stress-job');
            await fillByTestId(page, 'job-title', jobTitle);
            await page.waitForTimeout(randomDelay(300, 600));

            // Description — detailed engineering scope
            const jobDescription = randomPick(JOB_DESCRIPTIONS);
            await fillForm(page, { 'job-description': jobDescription });
            await page.waitForTimeout(randomDelay(400, 800));

            // Track type — Production, R&D/Tooling, or Maintenance
            const trackType = randomPick(TRACK_TYPES);
            await selectByTestId(page, 'job-track-type', trackType);
            await page.waitForTimeout(randomDelay(200, 400));

            // Customer
            const customer = randomPick(CUSTOMERS);
            await selectByTestId(page, 'job-customer', customer);
            await page.waitForTimeout(randomDelay(200, 400));

            // Priority
            const priority = randomPick(PRIORITIES);
            await selectByTestId(page, 'job-priority', priority);
            await page.waitForTimeout(randomDelay(200, 400));

            // Due date — 7 to 45 days out
            const dueDate = randomDate(7, 38);
            await fillDateByTestId(page, 'job-due-date', dueDate);
            await page.waitForTimeout(randomDelay(200, 400));

            // Assignee — try to assign (50% chance)
            if (maybe(0.5)) {
              try {
                await selectByTestId(page, 'job-assignee', 'Akim');
              } catch {
                // Assignee list may not match — skip
              }
              await page.waitForTimeout(randomDelay(200, 400));
            }

            // Ensure form is fully settled before saving
            await page.waitForTimeout(1500);

            // Check form validity by verifying save button is enabled
            const saveBtn = page.locator('[data-testid="job-save-btn"]');
            const isEnabled = await saveBtn.isEnabled({ timeout: 3000 }).catch(() => false);
            if (!isEnabled) {
              console.log(`[engineer] eng-04 save button disabled — form invalid, skipping`);
              await closeDialog(page);
              return;
            }

            // Click save via evaluate to bypass any overlay issues
            await page.evaluate(() => {
              const btn = document.querySelector('[data-testid="job-save-btn"]') as HTMLButtonElement;
              if (btn && !btn.disabled) btn.click();
            });
            await page.waitForTimeout(4000);

            // Check if dialog closed (success) or still open (failure)
            const dialogStillOpen = await page.locator('app-dialog .dialog').first().isVisible({ timeout: 1000 }).catch(() => false);
            if (dialogStillOpen) {
              console.log(`[engineer] eng-04 dialog still open after save — job may not have been created`);
              await closeDialog(page);
            } else {
              console.log(`[engineer] eng-04 JOB CREATED: "${jobTitle}" | track=${trackType} customer=${customer} priority=${priority} due=${dueDate}`);
            }

            // Dismiss any snackbar
            await dismissSnackbar(page);
            await page.waitForTimeout(randomDelay(500, 1000));
          } catch (err) {
            console.log(`[engineer] eng-04 job creation FAILED: ${err instanceof Error ? err.message : err}`);
            try { await closeDialog(page); } catch { /* ignore */ }
          }
        },
      },

      // ---------------------------------------------------------------
      // 5. Manual time entry — yesterday's CAD work
      // ---------------------------------------------------------------
      {
        id: 'eng-05',  // originally eng-24
        name: 'Create manual time entry for yesterday',
        category: 'create',
        tags: ['time-tracking'],
        execute: async (page: Page) => {
          try {
            if (!page.url().includes('/time-tracking')) {
              await page.goto('/time-tracking', { waitUntil: 'load', timeout: NAV_TIMEOUT });
              await page.waitForTimeout(randomDelay(800, 1500));
            }

            const content = page.locator('app-data-table, app-page-layout').first();
            await content.waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT }).catch(() => {});

            // Click manual entry button
            const manualBtn = page.locator('[data-testid="manual-entry-btn"]');
            await manualBtn.waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });
            await manualBtn.click();
            await page.waitForTimeout(randomDelay(500, 1000));

            // Wait for dialog
            await page.locator('app-dialog .dialog').first()
              .waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });

            // Fill date (yesterday)
            await fillDateByTestId(page, 'time-entry-date', randomDate(-1, 1));
            await page.waitForTimeout(randomDelay(200, 400));

            // Select category
            try {
              await selectByTestId(page, 'time-entry-category', 'Other');
            } catch { /* skip */ }
            await page.waitForTimeout(randomDelay(200, 400));

            // Fill hours — 3h 30m of CAD work
            await fillByTestId(page, 'time-entry-hours', '3');
            await page.waitForTimeout(randomDelay(100, 300));

            await fillByTestId(page, 'time-entry-minutes', '30');
            await page.waitForTimeout(randomDelay(100, 300));

            // Fill notes
            await fillByTestId(page, 'time-entry-notes', randomPick(TIME_ENTRY_NOTES));
            await page.waitForTimeout(randomDelay(300, 600));

            // Save via DOM click
            await page.waitForTimeout(1000);
            await page.evaluate(() => {
              const btn = document.querySelector('[data-testid="time-entry-save-btn"]') as HTMLButtonElement;
              if (btn && !btn.disabled) btn.click();
            });
            await page.waitForTimeout(3000);
            console.log(`[engineer] eng-05 manual time entry 3h 30m submitted`);
            await dismissSnackbar(page);
            await page.waitForTimeout(randomDelay(500, 1000));
          } catch (err) {
            console.log(`[engineer] eng-05 manual time entry FAILED: ${err instanceof Error ? err.message : err}`);
            try { await closeDialog(page); } catch { /* ignore */ }
          }
        },
      },

      // ---------------------------------------------------------------
      // 6. Expense — submit engineering expense
      // ---------------------------------------------------------------
      {
        id: 'eng-06',  // originally eng-25
        name: 'Submit engineering expense',
        category: 'create',
        tags: ['expenses'],
        execute: async (page: Page) => {
          try {
            await page.goto('/expenses', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForTimeout(randomDelay(800, 1500));

            const content = page.locator('app-data-table, app-page-layout').first();
            await content.waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT }).catch(() => {});

            // Click new expense button
            const newBtn = page.locator('[data-testid="new-expense-btn"]');
            await newBtn.waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });
            await newBtn.click();
            await page.waitForTimeout(randomDelay(500, 1000));

            // Wait for dialog
            await page.locator('app-dialog .dialog').first()
              .waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });

            // Fill amount
            const amount = randomAmount(25, 500);
            await fillByTestId(page, 'expense-amount', amount);
            await page.waitForTimeout(randomDelay(200, 400));

            // Fill date (recent)
            await fillDateByTestId(page, 'expense-date', randomDate(-7, 7));
            await page.waitForTimeout(randomDelay(200, 400));

            // Select category
            try {
              await selectByTestId(page, 'expense-category', 'Tools');
            } catch { /* skip */ }
            await page.waitForTimeout(randomDelay(200, 400));

            // Fill description
            const desc = randomPick(EXPENSE_DESCRIPTIONS);
            await fillByTestId(page, 'expense-description', desc);
            await page.waitForTimeout(randomDelay(300, 600));

            // Save via DOM click
            await page.waitForTimeout(1000);
            await page.evaluate(() => {
              const btn = document.querySelector('[data-testid="expense-save-btn"]') as HTMLButtonElement;
              if (btn && !btn.disabled) btn.click();
            });
            await page.waitForTimeout(3000);
            console.log(`[engineer] eng-06 expense $${amount} "${desc}" submitted`);
            await dismissSnackbar(page);
            await page.waitForTimeout(randomDelay(500, 1000));
          } catch (err) {
            console.log(`[engineer] eng-06 expense FAILED: ${err instanceof Error ? err.message : err}`);
            try { await closeDialog(page); } catch { /* ignore */ }
          }
        },
      },

      // ---------------------------------------------------------------
      // 7. Open job detail — browse tabs
      // ---------------------------------------------------------------
      {
        id: 'eng-07',  // originally eng-05
        name: 'Open a job card and browse detail tabs',
        category: 'browse',
        tags: ['kanban'],
        execute: async (page: Page) => {
          try {
            const card = page.locator('.kanban-card, .job-card').first();
            if (await card.isVisible({ timeout: 3000 }).catch(() => false)) {
              await card.click();
              await page.waitForTimeout(randomDelay(800, 1500));

              // Wait for detail dialog
              const detail = page.locator('mat-dialog-container, app-dialog').first();
              await detail.waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT }).catch(() => {});
              await page.waitForTimeout(randomDelay(1000, 2000));

              // Click through tabs: subtasks, files, activity, parts
              const tabLabels = ['Subtask', 'File', 'Activity', 'Part'];
              for (const label of tabLabels) {
                try {
                  const tab = page.locator('.tab, [role="tab"]').filter({ hasText: new RegExp(label, 'i') }).first();
                  if (await tab.isVisible({ timeout: 1500 }).catch(() => false)) {
                    await tab.click();
                    await page.waitForTimeout(randomDelay(600, 1200));
                  }
                } catch {
                  // Tab may not exist
                }
              }

              // Close the detail
              await page.keyboard.press('Escape');
              await page.waitForTimeout(randomDelay(300, 600));
            }
          } catch (err) {
            console.log(`[engineer] eng-07 job detail: ${err instanceof Error ? err.message : err}`);
          }
        },
      },

      // ---------------------------------------------------------------
      // 8. Parts catalog — browse and sort
      // ---------------------------------------------------------------
      {
        id: 'eng-08',  // originally eng-06
        name: 'Create a part',
        category: 'create',
        tags: ['parts'],
        execute: async (page: Page) => {
          try {
            await page.goto('/parts', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForTimeout(randomDelay(800, 1500));

            await clickByTestId(page, 'new-part-btn');
            await page.waitForTimeout(randomDelay(500, 1000));

            const partType = randomPick(['Component', 'Assembly', 'Raw Material']);
            await selectByTestId(page, 'part-type', partType);
            await page.waitForTimeout(randomDelay(200, 400));

            const partDesc = randomPick([
              'Precision bore sleeve', 'Machined adapter plate',
              'Stainless pivot pin', 'Anodized end cap',
            ]);
            await fillByTestId(page, 'part-description', partDesc);
            await page.waitForTimeout(randomDelay(200, 400));

            const partMaterial = randomPick(['6061-T6 Aluminum', '303 Stainless', '4140 Steel']);
            await fillByTestId(page, 'part-material', partMaterial);
            await page.waitForTimeout(randomDelay(200, 400));

            await clickByTestId(page, 'part-save-btn');
            await page.waitForTimeout(randomDelay(500, 1000));

            await waitForAnySnackbar(page).catch(() => {});
            await dismissSnackbar(page).catch(() => {});
            await page.waitForTimeout(randomDelay(300, 600));
          } catch (err) {
            console.log(`[engineer] eng-08 create part: ${err instanceof Error ? err.message : err}`);
            await page.keyboard.press('Escape').catch(() => {});
          }
          return 'part';
        },
      },

      // ---------------------------------------------------------------
      // 9. Part detail — view BOM tab
      // ---------------------------------------------------------------
      {
        id: 'eng-09',  // originally eng-07
        name: 'View part detail and BOM',
        category: 'browse',
        tags: ['parts', 'bom'],
        execute: async (page: Page) => {
          try {
            // Detail dialog should still be open from previous step
            const detail = page.locator('mat-dialog-container, app-dialog').first();
            if (await detail.isVisible({ timeout: 2000 }).catch(() => false)) {
              // Click BOM tab
              const bomTab = page.locator('.tab, [role="tab"]').filter({ hasText: /bom/i }).first();
              if (await bomTab.isVisible({ timeout: 2000 }).catch(() => false)) {
                await bomTab.click();
                await page.waitForTimeout(randomDelay(800, 1500));
              }

              // Browse operations tab too
              const opsTab = page.locator('.tab, [role="tab"]').filter({ hasText: /operation/i }).first();
              if (await opsTab.isVisible({ timeout: 1500 }).catch(() => false)) {
                await opsTab.click();
                await page.waitForTimeout(randomDelay(600, 1200));
              }

              await page.keyboard.press('Escape');
              await page.waitForTimeout(randomDelay(300, 600));
            }
          } catch (err) {
            console.log(`[engineer] eng-09 part detail: ${err instanceof Error ? err.message : err}`);
          }
        },
      },

      // ---------------------------------------------------------------
      // 10. Backlog — sort by Priority
      // ---------------------------------------------------------------
      {
        id: 'eng-10',  // originally eng-08
        name: 'Browse backlog sorted by priority',
        category: 'browse',
        tags: ['backlog'],
        execute: async (page: Page) => {
          try {
            await page.goto('/backlog', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForTimeout(randomDelay(800, 1500));

            await waitForTable(page, 1, ELEMENT_TIMEOUT).catch(() => {});
            await page.waitForTimeout(randomDelay(500, 1000));

            await sortByColumn(page, 'Priority');
            await page.waitForTimeout(randomDelay(800, 1500));

            // Double-sort for descending
            if (maybe(0.5)) {
              await sortByColumn(page, 'Priority');
              await page.waitForTimeout(randomDelay(500, 1000));
            }

            // Also sort by due date
            await sortByColumn(page, 'Due').catch(() => {});
            await page.waitForTimeout(randomDelay(500, 1000));
          } catch (err) {
            console.log(`[engineer] eng-10 backlog: ${err instanceof Error ? err.message : err}`);
          }
        },
      },

      // ---------------------------------------------------------------
      // 11. Backlog — open a job detail
      // ---------------------------------------------------------------
      {
        id: 'eng-11',  // originally eng-09
        name: 'Open backlog job detail',
        category: 'browse',
        tags: ['backlog'],
        execute: async (page: Page) => {
          try {
            const firstRow = page.locator('app-data-table tbody tr').first();
            if (await firstRow.isVisible({ timeout: 2000 }).catch(() => false)) {
              await firstRow.click();
              await page.waitForTimeout(randomDelay(800, 1500));

              // Read the detail
              const detail = page.locator('mat-dialog-container, app-dialog').first();
              await detail.waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT }).catch(() => {});
              await page.waitForTimeout(randomDelay(1000, 2000));

              // Close
              await page.keyboard.press('Escape');
              await page.waitForTimeout(randomDelay(300, 600));
            }
          } catch (err) {
            console.log(`[engineer] eng-11 backlog detail: ${err instanceof Error ? err.message : err}`);
          }
        },
      },

      // ---------------------------------------------------------------
      // 12. Quality — inspections tab
      // ---------------------------------------------------------------
      {
        id: 'eng-12',  // originally eng-10
        name: 'Create quality inspection',
        category: 'create',
        tags: ['quality'],
        execute: async (page: Page) => {
          try {
            await page.goto('/quality/inspections', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForTimeout(randomDelay(800, 1500));

            await clickByTestId(page, 'new-inspection-btn');
            await page.waitForTimeout(randomDelay(500, 1000));

            await fillByTestId(page, 'inspection-notes', `Stress test inspection — ${new Date().toISOString()}`);
            await page.waitForTimeout(randomDelay(200, 400));

            await clickByTestId(page, 'inspection-save-btn');
            await page.waitForTimeout(randomDelay(500, 1000));

            await waitForAnySnackbar(page).catch(() => {});
            await dismissSnackbar(page).catch(() => {});
            await page.waitForTimeout(randomDelay(300, 600));
          } catch (err) {
            console.log(`[engineer] eng-12 create inspection: ${err instanceof Error ? err.message : err}`);
            await page.keyboard.press('Escape').catch(() => {});
          }
          return 'inspection';
        },
      },

      // ---------------------------------------------------------------
      // 13. Quality — lots tab
      // ---------------------------------------------------------------
      {
        id: 'eng-13',  // originally eng-11
        name: 'Browse quality lots',
        category: 'browse',
        tags: ['quality'],
        execute: async (page: Page) => {
          try {
            await page.goto('/quality/lots', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForTimeout(randomDelay(800, 1500));

            const content = page.locator('app-data-table, app-page-layout').first();
            await content.waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT }).catch(() => {});
            await page.waitForTimeout(randomDelay(800, 1500));
          } catch (err) {
            console.log(`[engineer] eng-13 quality lots: ${err instanceof Error ? err.message : err}`);
          }
        },
      },

      // ---------------------------------------------------------------
      // 14. Quality — gages tab
      // ---------------------------------------------------------------
      {
        id: 'eng-14',  // originally eng-12
        name: 'Browse quality gages',
        category: 'browse',
        tags: ['quality'],
        execute: async (page: Page) => {
          try {
            await page.goto('/quality/gages', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForTimeout(randomDelay(800, 1500));

            const content = page.locator('app-data-table, app-page-layout').first();
            await content.waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT }).catch(() => {});
            await page.waitForTimeout(randomDelay(800, 1500));
          } catch (err) {
            console.log(`[engineer] eng-14 quality gages: ${err instanceof Error ? err.message : err}`);
          }
        },
      },

      // ---------------------------------------------------------------
      // 15. Inventory — browse stock
      // ---------------------------------------------------------------
      {
        id: 'eng-15',  // originally eng-13
        name: 'Browse inventory stock',
        category: 'browse',
        tags: ['inventory'],
        execute: async (page: Page) => {
          try {
            await page.goto('/inventory/stock', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForTimeout(randomDelay(800, 1500));

            const content = page.locator('app-data-table, app-page-layout').first();
            await content.waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT }).catch(() => {});
            await page.waitForTimeout(randomDelay(500, 1000));

            // Try searching for a material
            const searchInput = page.locator('app-input input, [placeholder*="earch" i]').first();
            if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
              await searchInput.click();
              await searchInput.fill(randomPick(['aluminum', 'steel', '4140', '6061', 'brass']));
              await page.waitForTimeout(randomDelay(800, 1500));
              // Clear search
              await searchInput.fill('');
              await page.waitForTimeout(randomDelay(300, 600));
            }
          } catch (err) {
            console.log(`[engineer] eng-15 inventory: ${err instanceof Error ? err.message : err}`);
          }
        },
      },

      // ---------------------------------------------------------------
      // 16. Stop timer — first engineering block done
      // ---------------------------------------------------------------
      {
        id: 'eng-16',  // originally eng-14
        name: 'Stop engineering timer',
        category: 'timer-stop',
        tags: ['time-tracking'],
        execute: async (page: Page) => {
          try {
            await page.goto('/time-tracking', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForTimeout(randomDelay(800, 1500));

            const stopBtn = page.locator('[data-testid="stop-timer-btn"]');
            if (await stopBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
              await stopBtn.click();
              await page.waitForTimeout(randomDelay(500, 1000));

              // Fill stop notes
              await page.locator('app-dialog .dialog').first()
                .waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT }).catch(() => {});

              await fillByTestId(page, 'timer-stop-notes', randomPick(TIMER_STOP_NOTES));
              await page.waitForTimeout(randomDelay(300, 600));

              await page.locator('[data-testid="timer-stop-btn"]').click();

              const snackbar = await waitForAnySnackbar(page, ELEMENT_TIMEOUT).catch(() => '');
              console.log(`[engineer] eng-16 timer stopped — snackbar: "${snackbar}"`);
              await dismissSnackbar(page);
            } else {
              console.log('[engineer] eng-16 no active timer to stop');
            }
            await page.waitForTimeout(randomDelay(500, 1000));
          } catch (err) {
            console.log(`[engineer] eng-16 stop timer: ${err instanceof Error ? err.message : err}`);
            try { await closeDialog(page); } catch { /* ignore */ }
          }
        },
      },

      // ---------------------------------------------------------------
      // 17. Chat — send engineering update
      // ---------------------------------------------------------------
      {
        id: 'eng-17',  // originally eng-15
        name: 'Send engineering chat message',
        category: 'chat',
        tags: ['chat'],
        execute: async (page: Page) => {
          try {
            await page.goto('/chat', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForTimeout(randomDelay(800, 1500));

            const chatContainer = page.locator('app-chat, .chat-container').first();
            await chatContainer.waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT }).catch(() => {});
            await page.waitForTimeout(randomDelay(500, 1000));

            // Find chat input and type message
            const chatInput = page.locator('[data-testid="chat-message-input"] input, [data-testid="chat-message-input"] textarea').first();
            if (await chatInput.isVisible({ timeout: 3000 }).catch(() => false)) {
              const message = randomPick(CHAT_MESSAGES);
              await chatInput.click();
              await chatInput.fill(message);
              await page.waitForTimeout(randomDelay(300, 600));

              const sendBtn = page.locator('[data-testid="chat-send-btn"]');
              if (await sendBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
                await sendBtn.click();
              } else {
                await chatInput.press('Enter');
              }
              await page.waitForTimeout(randomDelay(500, 1000));
            }
          } catch (err) {
            console.log(`[engineer] eng-17 chat: ${err instanceof Error ? err.message : err}`);
          }
        },
      },

      // ---------------------------------------------------------------
      // 18. Start new timer — second engineering block
      // ---------------------------------------------------------------
      {
        id: 'eng-18',  // originally eng-16
        name: 'Start second engineering timer',
        category: 'timer-start',
        tags: ['time-tracking'],
        execute: async (page: Page) => {
          try {
            await page.goto('/time-tracking', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForTimeout(randomDelay(800, 1500));

            // Check if timer is already running (stop button visible)
            const stopBtn = page.locator('[data-testid="stop-timer-btn"]');
            const startBtn = page.locator('[data-testid="start-timer-btn"]');

            if (await stopBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
              console.log('[engineer] eng-18 timer already running — skipping start');
              await page.waitForTimeout(randomDelay(500, 1000));
            } else if (await startBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
              await startBtn.click();
              await page.waitForTimeout(randomDelay(500, 1000));

              await page.locator('app-dialog .dialog').first()
                .waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });

              try {
                await selectByTestId(page, 'timer-category', 'Other');
              } catch { /* skip */ }
              await page.waitForTimeout(randomDelay(200, 400));

              await fillByTestId(page, 'timer-notes', randomPick(TIMER_START_NOTES));
              await page.waitForTimeout(randomDelay(300, 600));

              await page.evaluate(() => {
                const btn = document.querySelector('[data-testid="timer-start-btn"]') as HTMLButtonElement;
                if (btn && !btn.disabled) btn.click();
              });

              const snackbar = await waitForAnySnackbar(page, ELEMENT_TIMEOUT).catch(() => '');
              console.log(`[engineer] eng-18 second timer started — snackbar: "${snackbar}"`);
              await dismissSnackbar(page);
              await page.waitForTimeout(randomDelay(500, 1000));
            } else {
              console.log('[engineer] eng-18 no timer buttons visible — skipping');
            }
          } catch (err) {
            console.log(`[engineer] eng-18 start timer: ${err instanceof Error ? err.message : err}`);
            try { await closeDialog(page); } catch { /* ignore */ }
          }
        },
      },

      // ---------------------------------------------------------------
      // 19. MRP — browse planned orders
      // ---------------------------------------------------------------
      {
        id: 'eng-19',  // originally eng-17
        name: 'Browse MRP planned orders',
        category: 'browse',
        tags: ['mrp'],
        execute: async (page: Page) => {
          try {
            await page.goto('/mrp/planned-orders', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForTimeout(randomDelay(800, 1500));

            const content = page.locator('app-data-table, app-page-layout, .mrp-container').first();
            await content.waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT }).catch(() => {});
            await page.waitForTimeout(randomDelay(800, 1500));

            // Also check the dashboard tab
            try {
              const dashTab = page.locator('.tab, [role="tab"]').filter({ hasText: /dashboard/i }).first();
              if (await dashTab.isVisible({ timeout: 1500 }).catch(() => false)) {
                await dashTab.click();
                await page.waitForTimeout(randomDelay(600, 1200));
              }
            } catch { /* tab may not exist */ }

            // Check exceptions tab
            try {
              const excTab = page.locator('.tab, [role="tab"]').filter({ hasText: /exception/i }).first();
              if (await excTab.isVisible({ timeout: 1500 }).catch(() => false)) {
                await excTab.click();
                await page.waitForTimeout(randomDelay(600, 1200));
              }
            } catch { /* tab may not exist */ }
          } catch (err) {
            console.log(`[engineer] eng-19 MRP: ${err instanceof Error ? err.message : err}`);
          }
        },
      },

      // ---------------------------------------------------------------
      // 20. Scheduling — browse schedule
      // ---------------------------------------------------------------
      {
        id: 'eng-20',  // originally eng-18
        name: 'Browse scheduling view',
        category: 'browse',
        tags: ['calendar'],
        execute: async (page: Page) => {
          try {
            await page.goto('/scheduling', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForTimeout(randomDelay(800, 1500));

            const content = page.locator('app-page-layout, .scheduling-container, app-data-table').first();
            await content.waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT }).catch(() => {});
            await page.waitForTimeout(randomDelay(1000, 2000));
          } catch (err) {
            console.log(`[engineer] eng-20 scheduling: ${err instanceof Error ? err.message : err}`);
          }
        },
      },

      // ---------------------------------------------------------------
      // 21. OEE — browse metrics
      // ---------------------------------------------------------------
      {
        id: 'eng-21',  // originally eng-19
        name: 'Browse OEE metrics',
        category: 'browse',
        tags: ['reports'],
        execute: async (page: Page) => {
          try {
            await page.goto('/oee', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForTimeout(randomDelay(800, 1500));

            const content = page.locator('app-page-layout, .oee-container, app-kpi-chip, app-dashboard-widget').first();
            await content.waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT }).catch(() => {});
            await page.waitForTimeout(randomDelay(1000, 2000));
          } catch (err) {
            console.log(`[engineer] eng-21 OEE: ${err instanceof Error ? err.message : err}`);
          }
        },
      },

      // ---------------------------------------------------------------
      // 22. Purchase orders — check material orders
      // ---------------------------------------------------------------
      {
        id: 'eng-22',  // originally eng-20
        name: 'Browse purchase orders',
        category: 'browse',
        tags: ['inventory'],
        execute: async (page: Page) => {
          try {
            await page.goto('/purchase-orders', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForTimeout(randomDelay(800, 1500));

            await waitForTable(page, 0, ELEMENT_TIMEOUT).catch(() => {});
            await page.waitForTimeout(randomDelay(500, 1000));

            // Sort by status
            try {
              await sortByColumn(page, 'Status');
              await page.waitForTimeout(randomDelay(500, 1000));
            } catch { /* column may differ */ }

            // Click a PO row to view detail
            try {
              const row = page.locator('app-data-table tbody tr').first();
              if (await row.isVisible({ timeout: 2000 }).catch(() => false)) {
                await row.click();
                await page.waitForTimeout(randomDelay(800, 1500));
                await page.keyboard.press('Escape');
                await page.waitForTimeout(randomDelay(300, 600));
              }
            } catch { /* no data */ }
          } catch (err) {
            console.log(`[engineer] eng-22 purchase orders: ${err instanceof Error ? err.message : err}`);
          }
        },
      },

      // ---------------------------------------------------------------
      // 23. Reports — run a report
      // ---------------------------------------------------------------
      {
        id: 'eng-23',  // originally eng-21
        name: 'Browse reports and run one',
        category: 'report',
        tags: ['reports'],
        execute: async (page: Page) => {
          try {
            await page.goto('/reports', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForTimeout(randomDelay(800, 1500));

            const content = page.locator('app-page-layout, .reports-container').first();
            await content.waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT }).catch(() => {});
            await page.waitForTimeout(randomDelay(500, 1000));

            // Try clicking a report template (Jobs by Stage, Time in Stage, etc.)
            const reportLinks = ['Jobs by Stage', 'Time in Stage', 'Jobs by Priority', 'Open Jobs'];
            for (const label of reportLinks) {
              try {
                const link = page.locator(`text=${label}`).first();
                if (await link.isVisible({ timeout: 1500 }).catch(() => false)) {
                  await link.click();
                  await page.waitForTimeout(randomDelay(1000, 2000));
                  break;
                }
              } catch { /* report may not exist */ }
            }

            await page.waitForTimeout(randomDelay(800, 1500));
          } catch (err) {
            console.log(`[engineer] eng-23 reports: ${err instanceof Error ? err.message : err}`);
          }
        },
      },

      // ---------------------------------------------------------------
      // 24. Planning — browse current cycle
      // ---------------------------------------------------------------
      {
        id: 'eng-24',  // originally eng-22
        name: 'Browse planning cycle',
        category: 'browse',
        tags: ['backlog'],
        execute: async (page: Page) => {
          try {
            await page.goto('/planning', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForTimeout(randomDelay(800, 1500));

            const content = page.locator('app-page-layout, .planning-container, app-data-table').first();
            await content.waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT }).catch(() => {});
            await page.waitForTimeout(randomDelay(1000, 2000));

            // Click a planning cycle row if data exists
            try {
              const row = page.locator('app-data-table tbody tr, .planning-cycle-card').first();
              if (await row.isVisible({ timeout: 2000 }).catch(() => false)) {
                await row.click();
                await page.waitForTimeout(randomDelay(800, 1500));
                await page.keyboard.press('Escape');
                await page.waitForTimeout(randomDelay(300, 600));
              }
            } catch { /* no data */ }
          } catch (err) {
            console.log(`[engineer] eng-24 planning: ${err instanceof Error ? err.message : err}`);
          }
        },
      },

      // ---------------------------------------------------------------
      // 25. Stop timer — second block done
      // ---------------------------------------------------------------
      {
        id: 'eng-25',  // originally eng-23
        name: 'Stop second engineering timer',
        category: 'timer-stop',
        tags: ['time-tracking'],
        execute: async (page: Page) => {
          try {
            await page.goto('/time-tracking', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForTimeout(randomDelay(800, 1500));

            const stopBtn = page.locator('[data-testid="stop-timer-btn"]');
            if (await stopBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
              await stopBtn.click();
              await page.waitForTimeout(randomDelay(500, 1000));

              await page.locator('app-dialog .dialog').first()
                .waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT }).catch(() => {});

              await fillByTestId(page, 'timer-stop-notes', randomPick(TIMER_STOP_NOTES));
              await page.waitForTimeout(randomDelay(300, 600));

              await page.locator('[data-testid="timer-stop-btn"]').click();

              const snackbar = await waitForAnySnackbar(page, ELEMENT_TIMEOUT).catch(() => '');
              console.log(`[engineer] eng-25 timer stopped — snackbar: "${snackbar}"`);
              await dismissSnackbar(page);
            } else {
              console.log('[engineer] eng-25 no active timer to stop');
            }
            await page.waitForTimeout(randomDelay(500, 1000));
          } catch (err) {
            console.log(`[engineer] eng-25 stop timer: ${err instanceof Error ? err.message : err}`);
            try { await closeDialog(page); } catch { /* ignore */ }
          }
        },
      },

      // ---------------------------------------------------------------
      // 26. Training — browse modules
      // ---------------------------------------------------------------
      {
        id: 'eng-26',
        name: 'Browse training modules',
        category: 'browse',
        tags: ['training'],
        execute: async (page: Page) => {
          try {
            await page.goto('/training/my-learning', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForTimeout(randomDelay(800, 1500));

            const content = page.locator('app-page-layout, app-data-table, .training-container').first();
            await content.waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT }).catch(() => {});
            await page.waitForTimeout(randomDelay(800, 1500));

            // Switch to catalog tab
            try {
              const catalogTab = page.locator('.tab, [role="tab"]').filter({ hasText: /catalog/i }).first();
              if (await catalogTab.isVisible({ timeout: 2000 }).catch(() => false)) {
                await catalogTab.click();
                await page.waitForTimeout(randomDelay(800, 1500));
              }
            } catch { /* tab may not exist */ }

            // Click a training module if available
            try {
              const moduleCard = page.locator('app-data-table tbody tr, .training-card, .module-card').first();
              if (await moduleCard.isVisible({ timeout: 2000 }).catch(() => false)) {
                await moduleCard.click();
                await page.waitForTimeout(randomDelay(800, 1500));
                await page.keyboard.press('Escape');
                await page.waitForTimeout(randomDelay(300, 600));
              }
            } catch { /* no modules */ }
          } catch (err) {
            console.log(`[engineer] eng-26 training: ${err instanceof Error ? err.message : err}`);
          }
        },
      },

      // ---------------------------------------------------------------
      // 27. Calendar — check schedule
      // ---------------------------------------------------------------
      {
        id: 'eng-27',
        name: 'Check calendar schedule',
        category: 'browse',
        tags: ['calendar'],
        execute: async (page: Page) => {
          try {
            await page.goto('/calendar', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForTimeout(randomDelay(800, 1500));

            const content = page.locator('app-page-layout, .calendar-container, mat-calendar, .fc-view').first();
            await content.waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT }).catch(() => {});
            await page.waitForTimeout(randomDelay(1000, 2000));

            // Click a day or event if visible
            try {
              const event = page.locator('.fc-event, .calendar-event').first();
              if (await event.isVisible({ timeout: 2000 }).catch(() => false)) {
                await event.click();
                await page.waitForTimeout(randomDelay(800, 1500));
                await page.keyboard.press('Escape');
              }
            } catch { /* no events */ }
          } catch (err) {
            console.log(`[engineer] eng-27 calendar: ${err instanceof Error ? err.message : err}`);
          }
        },
      },

      // ---------------------------------------------------------------
      // 28. AI assistant — ask an engineering question
      // ---------------------------------------------------------------
      {
        id: 'eng-28',
        name: 'Use AI assistant',
        category: 'search',
        tags: ['ai'],
        execute: async (page: Page) => {
          try {
            await page.goto('/ai', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForTimeout(randomDelay(800, 1500));

            const content = page.locator('app-page-layout, .ai-container, .chat-container').first();
            await content.waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT }).catch(() => {});
            await page.waitForTimeout(randomDelay(500, 1000));

            // Try to type a question
            const aiInput = page.locator('textarea, input[type="text"]').last();
            if (await aiInput.isVisible({ timeout: 3000 }).catch(() => false)) {
              await aiInput.click();
              await aiInput.fill(randomPick(AI_QUESTIONS));
              await page.waitForTimeout(randomDelay(500, 1000));

              // Submit
              await aiInput.press('Enter');
              await page.waitForTimeout(randomDelay(2000, 4000));
            }
          } catch (err) {
            console.log(`[engineer] eng-28 AI: ${err instanceof Error ? err.message : err}`);
          }
        },
      },

      // ---------------------------------------------------------------
      // 29. Notifications — check notification panel
      // ---------------------------------------------------------------
      {
        id: 'eng-29',
        name: 'Check notifications',
        category: 'browse',
        tags: ['notifications'],
        execute: async (page: Page) => {
          try {
            const bellBtn = page.locator(
              'button[aria-label*="notification" i], button[aria-label*="Notification"]',
            ).first();

            if (await bellBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
              await bellBtn.click();
              await page.waitForTimeout(randomDelay(1000, 2000));

              // Browse notification panel
              const panel = page.locator('.notification-panel, app-notification-panel').first();
              if (await panel.isVisible({ timeout: 2000 }).catch(() => false)) {
                await page.waitForTimeout(randomDelay(1000, 2000));

                // Try switching notification tabs
                const alertsTab = page.locator('.tab, [role="tab"]').filter({ hasText: /alert/i }).first();
                if (await alertsTab.isVisible({ timeout: 1500 }).catch(() => false)) {
                  await alertsTab.click();
                  await page.waitForTimeout(randomDelay(500, 1000));
                }
              }

              // Close
              await page.keyboard.press('Escape');
              await page.waitForTimeout(randomDelay(300, 600));
            }
          } catch (err) {
            console.log(`[engineer] eng-29 notifications: ${err instanceof Error ? err.message : err}`);
          }
        },
      },

      // ---------------------------------------------------------------
      // 30. Account profile — quick review
      // ---------------------------------------------------------------
      {
        id: 'eng-30',
        name: 'Review account profile',
        category: 'browse',
        tags: ['account'],
        execute: async (page: Page) => {
          try {
            await page.goto('/account', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForTimeout(randomDelay(800, 1500));

            const content = page.locator('app-page-layout, .account-container, .profile-container').first();
            await content.waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT }).catch(() => {});
            await page.waitForTimeout(randomDelay(1000, 2000));
          } catch (err) {
            console.log(`[engineer] eng-30 account: ${err instanceof Error ? err.message : err}`);
          }
        },
      },

      // ---------------------------------------------------------------
      // 32. Global search — press Ctrl+K, type term, read results
      // ---------------------------------------------------------------
      {
        id: 'eng-32',
        name: 'Use global search',
        category: 'search',
        tags: ['search', 'header'],
        execute: async (page: Page) => {
          try {
            await page.keyboard.press('Control+k');
            await page.waitForTimeout(randomDelay(500, 1000));

            const searchInput = page.locator('input[type="search"], .search-input, [placeholder*="Search"]').first();
            if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
              const terms = ['bracket', 'motor', 'seal', 'pump', 'gasket'];
              await searchInput.fill(randomPick(terms));
              await page.waitForTimeout(randomDelay(1000, 2000));
            }

            await page.keyboard.press('Escape');
            await page.waitForTimeout(randomDelay(300, 600));
          } catch (err) {
            console.log(`[engineer] eng-32 global search: ${err instanceof Error ? err.message : err}`);
          }
        },
      },

      // ---------------------------------------------------------------
      // 33. Account security / MFA — browse
      // ---------------------------------------------------------------
      {
        id: 'eng-33',
        name: 'Browse account security / MFA',
        category: 'browse',
        tags: ['account', 'security'],
        execute: async (page: Page) => {
          try {
            await page.goto('/account/security', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForTimeout(randomDelay(800, 1500));

            const content = page.locator('app-page-layout, .security-container, .account-container').first();
            await content.waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT }).catch(() => {});
            await page.waitForTimeout(randomDelay(1000, 2000));
          } catch (err) {
            console.log(`[engineer] eng-33 account security: ${err instanceof Error ? err.message : err}`);
          }
        },
      },

      // ---------------------------------------------------------------
      // 34. Customer returns — browse
      // ---------------------------------------------------------------
      {
        id: 'eng-34',
        name: 'Browse customer returns',
        category: 'browse',
        tags: ['customer-returns'],
        execute: async (page: Page) => {
          try {
            await page.goto('/customer-returns', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForTimeout(randomDelay(800, 1500));

            await waitForTable(page, ELEMENT_TIMEOUT).catch(() => {});
            await page.waitForTimeout(randomDelay(1000, 2000));
          } catch (err) {
            console.log(`[engineer] eng-34 customer returns: ${err instanceof Error ? err.message : err}`);
          }
        },
      },

      // ---------------------------------------------------------------
      // 35. Upcoming events — browse (may 403 for engineer role)
      // ---------------------------------------------------------------
      {
        id: 'eng-35',
        name: 'Browse upcoming events',
        category: 'browse',
        tags: ['events'],
        execute: async (page: Page) => {
          try {
            await page.goto('/admin/events', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForTimeout(randomDelay(800, 1500));

            const content = page.locator('app-page-layout, app-data-table, .events-container').first();
            await content.waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT }).catch(() => {});
            await page.waitForTimeout(randomDelay(1000, 2000));
          } catch (err) {
            // Engineer role may not have access — that's expected
            console.log(`[engineer] eng-35 events: ${err instanceof Error ? err.message : err}`);
          }
        },
      },

      // ---------------------------------------------------------------
      // 36. Account pay stubs — browse
      // ---------------------------------------------------------------
      {
        id: 'eng-36',
        name: 'Browse account pay stubs',
        category: 'browse',
        tags: ['account', 'payroll'],
        execute: async (page: Page) => {
          try {
            await page.goto('/account/pay-stubs', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForTimeout(randomDelay(800, 1500));

            const content = page.locator('app-page-layout, app-data-table, .pay-stubs-container').first();
            await content.waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT }).catch(() => {});
            await page.waitForTimeout(randomDelay(1000, 2000));
          } catch (err) {
            console.log(`[engineer] eng-36 pay stubs: ${err instanceof Error ? err.message : err}`);
          }
        },
      },

      // ---------------------------------------------------------------
      // 37. Account tax forms — browse
      // ---------------------------------------------------------------
      {
        id: 'eng-37',
        name: 'Browse account tax forms',
        category: 'browse',
        tags: ['account', 'compliance'],
        execute: async (page: Page) => {
          try {
            await page.goto('/account/tax-forms', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForTimeout(randomDelay(800, 1500));

            const content = page.locator('app-page-layout, app-data-table, .tax-forms-container').first();
            await content.waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT }).catch(() => {});
            await page.waitForTimeout(randomDelay(1000, 2000));
          } catch (err) {
            console.log(`[engineer] eng-37 tax forms: ${err instanceof Error ? err.message : err}`);
          }
        },
      },

      // ---------------------------------------------------------------
      // 38. Lot records — create
      // ---------------------------------------------------------------
      {
        id: 'eng-38',
        name: 'Create lot record',
        category: 'create',
        tags: ['lots', 'quality'],
        execute: async (page: Page) => {
          try {
            await page.goto('/lots', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForTimeout(randomDelay(800, 1500));

            await clickByTestId(page, 'new-lot-btn');
            await page.waitForTimeout(randomDelay(500, 1000));

            // Fill required entity-picker: part
            let foundPart = await fillEntityPickerByTestId(page, 'lot-part', 'bracket');
            if (!foundPart) foundPart = await fillEntityPickerByTestId(page, 'lot-part', 'aluminum');
            if (!foundPart) foundPart = await fillEntityPickerByTestId(page, 'lot-part', 'steel');
            if (!foundPart) foundPart = await fillEntityPickerByTestId(page, 'lot-part', 'bearing');
            if (!foundPart) {
              console.log('[engineer] eng-38 no parts found for entity-picker — skipping lot creation');
              await page.keyboard.press('Escape').catch(() => {});
              return;
            }
            await page.waitForTimeout(randomDelay(200, 400));

            await fillByTestId(page, 'lot-quantity', String(randomInt(10, 200)));
            await page.waitForTimeout(randomDelay(200, 400));

            await fillByTestId(page, 'lot-notes', `Stress test lot — ${new Date().toISOString()}`);
            await page.waitForTimeout(randomDelay(200, 400));

            await clickByTestId(page, 'lot-save-btn');
            await page.waitForTimeout(randomDelay(500, 1000));

            await waitForAnySnackbar(page).catch(() => {});
            await dismissSnackbar(page).catch(() => {});
            await page.waitForTimeout(randomDelay(300, 600));
          } catch (err) {
            console.log(`[engineer] eng-38 create lot: ${err instanceof Error ? err.message : err}`);
            await page.keyboard.press('Escape').catch(() => {});
          }
          return 'lot';
        },
      },

      // ---------------------------------------------------------------
      // 39. Create ECO
      // ---------------------------------------------------------------
      {
        id: 'eng-39',
        name: 'Create ECO',
        category: 'create',
        tags: ['quality', 'eco'],
        execute: async (page: Page) => {
          try {
            await page.goto('/quality/ecos', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForTimeout(randomDelay(800, 1500));

            await clickByTestId(page, 'new-eco-btn');
            await page.waitForTimeout(randomDelay(500, 1000));

            await fillByTestId(page, 'eco-title', `ECO stress test — ${new Date().toISOString()}`);
            await page.waitForTimeout(randomDelay(200, 400));

            await selectNthByTestId(page, 'eco-change-type', 0);
            await page.waitForTimeout(randomDelay(200, 400));

            await selectNthByTestId(page, 'eco-priority', 0);
            await page.waitForTimeout(randomDelay(200, 400));

            await fillByTestId(page, 'eco-description', 'Automated stress test ECO — validates create flow');
            await page.waitForTimeout(randomDelay(200, 400));

            await fillByTestId(page, 'eco-reason', 'Stress test validation');
            await page.waitForTimeout(randomDelay(200, 400));

            await clickByTestId(page, 'eco-save-btn');
            await page.waitForTimeout(randomDelay(500, 1000));

            await waitForAnySnackbar(page).catch(() => {});
            await dismissSnackbar(page).catch(() => {});
            await page.waitForTimeout(randomDelay(300, 600));
          } catch (err) {
            console.log(`[engineer] eng-39 create ECO: ${err instanceof Error ? err.message : err}`);
            await page.keyboard.press('Escape').catch(() => {});
          }
          return 'eco';
        },
      },

      // ---------------------------------------------------------------
      // 40. Return to dashboard — end of shift
      // ---------------------------------------------------------------
      {
        id: 'eng-40',
        name: 'Return to dashboard',
        category: 'browse',
        tags: ['dashboard'],
        execute: async (page: Page) => {
          try {
            await page.goto('/dashboard', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForTimeout(randomDelay(800, 1500));

            const widget = page.locator('app-dashboard-widget, app-kpi-chip').first();
            await widget.waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT }).catch(() => {});
            await page.waitForTimeout(randomDelay(1000, 2000));
          } catch (err) {
            console.log(`[engineer] eng-40 dashboard return: ${err instanceof Error ? err.message : err}`);
          }
        },
      },
    ],
  };
}
