import type { Page } from 'playwright';
import type { Workflow } from '../orchestrator';
import { fillByTestId, selectByTestId, clickByTestId, fillDateByTestId, fillEntityPickerByTestId } from '../../lib/form.lib';
import { waitForAnySnackbar, dismissSnackbar } from '../../lib/snackbar.lib';
import { waitForTable, sortByColumn } from '../../lib/data-table.lib';
import { randomDelay, testId, maybe, randomPick, randomInt, randomDate, randomAmount } from '../../lib/random.lib';

// ---------------------------------------------------------------------------
// Production Bravo Workflow
//
// Simulates a maintenance worker's full shift covering every area of the app
// a maintenance tech would realistically visit: dashboard KPIs, kanban
// (Maintenance track), assets, inventory (stock/receiving/locations), quality
// (inspections/lots), parts, backlog, calendar, training, reports, chat,
// timers, expenses, manual time entries, notifications, account, and events.
// The orchestrator loops this workflow for the test duration.
// ---------------------------------------------------------------------------

const NAV_TIMEOUT = 15_000;
const ELEMENT_TIMEOUT = 8_000;

// --- Data pools ---

const MAINTENANCE_NOTES = [
  'Preventive maintenance round — checking bearings and lubrication points',
  'Inspecting conveyor belt tension and alignment',
  'Replacing air filters on CNC stations 1-4',
  'Checking hydraulic fluid levels across all presses',
  'Greasing linear guide rails on VMC-02',
  'Calibrating torque wrenches for assembly line',
  'Testing emergency stop circuits — monthly verification',
  'Cleaning coolant system filters and checking concentration',
  'Inspecting electrical panels for loose connections',
  'Checking compressed air system for leaks',
];

const TIMER_STOP_NOTES = [
  'Completed preventive maintenance round',
  'All bearings within spec, lubrication topped off',
  'Filter replacement done — 4 units serviced',
  'Hydraulic levels nominal, no leaks detected',
  'Guide rails greased, travel smooth on all axes',
  'Torque wrenches calibrated and tagged',
  'E-stop circuits verified — all functional',
  'Coolant filters cleaned, concentration at 8%',
  'Electrical panels inspected — tightened 3 terminals',
  'Found 2 minor air leaks, repaired with sealant',
];

const SECOND_ROUND_NOTES = [
  'Starting second maintenance round — afternoon checks',
  'Post-lunch equipment inspection on assembly line',
  'Checking coolant temps after morning production runs',
  'Vibration analysis on spindle bearings — CNC bay',
  'Inspecting safety guards and interlocks — building B',
  'PM ticket follow-up — replacing worn V-belts',
  'Thermal imaging scan of electrical panels',
  'Lubrication schedule catch-up — presses 1-6',
];

const CHAT_MESSAGES = [
  'Bravo team starting maintenance rounds',
  'Heads up — taking press 3 offline for scheduled PM',
  'Coolant concentration low on VMC-01, topping off now',
  'Found worn bearing on conveyor drive — ordering replacement',
  'All clear on electrical panel inspection, building A',
  'Air compressor #2 showing high temp — monitoring closely',
  'PM checklist complete for CNC bay, moving to assembly',
  'Need lockout/tagout assistance at station 7 when available',
  'Maintenance update: all scheduled PMs on track for today',
  'Replaced drive belt on bandsaw — back in service',
];

const EXPENSE_DESCRIPTIONS = [
  'Replacement bearings — SKF 6205-2RS (qty 4)',
  'Hydraulic fluid — AW46, 5 gallon pail',
  'Air filter elements — pleated, 20x25x4 (qty 12)',
  'Coolant concentrate — Master Chemical Trim Sol, 5 gal',
  'Electrical terminal connectors — assorted crimp kit',
  'Grease cartridges — Mobil EP2 (case of 10)',
  'Drive belt — Gates PowerGrip HTD 960-8M-30',
  'Thread sealant tape — PTFE 1/2" (qty 6 rolls)',
  'Safety glasses — replacement lenses (qty 5)',
  'Lockout/tagout padlock set — 6 pack',
];

// Must match seed data in SeedData.Essential.cs (expense_category group)
const EXPENSE_CATEGORIES = ['Materials', 'Tools', 'Equipment', 'Maintenance', 'Other'];

const ASSET_SEARCH_TERMS = ['CNC', 'lathe', 'press', 'mill', 'compressor', 'conveyor', 'saw', 'welder', 'pump', 'drill'];
const INVENTORY_SEARCH_TERMS = ['bearing', 'filter', 'belt', 'seal', 'gasket', 'lubricant', 'hose', 'grease', 'coolant', 'wire'];
const PART_SEARCH_TERMS = ['bearing', 'shaft', 'coupling', 'impeller', 'bushing', 'gasket', 'seal', 'sprocket', 'pulley', 'bracket'];

const MANUAL_ENTRY_NOTES = [
  'Unscheduled repair — conveyor belt splice',
  'Emergency fix on press hydraulic line',
  'Replaced worn tooling inserts on VMC-03',
  'Assisted production with fixture alignment',
  'Troubleshot electrical fault on panel 4B',
  'Welded cracked fixture bracket',
  'Adjusted coolant nozzles and checked flow rates',
  'Inspected and cleaned chip conveyor auger',
];

export function getProductionBravoWorkflow(): Workflow {
  return {
    name: 'production-bravo',
    steps: [
      // ------------------------------------------------------------------
      // pb-01: Dashboard — review KPIs before starting shift
      // ------------------------------------------------------------------
      {
        id: 'pb-01',
        name: 'Dashboard — review KPIs',
        category: 'browse',
        tags: ['dashboard'],
        execute: async (page: Page) => {
          try {
            await page.goto('/dashboard', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForSelector('app-dashboard-widget, .dashboard-widget, .widget', { timeout: ELEMENT_TIMEOUT }).catch(() => {});
            await page.waitForTimeout(randomDelay(1200, 2500));
          } catch {
            // non-critical
          }
        },
      },

      // ------------------------------------------------------------------
      // pb-02: Start timer — begin maintenance shift tracking
      // ------------------------------------------------------------------
      {
        id: 'pb-02',
        name: 'Start maintenance timer',
        category: 'timer-start',
        tags: ['time-tracking'],
        execute: async (page: Page) => {
          try {
            await page.goto('/time-tracking', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForSelector('app-data-table, .page-header', { timeout: ELEMENT_TIMEOUT }).catch(() => {});
            await page.waitForTimeout(randomDelay(500, 1000));

            // Skip if timer already running
            const stopBtn = page.locator('[data-testid="stop-timer-btn"]');
            if (await stopBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
              await page.waitForTimeout(randomDelay(300, 600));
              return;
            }

            const startBtn = page.locator('[data-testid="start-timer-btn"]');
            if (await startBtn.isVisible({ timeout: ELEMENT_TIMEOUT })) {
              await startBtn.click();
              await page.waitForTimeout(randomDelay(500, 1000));

              const categoryField = page.locator('[data-testid="timer-category"]');
              if (await categoryField.isVisible({ timeout: 3000 }).catch(() => false)) {
                await selectByTestId(page, 'timer-category', 'Maintenance');
                await page.waitForTimeout(randomDelay(200, 400));
              }

              const notesField = page.locator('[data-testid="timer-notes"]');
              if (await notesField.isVisible({ timeout: 2000 }).catch(() => false)) {
                await fillByTestId(page, 'timer-notes', randomPick(MAINTENANCE_NOTES));
                await page.waitForTimeout(randomDelay(200, 400));
              }

              const timerStartBtn = page.locator('[data-testid="timer-start-btn"]');
              if (await timerStartBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                await timerStartBtn.click();
                await page.waitForTimeout(randomDelay(500, 1000));
                await waitForAnySnackbar(page, 3000).catch(() => {});
                await dismissSnackbar(page).catch(() => {});
                return 'timer';
              }
            }
          } catch {
            await page.keyboard.press('Escape').catch(() => {});
          }
        },
      },

      // ------------------------------------------------------------------
      // pb-03: Kanban board — switch to Maintenance track
      // ------------------------------------------------------------------
      {
        id: 'pb-03',
        name: 'Switch to Maintenance kanban',
        category: 'browse',
        tags: ['kanban'],
        execute: async (page: Page) => {
          try {
            await page.goto('/kanban', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForSelector('.track-type-btn, .board-column, app-kanban-board', { timeout: ELEMENT_TIMEOUT }).catch(() => {});
            await page.waitForTimeout(randomDelay(500, 1000));

            const maintenanceBtn = page.locator('.track-type-btn', { hasText: /maintenance/i });
            if (await maintenanceBtn.first().isVisible({ timeout: 3000 }).catch(() => false)) {
              await maintenanceBtn.first().click();
              await page.waitForTimeout(randomDelay(1000, 2000));
              await page.waitForSelector('.board-column, app-kanban-board, .column', { timeout: ELEMENT_TIMEOUT }).catch(() => {});
            }

            // Scroll board horizontally to scan columns
            const board = page.locator('.board, .board-container, .kanban-board').first();
            if (await board.isVisible({ timeout: 2000 }).catch(() => false)) {
              await board.evaluate((el) => { el.scrollLeft = Math.random() * el.scrollWidth; }).catch(() => {});
              await page.waitForTimeout(randomDelay(800, 1500));
            }
          } catch {
            // non-critical
          }
        },
      },

      // ------------------------------------------------------------------
      // pb-19: Manual time entry — yesterday's unrecorded work
      // ------------------------------------------------------------------
      {
        id: 'pb-04',  // originally pb-19
        name: 'Create manual time entry',
        category: 'create',
        tags: ['time-tracking'],
        execute: async (page: Page) => {
          try {
            const currentUrl = page.url();
            if (!currentUrl.includes('/time-tracking')) {
              await page.goto('/time-tracking', { waitUntil: 'load', timeout: NAV_TIMEOUT });
              await page.waitForSelector('app-data-table, .page-header', { timeout: ELEMENT_TIMEOUT }).catch(() => {});
              await page.waitForTimeout(randomDelay(500, 800));
            }

            const manualBtn = page.locator('[data-testid="manual-entry-btn"]');
            if (await manualBtn.isVisible({ timeout: ELEMENT_TIMEOUT })) {
              await manualBtn.click();
              await page.waitForTimeout(randomDelay(500, 1000));

              const dateField = page.locator('[data-testid="time-entry-date"]');
              if (await dateField.isVisible({ timeout: 3000 }).catch(() => false)) {
                await fillDateByTestId(page, 'time-entry-date', randomDate(1, 2)); // yesterday or day before
                await page.waitForTimeout(randomDelay(200, 400));
              }

              const categoryField = page.locator('[data-testid="time-entry-category"]');
              if (await categoryField.isVisible({ timeout: 2000 }).catch(() => false)) {
                await selectByTestId(page, 'time-entry-category', 'Maintenance');
                await page.waitForTimeout(randomDelay(200, 400));
              }

              const hoursField = page.locator('[data-testid="time-entry-hours"]');
              if (await hoursField.isVisible({ timeout: 2000 }).catch(() => false)) {
                await fillByTestId(page, 'time-entry-hours', String(randomInt(1, 3)));
                await page.waitForTimeout(randomDelay(200, 300));
              }

              const minutesField = page.locator('[data-testid="time-entry-minutes"]');
              if (await minutesField.isVisible({ timeout: 2000 }).catch(() => false)) {
                await fillByTestId(page, 'time-entry-minutes', String(randomPick([0, 15, 30, 45])));
                await page.waitForTimeout(randomDelay(200, 300));
              }

              const notesField = page.locator('[data-testid="time-entry-notes"]');
              if (await notesField.isVisible({ timeout: 2000 }).catch(() => false)) {
                await fillByTestId(page, 'time-entry-notes', randomPick(MANUAL_ENTRY_NOTES));
                await page.waitForTimeout(randomDelay(200, 400));
              }

              const saveBtn = page.locator('[data-testid="time-entry-save-btn"]');
              if (await saveBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                const isDisabled = await page.evaluate(() => {
                  const btn = document.querySelector('[data-testid="time-entry-save-btn"]') as HTMLButtonElement;
                  if (btn && !btn.disabled) { btn.click(); return false; }
                  return true;
                });
                if (isDisabled) {
                  console.log('[prod-bravo] pb-04 save button disabled — form invalid, skipping');
                } else {
                  await page.waitForTimeout(3000);
                  await dismissSnackbar(page).catch(() => {});
                  return 'time-entry';
                }
              }
            }
          } catch {
            await page.keyboard.press('Escape').catch(() => {});
          }
        },
      },

      // ------------------------------------------------------------------
      // pb-20: Expense — submit maintenance expense
      // ------------------------------------------------------------------
      {
        id: 'pb-05',  // originally pb-20
        name: 'Submit maintenance expense',
        category: 'create',
        tags: ['expenses'],
        execute: async (page: Page) => {
          try {
            await page.goto('/expenses', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForSelector('app-data-table, app-empty-state, .page-header', { timeout: ELEMENT_TIMEOUT }).catch(() => {});
            await page.waitForTimeout(randomDelay(500, 1000));

            const newExpenseBtn = page.locator('[data-testid="new-expense-btn"]');
            if (await newExpenseBtn.isVisible({ timeout: ELEMENT_TIMEOUT })) {
              await newExpenseBtn.click();
              await page.waitForTimeout(randomDelay(500, 1000));
              await page.waitForSelector('.mat-mdc-dialog-container, app-dialog', { timeout: ELEMENT_TIMEOUT }).catch(() => {});

              const amountField = page.locator('[data-testid="expense-amount"]');
              if (await amountField.isVisible({ timeout: 3000 }).catch(() => false)) {
                await fillByTestId(page, 'expense-amount', randomAmount(15, 500));
                await page.waitForTimeout(randomDelay(200, 400));
              }

              const dateField = page.locator('[data-testid="expense-date"]');
              if (await dateField.isVisible({ timeout: 2000 }).catch(() => false)) {
                await fillDateByTestId(page, 'expense-date', randomDate(0, 1));
                await page.waitForTimeout(randomDelay(200, 400));
              }

              const categoryField = page.locator('[data-testid="expense-category"]');
              if (await categoryField.isVisible({ timeout: 2000 }).catch(() => false)) {
                await selectByTestId(page, 'expense-category', randomPick(EXPENSE_CATEGORIES));
                await page.waitForTimeout(randomDelay(200, 400));
              }

              const descField = page.locator('[data-testid="expense-description"]');
              if (await descField.isVisible({ timeout: 2000 }).catch(() => false)) {
                await fillByTestId(page, 'expense-description', randomPick(EXPENSE_DESCRIPTIONS));
                await page.waitForTimeout(randomDelay(200, 400));
              }

              const saveBtn = page.locator('[data-testid="expense-save-btn"]');
              if (await saveBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                const isDisabled = await page.evaluate(() => {
                  const btn = document.querySelector('[data-testid="expense-save-btn"]') as HTMLButtonElement;
                  if (btn && !btn.disabled) { btn.click(); return false; }
                  return true;
                });
                if (isDisabled) {
                  console.log('[prod-bravo] pb-05 save button disabled — form invalid, skipping');
                } else {
                  await page.waitForTimeout(3000);
                  await dismissSnackbar(page).catch(() => {});
                  return 'expense';
                }
              }
            }
          } catch {
            await page.keyboard.press('Escape').catch(() => {});
          }
        },
      },

      // ------------------------------------------------------------------
      // pb-04: Open a maintenance job — browse detail tabs
      // ------------------------------------------------------------------
      {
        id: 'pb-06',  // originally pb-04
        name: 'Open maintenance job detail',
        category: 'browse',
        tags: ['kanban'],
        execute: async (page: Page) => {
          try {
            const cards = page.locator('.job-card, [class*="job-card"], app-job-card');
            const count = await cards.count().catch(() => 0);
            if (count > 0) {
              const idx = randomInt(0, Math.min(count - 1, 9));
              const card = cards.nth(idx);
              await card.scrollIntoViewIfNeeded().catch(() => {});
              await card.click({ timeout: 5000 });

              await page.waitForSelector('.mat-mdc-dialog-container, [class*="detail-panel"]', { timeout: ELEMENT_TIMEOUT }).catch(() => {});
              await page.waitForTimeout(randomDelay(1000, 2000));

              // Browse tabs — subtasks, files, activity
              const dialog = page.locator('.mat-mdc-dialog-container, [class*="detail-panel"]').first();
              const tabs = dialog.locator('[role="tab"]');
              const tabCount = await tabs.count().catch(() => 0);
              if (tabCount > 1) {
                const tabIdx = randomInt(1, Math.min(tabCount - 1, 3));
                await tabs.nth(tabIdx).click().catch(() => {});
                await page.waitForTimeout(randomDelay(800, 1500));
              }

              await page.keyboard.press('Escape');
              await page.waitForTimeout(randomDelay(300, 600));
              await page.waitForSelector('app-dialog .dialog', { state: 'hidden', timeout: 3000 }).catch(() => {});
            }
          } catch {
            await page.keyboard.press('Escape').catch(() => {});
          }
        },
      },

      // ------------------------------------------------------------------
      // pb-05: Assets — browse equipment, search, view detail
      // ------------------------------------------------------------------
      {
        id: 'pb-07',  // originally pb-05
        name: 'Browse and search assets',
        category: 'search',
        tags: ['assets'],
        execute: async (page: Page) => {
          try {
            await page.goto('/assets', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForSelector('app-data-table, app-empty-state, .page-header', { timeout: ELEMENT_TIMEOUT }).catch(() => {});
            await page.waitForTimeout(randomDelay(500, 1000));

            // Sort by type or status
            if (maybe(0.5)) {
              await sortByColumn(page, randomPick(['Type', 'Status'])).catch(() => {});
              await page.waitForTimeout(randomDelay(500, 800));
            }

            // Search for equipment
            const searchTerm = randomPick(ASSET_SEARCH_TERMS);
            const searchInput = page.locator('app-input input[type="text"], input[placeholder*="earch" i]').first();
            if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
              await searchInput.click();
              await searchInput.fill(searchTerm);
              await page.waitForTimeout(randomDelay(800, 1500));
            }

            // Click an asset row to view details
            const rows = page.locator('app-data-table tbody tr, .data-table__row');
            const rowCount = await rows.count().catch(() => 0);
            if (rowCount > 0) {
              const idx = randomInt(0, Math.min(rowCount - 1, 9));
              await rows.nth(idx).click({ timeout: 5000 }).catch(() => {});
              await page.waitForSelector('.mat-mdc-dialog-container, app-detail-side-panel', { timeout: ELEMENT_TIMEOUT }).catch(() => {});
              await page.waitForTimeout(randomDelay(1500, 3000));
              await page.keyboard.press('Escape');
              await page.waitForTimeout(randomDelay(300, 600));
              await page.waitForSelector('app-dialog .dialog', { state: 'hidden', timeout: 3000 }).catch(() => {});
            }

            // Clear search
            if (await searchInput.isVisible().catch(() => false)) {
              await searchInput.fill('');
              await page.waitForTimeout(randomDelay(300, 500));
            }
          } catch {
            await page.keyboard.press('Escape').catch(() => {});
          }
        },
      },

      // ------------------------------------------------------------------
      // pb-06: Inventory stock — search for spare parts
      // ------------------------------------------------------------------
      {
        id: 'pb-08',  // originally pb-06
        name: 'Inventory stock — search spare parts',
        category: 'search',
        tags: ['inventory'],
        execute: async (page: Page) => {
          try {
            await page.goto('/inventory/stock', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForSelector('app-data-table, app-empty-state, .page-header', { timeout: ELEMENT_TIMEOUT }).catch(() => {});
            await page.waitForTimeout(randomDelay(500, 1000));

            const searchTerm = randomPick(INVENTORY_SEARCH_TERMS);
            const searchInput = page.locator('app-input input[type="text"], input[placeholder*="earch" i]').first();
            if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
              await searchInput.click();
              await searchInput.fill(searchTerm);
              await page.waitForTimeout(randomDelay(1000, 2000));

              const rows = page.locator('app-data-table tbody tr, .data-table__row');
              const rowCount = await rows.count().catch(() => 0);
              if (rowCount > 0 && maybe(0.5)) {
                await rows.first().click({ timeout: 3000 }).catch(() => {});
                await page.waitForTimeout(randomDelay(1000, 2000));
                await page.keyboard.press('Escape').catch(() => {});
                await page.waitForTimeout(randomDelay(300, 500));
              }

              await searchInput.fill('');
              await page.waitForTimeout(randomDelay(300, 500));
            }
          } catch {
            await page.keyboard.press('Escape').catch(() => {});
          }
        },
      },

      // ------------------------------------------------------------------
      // pb-07: Inventory receiving — browse received items
      // ------------------------------------------------------------------
      {
        id: 'pb-09',  // originally pb-07
        name: 'Inventory receiving — browse',
        category: 'browse',
        tags: ['inventory'],
        execute: async (page: Page) => {
          try {
            await page.goto('/inventory/receiving', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForSelector('app-data-table, app-empty-state, .page-header', { timeout: ELEMENT_TIMEOUT }).catch(() => {});
            await page.waitForTimeout(randomDelay(800, 1500));

            // Sort by date to see recent receipts
            if (maybe(0.6)) {
              await sortByColumn(page, 'Date').catch(() => {});
              await page.waitForTimeout(randomDelay(500, 800));
            }

            // Browse a row if available
            const rows = page.locator('app-data-table tbody tr, .data-table__row');
            const rowCount = await rows.count().catch(() => 0);
            if (rowCount > 0 && maybe(0.4)) {
              await rows.nth(randomInt(0, Math.min(rowCount - 1, 4))).click({ timeout: 3000 }).catch(() => {});
              await page.waitForTimeout(randomDelay(1000, 1800));
              await page.keyboard.press('Escape').catch(() => {});
              await page.waitForTimeout(randomDelay(300, 500));
            }
          } catch {
            await page.keyboard.press('Escape').catch(() => {});
          }
        },
      },

      // ------------------------------------------------------------------
      // pb-08: Inventory locations — browse storage layout
      // ------------------------------------------------------------------
      {
        id: 'pb-10',  // originally pb-08
        name: 'Inventory locations — browse',
        category: 'browse',
        tags: ['inventory'],
        execute: async (page: Page) => {
          try {
            await page.goto('/inventory/locations', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForSelector('app-data-table, app-empty-state, .page-header', { timeout: ELEMENT_TIMEOUT }).catch(() => {});
            await page.waitForTimeout(randomDelay(800, 1500));

            // Expand a location row if expandable rows exist
            const expandBtns = page.locator('app-data-table tbody tr .expand-btn, app-data-table tbody tr button[aria-label*="xpand"]');
            const expandCount = await expandBtns.count().catch(() => 0);
            if (expandCount > 0 && maybe(0.5)) {
              await expandBtns.nth(randomInt(0, Math.min(expandCount - 1, 3))).click().catch(() => {});
              await page.waitForTimeout(randomDelay(800, 1200));
            }

            await page.waitForTimeout(randomDelay(500, 1000));
          } catch {
            // non-critical
          }
        },
      },

      // ------------------------------------------------------------------
      // pb-09: Back to kanban (Maintenance) — view another work order
      // ------------------------------------------------------------------
      {
        id: 'pb-11',  // originally pb-09
        name: 'Kanban — view another maintenance WO',
        category: 'browse',
        tags: ['kanban'],
        execute: async (page: Page) => {
          try {
            await page.goto('/kanban', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForSelector('.track-type-btn, .board-column', { timeout: ELEMENT_TIMEOUT }).catch(() => {});
            await page.waitForTimeout(randomDelay(500, 800));

            const maintenanceBtn = page.locator('.track-type-btn', { hasText: /maintenance/i });
            if (await maintenanceBtn.first().isVisible({ timeout: 3000 }).catch(() => false)) {
              await maintenanceBtn.first().click();
              await page.waitForTimeout(randomDelay(1000, 1500));
            }

            // Click a different card
            const cards = page.locator('.job-card, [class*="job-card"], app-job-card');
            const count = await cards.count().catch(() => 0);
            if (count > 0) {
              const idx = randomInt(0, Math.min(count - 1, 9));
              await cards.nth(idx).scrollIntoViewIfNeeded().catch(() => {});
              await cards.nth(idx).click({ timeout: 5000 }).catch(() => {});
              await page.waitForSelector('.mat-mdc-dialog-container', { timeout: ELEMENT_TIMEOUT }).catch(() => {});
              await page.waitForTimeout(randomDelay(1500, 2500));
              await page.keyboard.press('Escape');
              await page.waitForTimeout(randomDelay(300, 600));
              await page.waitForSelector('app-dialog .dialog', { state: 'hidden', timeout: 3000 }).catch(() => {});
            }
          } catch {
            await page.keyboard.press('Escape').catch(() => {});
          }
        },
      },

      // ------------------------------------------------------------------
      // pb-10: Quality inspections — browse
      // ------------------------------------------------------------------
      {
        id: 'pb-12',  // originally pb-10
        name: 'Quality inspections — browse',
        category: 'browse',
        tags: ['quality'],
        execute: async (page: Page) => {
          try {
            await page.goto('/quality/inspections', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForSelector('app-data-table, app-empty-state, .page-header', { timeout: ELEMENT_TIMEOUT }).catch(() => {});
            await page.waitForTimeout(randomDelay(800, 1500));

            // Sort by status or date
            if (maybe(0.5)) {
              await sortByColumn(page, randomPick(['Status', 'Date'])).catch(() => {});
              await page.waitForTimeout(randomDelay(500, 800));
            }

            // Click a row to view
            const rows = page.locator('app-data-table tbody tr, .data-table__row');
            const rowCount = await rows.count().catch(() => 0);
            if (rowCount > 0 && maybe(0.5)) {
              await rows.nth(randomInt(0, Math.min(rowCount - 1, 4))).click({ timeout: 3000 }).catch(() => {});
              await page.waitForTimeout(randomDelay(1000, 2000));
              await page.keyboard.press('Escape').catch(() => {});
              await page.waitForTimeout(randomDelay(300, 500));
            }
          } catch {
            await page.keyboard.press('Escape').catch(() => {});
          }
        },
      },

      // ------------------------------------------------------------------
      // pb-11: Quality lots — create lot record
      // ------------------------------------------------------------------
      {
        id: 'pb-13',  // originally pb-11
        name: 'Create lot record',
        category: 'create',
        tags: ['lots'],
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
              console.log('[prod-bravo] pb-13 no parts found for entity-picker — skipping lot creation');
              await page.keyboard.press('Escape').catch(() => {});
              return;
            }
            await page.waitForTimeout(randomDelay(200, 400));

            await fillByTestId(page, 'lot-quantity', String(randomInt(50, 500)));
            await page.waitForTimeout(randomDelay(200, 400));

            await fillByTestId(page, 'lot-notes', `Bravo lot — ${new Date().toISOString()}`);
            await page.waitForTimeout(randomDelay(200, 400));

            await clickByTestId(page, 'lot-save-btn');
            await page.waitForTimeout(randomDelay(500, 1000));

            await waitForAnySnackbar(page).catch(() => {});
            await dismissSnackbar(page).catch(() => {});
            await page.waitForTimeout(randomDelay(300, 600));
          } catch {
            await page.keyboard.press('Escape').catch(() => {});
          }
          return 'lot';
        },
      },

      // ------------------------------------------------------------------
      // pb-12: Chat — send maintenance team update
      // ------------------------------------------------------------------
      {
        id: 'pb-14',  // originally pb-12
        name: 'Send chat message',
        category: 'chat',
        tags: ['chat'],
        execute: async (page: Page) => {
          try {
            await page.goto('/chat', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForSelector(
              'app-chat, [class*="chat"], [class*="message-list"], [class*="chat-room"]',
              { timeout: ELEMENT_TIMEOUT },
            ).catch(() => {});
            await page.waitForTimeout(randomDelay(500, 1000));

            // Select a chat room
            const roomItems = page.locator('[class*="room-item"], [class*="chat-room"], [class*="conversation-item"]');
            const roomCount = await roomItems.count().catch(() => 0);
            if (roomCount > 0) {
              const roomIndex = randomInt(0, Math.min(roomCount - 1, 4));
              await roomItems.nth(roomIndex).click({ timeout: 3000 }).catch(() => {});
              await page.waitForTimeout(randomDelay(500, 1000));
            }

            // Type and send message
            const messageInput = page.locator(
              '[data-testid="chat-message-input"] input, ' +
              '[data-testid="chat-message-input"] textarea, ' +
              'textarea[placeholder*="essage"], ' +
              'input[placeholder*="essage"]',
            ).first();

            if (await messageInput.isVisible({ timeout: 3000 }).catch(() => false)) {
              const message = `${randomPick(CHAT_MESSAGES)} [${testId('bravo')}]`;
              await messageInput.click();
              await messageInput.fill(message);
              await page.waitForTimeout(randomDelay(300, 600));

              const sendBtn = page.locator('[data-testid="chat-send-btn"]');
              if (await sendBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
                await sendBtn.click();
              } else {
                await page.keyboard.press('Enter');
              }
              await page.waitForTimeout(randomDelay(500, 1000));
            }
          } catch {
            await page.keyboard.press('Escape').catch(() => {});
          }
        },
      },

      // ------------------------------------------------------------------
      // pb-13: Stop timer — end first maintenance round
      // ------------------------------------------------------------------
      {
        id: 'pb-15',  // originally pb-13
        name: 'Stop maintenance timer',
        category: 'timer-stop',
        tags: ['time-tracking'],
        execute: async (page: Page) => {
          try {
            await page.goto('/time-tracking', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForSelector('app-data-table, .page-header', { timeout: ELEMENT_TIMEOUT }).catch(() => {});
            await page.waitForTimeout(randomDelay(500, 1000));

            const stopBtn = page.locator('[data-testid="stop-timer-btn"]');
            if (await stopBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
              await stopBtn.click();
              await page.waitForTimeout(randomDelay(500, 1000));

              const stopNotesField = page.locator('[data-testid="timer-stop-notes"]');
              if (await stopNotesField.isVisible({ timeout: 3000 }).catch(() => false)) {
                await fillByTestId(page, 'timer-stop-notes', randomPick(TIMER_STOP_NOTES));
                await page.waitForTimeout(randomDelay(200, 400));
              }

              const timerStopBtn = page.locator('[data-testid="timer-stop-btn"]');
              if (await timerStopBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                await timerStopBtn.click();
                await page.waitForTimeout(randomDelay(500, 1000));
                await waitForAnySnackbar(page, 3000).catch(() => {});
                await dismissSnackbar(page).catch(() => {});
              }
            }
          } catch {
            await page.keyboard.press('Escape').catch(() => {});
          }
        },
      },

      // ------------------------------------------------------------------
      // pb-14: Start new timer — second maintenance round
      // ------------------------------------------------------------------
      {
        id: 'pb-16',  // originally pb-14
        name: 'Start second maintenance timer',
        category: 'timer-start',
        tags: ['time-tracking'],
        execute: async (page: Page) => {
          try {
            // Should still be on time-tracking
            const currentUrl = page.url();
            if (!currentUrl.includes('/time-tracking')) {
              await page.goto('/time-tracking', { waitUntil: 'load', timeout: NAV_TIMEOUT });
              await page.waitForSelector('app-data-table, .page-header', { timeout: ELEMENT_TIMEOUT }).catch(() => {});
              await page.waitForTimeout(randomDelay(500, 800));
            }

            const stopBtn = page.locator('[data-testid="stop-timer-btn"]');
            if (await stopBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
              return; // Timer already running
            }

            const startBtn = page.locator('[data-testid="start-timer-btn"]');
            if (await startBtn.isVisible({ timeout: ELEMENT_TIMEOUT })) {
              await startBtn.click();
              await page.waitForTimeout(randomDelay(500, 1000));

              const categoryField = page.locator('[data-testid="timer-category"]');
              if (await categoryField.isVisible({ timeout: 3000 }).catch(() => false)) {
                await selectByTestId(page, 'timer-category', 'Maintenance');
                await page.waitForTimeout(randomDelay(200, 400));
              }

              const notesField = page.locator('[data-testid="timer-notes"]');
              if (await notesField.isVisible({ timeout: 2000 }).catch(() => false)) {
                await fillByTestId(page, 'timer-notes', randomPick(SECOND_ROUND_NOTES));
                await page.waitForTimeout(randomDelay(200, 400));
              }

              const timerStartBtn = page.locator('[data-testid="timer-start-btn"]');
              if (await timerStartBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                await timerStartBtn.click();
                await page.waitForTimeout(randomDelay(500, 1000));
                await waitForAnySnackbar(page, 3000).catch(() => {});
                await dismissSnackbar(page).catch(() => {});
                return 'timer';
              }
            }
          } catch {
            await page.keyboard.press('Escape').catch(() => {});
          }
        },
      },

      // ------------------------------------------------------------------
      // pb-15: Parts — search for replacement parts
      // ------------------------------------------------------------------
      {
        id: 'pb-17',  // originally pb-15
        name: 'Parts — search replacement parts',
        category: 'search',
        tags: ['parts'],
        execute: async (page: Page) => {
          try {
            await page.goto('/parts', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForSelector('app-data-table, app-empty-state, .page-header', { timeout: ELEMENT_TIMEOUT }).catch(() => {});
            await page.waitForTimeout(randomDelay(500, 1000));

            const searchTerm = randomPick(PART_SEARCH_TERMS);
            const searchInput = page.locator('app-input input[type="text"], input[placeholder*="earch" i]').first();
            if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
              await searchInput.click();
              await searchInput.fill(searchTerm);
              await page.waitForTimeout(randomDelay(800, 1500));

              // View part detail if results found
              const rows = page.locator('app-data-table tbody tr, .data-table__row');
              const rowCount = await rows.count().catch(() => 0);
              if (rowCount > 0 && maybe(0.5)) {
                await rows.first().click({ timeout: 3000 }).catch(() => {});
                await page.waitForSelector('.mat-mdc-dialog-container, app-detail-side-panel', { timeout: ELEMENT_TIMEOUT }).catch(() => {});
                await page.waitForTimeout(randomDelay(1000, 2000));
                await page.keyboard.press('Escape').catch(() => {});
                await page.waitForTimeout(randomDelay(300, 500));
              }

              await searchInput.fill('');
              await page.waitForTimeout(randomDelay(300, 500));
            }
          } catch {
            await page.keyboard.press('Escape').catch(() => {});
          }
        },
      },

      // ------------------------------------------------------------------
      // pb-16: Backlog — browse maintenance backlog items
      // ------------------------------------------------------------------
      {
        id: 'pb-18',  // originally pb-16
        name: 'Backlog — browse maintenance items',
        category: 'browse',
        tags: ['backlog'],
        execute: async (page: Page) => {
          try {
            await page.goto('/backlog', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForSelector('app-data-table, app-empty-state, .page-header', { timeout: ELEMENT_TIMEOUT }).catch(() => {});
            await page.waitForTimeout(randomDelay(800, 1500));

            // Sort by priority
            if (maybe(0.5)) {
              await sortByColumn(page, 'Priority').catch(() => {});
              await page.waitForTimeout(randomDelay(500, 800));
            }

            // Click a backlog item if available
            const rows = page.locator('app-data-table tbody tr, .data-table__row');
            const rowCount = await rows.count().catch(() => 0);
            if (rowCount > 0 && maybe(0.4)) {
              await rows.nth(randomInt(0, Math.min(rowCount - 1, 5))).click({ timeout: 3000 }).catch(() => {});
              await page.waitForTimeout(randomDelay(1000, 2000));
              await page.keyboard.press('Escape').catch(() => {});
              await page.waitForTimeout(randomDelay(300, 500));
            }
          } catch {
            await page.keyboard.press('Escape').catch(() => {});
          }
        },
      },

      // ------------------------------------------------------------------
      // pb-17: Calendar — check schedule
      // ------------------------------------------------------------------
      {
        id: 'pb-19',  // originally pb-17
        name: 'Calendar — check schedule',
        category: 'browse',
        tags: ['calendar'],
        execute: async (page: Page) => {
          try {
            await page.goto('/calendar', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForSelector('mat-calendar, full-calendar, [class*="calendar"], .fc', { timeout: ELEMENT_TIMEOUT }).catch(() => {});
            await page.waitForTimeout(randomDelay(1200, 2500));

            // Click a day or event if visible
            const events = page.locator('.fc-event, [class*="calendar-event"], [class*="event-item"]');
            const eventCount = await events.count().catch(() => 0);
            if (eventCount > 0 && maybe(0.4)) {
              await events.nth(randomInt(0, Math.min(eventCount - 1, 3))).click().catch(() => {});
              await page.waitForTimeout(randomDelay(1000, 1800));
              await page.keyboard.press('Escape').catch(() => {});
              await page.waitForTimeout(randomDelay(300, 500));
            }
          } catch {
            await page.keyboard.press('Escape').catch(() => {});
          }
        },
      },

      // ------------------------------------------------------------------
      // pb-18: Stop timer — end second round
      // ------------------------------------------------------------------
      {
        id: 'pb-20',  // originally pb-18
        name: 'Stop second timer',
        category: 'timer-stop',
        tags: ['time-tracking'],
        execute: async (page: Page) => {
          try {
            await page.goto('/time-tracking', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForSelector('app-data-table, .page-header', { timeout: ELEMENT_TIMEOUT }).catch(() => {});
            await page.waitForTimeout(randomDelay(500, 1000));

            const stopBtn = page.locator('[data-testid="stop-timer-btn"]');
            if (await stopBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
              await stopBtn.click();
              await page.waitForTimeout(randomDelay(500, 1000));

              const stopNotesField = page.locator('[data-testid="timer-stop-notes"]');
              if (await stopNotesField.isVisible({ timeout: 3000 }).catch(() => false)) {
                await fillByTestId(page, 'timer-stop-notes', randomPick(TIMER_STOP_NOTES));
                await page.waitForTimeout(randomDelay(200, 400));
              }

              const timerStopBtn = page.locator('[data-testid="timer-stop-btn"]');
              if (await timerStopBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                await timerStopBtn.click();
                await page.waitForTimeout(randomDelay(500, 1000));
                await waitForAnySnackbar(page, 3000).catch(() => {});
                await dismissSnackbar(page).catch(() => {});
              }
            }
          } catch {
            await page.keyboard.press('Escape').catch(() => {});
          }
        },
      },

      // ------------------------------------------------------------------
      // pb-21: Training — browse safety modules
      // ------------------------------------------------------------------
      {
        id: 'pb-21',
        name: 'Training — browse safety modules',
        category: 'browse',
        tags: ['training'],
        execute: async (page: Page) => {
          try {
            await page.goto('/training/catalog', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForSelector('app-data-table, app-empty-state, .page-header, [class*="training"], [class*="module"]', { timeout: ELEMENT_TIMEOUT }).catch(() => {});
            await page.waitForTimeout(randomDelay(800, 1500));

            // Search for safety-related training
            const searchInput = page.locator('app-input input[type="text"], input[placeholder*="earch" i]').first();
            if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
              await searchInput.click();
              await searchInput.fill(randomPick(['safety', 'lockout', 'LOTO', 'PPE', 'hazard']));
              await page.waitForTimeout(randomDelay(1000, 2000));
              await searchInput.fill('');
              await page.waitForTimeout(randomDelay(300, 500));
            }

            // Switch to My Learning tab
            const myLearningTab = page.locator('[role="tab"]', { hasText: /my learning/i }).first();
            if (await myLearningTab.isVisible({ timeout: 2000 }).catch(() => false)) {
              await myLearningTab.click();
              await page.waitForTimeout(randomDelay(800, 1500));
            }
          } catch {
            // non-critical
          }
        },
      },

      // ------------------------------------------------------------------
      // pb-22: Reports — view maintenance report
      // ------------------------------------------------------------------
      {
        id: 'pb-22',
        name: 'Reports — view maintenance report',
        category: 'report',
        tags: ['reports'],
        execute: async (page: Page) => {
          try {
            await page.goto('/reports', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForSelector('app-data-table, app-empty-state, .page-header, [class*="report"]', { timeout: ELEMENT_TIMEOUT }).catch(() => {});
            await page.waitForTimeout(randomDelay(800, 1500));

            // Search for a maintenance-related report
            const searchInput = page.locator('app-input input[type="text"], input[placeholder*="earch" i]').first();
            if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
              await searchInput.click();
              await searchInput.fill(randomPick(['maintenance', 'asset', 'downtime', 'equipment']));
              await page.waitForTimeout(randomDelay(1000, 2000));
            }

            // Click a report if available
            const rows = page.locator('app-data-table tbody tr, .data-table__row, [class*="report-card"], [class*="report-item"]');
            const rowCount = await rows.count().catch(() => 0);
            if (rowCount > 0 && maybe(0.5)) {
              await rows.first().click({ timeout: 3000 }).catch(() => {});
              await page.waitForTimeout(randomDelay(1500, 3000));
              // Return to reports list
              const backBtn = page.locator('button[aria-label*="ack"], [class*="back-btn"]').first();
              if (await backBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                await backBtn.click().catch(() => {});
              }
              await page.waitForTimeout(randomDelay(500, 800));
            }
          } catch {
            // non-critical
          }
        },
      },

      // ------------------------------------------------------------------
      // pb-23: Account profile — quick browse
      // ------------------------------------------------------------------
      {
        id: 'pb-23',
        name: 'Account profile — browse',
        category: 'browse',
        tags: ['account'],
        execute: async (page: Page) => {
          try {
            await page.goto('/account/profile', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForSelector('.page-header, [class*="profile"], app-page-layout', { timeout: ELEMENT_TIMEOUT }).catch(() => {});
            await page.waitForTimeout(randomDelay(1000, 2000));
          } catch {
            // non-critical
          }
        },
      },

      // ------------------------------------------------------------------
      // pb-24: Notifications — check panel
      // ------------------------------------------------------------------
      {
        id: 'pb-24',
        name: 'Check notifications',
        category: 'browse',
        tags: ['notifications'],
        execute: async (page: Page) => {
          try {
            const bellButton = page.locator('button[aria-label*="otification"], button[aria-label*="bell"], .notification-bell').first();
            if (await bellButton.isVisible({ timeout: 3000 })) {
              await bellButton.click();
              await page.waitForTimeout(randomDelay(1000, 2000));

              const panel = page.locator('.notification-panel, app-notification-panel').first();
              if (await panel.isVisible({ timeout: 2000 }).catch(() => false)) {
                // Mark one as read if available
                if (maybe(0.4)) {
                  const unreadItem = page.locator('[class*="notification-item"]:not([class*="read"]), [class*="unread"]').first();
                  if (await unreadItem.isVisible({ timeout: 1500 }).catch(() => false)) {
                    await unreadItem.click();
                    await page.waitForTimeout(randomDelay(500, 1000));
                  }
                }
                await page.waitForTimeout(randomDelay(500, 1500));
              }

              await page.keyboard.press('Escape');
              await page.waitForTimeout(randomDelay(300, 600));
            }
          } catch {
            // non-critical
          }
        },
      },

      // ------------------------------------------------------------------
      // pb-25: Quality gages — browse gage records
      // ------------------------------------------------------------------
      {
        id: 'pb-25',
        name: 'Quality gages — browse',
        category: 'browse',
        tags: ['quality'],
        execute: async (page: Page) => {
          try {
            await page.goto('/quality/gages', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForSelector('app-data-table, app-empty-state, .page-header', { timeout: ELEMENT_TIMEOUT }).catch(() => {});
            await page.waitForTimeout(randomDelay(800, 1500));

            // Sort by calibration date
            if (maybe(0.5)) {
              await sortByColumn(page, randomPick(['Calibration', 'Due', 'Status'])).catch(() => {});
              await page.waitForTimeout(randomDelay(500, 800));
            }

            // Click a gage to view
            const rows = page.locator('app-data-table tbody tr, .data-table__row');
            const rowCount = await rows.count().catch(() => 0);
            if (rowCount > 0 && maybe(0.4)) {
              await rows.nth(randomInt(0, Math.min(rowCount - 1, 4))).click({ timeout: 3000 }).catch(() => {});
              await page.waitForTimeout(randomDelay(1000, 1800));
              await page.keyboard.press('Escape').catch(() => {});
              await page.waitForTimeout(randomDelay(300, 500));
            }
          } catch {
            await page.keyboard.press('Escape').catch(() => {});
          }
        },
      },

      // ------------------------------------------------------------------
      // pb-26: Events — check upcoming events
      // ------------------------------------------------------------------
      {
        id: 'pb-26',
        name: 'Events — check upcoming',
        category: 'browse',
        tags: ['events'],
        execute: async (page: Page) => {
          try {
            await page.goto('/admin/events', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForSelector('app-data-table, app-empty-state, .page-header', { timeout: ELEMENT_TIMEOUT }).catch(() => {});
            await page.waitForTimeout(randomDelay(800, 1500));

            // Browse event rows
            const rows = page.locator('app-data-table tbody tr, .data-table__row');
            const rowCount = await rows.count().catch(() => 0);
            if (rowCount > 0 && maybe(0.4)) {
              await rows.nth(randomInt(0, Math.min(rowCount - 1, 4))).click({ timeout: 3000 }).catch(() => {});
              await page.waitForTimeout(randomDelay(1000, 1800));
              await page.keyboard.press('Escape').catch(() => {});
              await page.waitForTimeout(randomDelay(300, 500));
            }
          } catch {
            // non-critical — may require admin role
          }
        },
      },

      // ------------------------------------------------------------------
      // pb-27: Purchase orders — check parts on order
      // ------------------------------------------------------------------
      {
        id: 'pb-27',
        name: 'Purchase orders — check parts on order',
        category: 'browse',
        tags: ['inventory'],
        execute: async (page: Page) => {
          try {
            await page.goto('/purchase-orders', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForSelector('app-data-table, app-empty-state, .page-header', { timeout: ELEMENT_TIMEOUT }).catch(() => {});
            await page.waitForTimeout(randomDelay(800, 1500));

            // Sort by status to see open POs
            if (maybe(0.5)) {
              await sortByColumn(page, 'Status').catch(() => {});
              await page.waitForTimeout(randomDelay(500, 800));
            }

            // Click a PO to check if maintenance parts are on order
            const rows = page.locator('app-data-table tbody tr, .data-table__row');
            const rowCount = await rows.count().catch(() => 0);
            if (rowCount > 0 && maybe(0.5)) {
              await rows.nth(randomInt(0, Math.min(rowCount - 1, 4))).click({ timeout: 3000 }).catch(() => {});
              await page.waitForSelector('.mat-mdc-dialog-container, app-detail-side-panel', { timeout: ELEMENT_TIMEOUT }).catch(() => {});
              await page.waitForTimeout(randomDelay(1500, 2500));
              await page.keyboard.press('Escape').catch(() => {});
              await page.waitForTimeout(randomDelay(300, 500));
            }
          } catch {
            await page.keyboard.press('Escape').catch(() => {});
          }
        },
      },

      // ------------------------------------------------------------------
      // pb-29: Browse account tax documents
      // ------------------------------------------------------------------
      {
        id: 'pb-29',
        name: 'Browse account tax documents',
        category: 'browse',
        tags: ['account', 'payroll'],
        execute: async (page: Page) => {
          try {
            await page.goto('/account/tax-documents', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForSelector(
              'app-data-table, table, [class*="tax-document"], .page-header',
              { timeout: ELEMENT_TIMEOUT },
            ).catch(() => {});
            await page.waitForTimeout(randomDelay(1000, 2000));
          } catch {
            // Tax documents page may not be accessible — non-critical
          }
        },
      },

      // ------------------------------------------------------------------
      // pb-30: Use global search
      // ------------------------------------------------------------------
      {
        id: 'pb-30',
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
          } catch {
            await page.keyboard.press('Escape').catch(() => {});
          }
        },
      },

      // ------------------------------------------------------------------
      // pb-31: Browse account pay stubs
      // ------------------------------------------------------------------
      {
        id: 'pb-31',
        name: 'Browse account pay stubs',
        category: 'browse',
        tags: ['account', 'payroll'],
        execute: async (page: Page) => {
          try {
            await page.goto('/account/pay-stubs', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForSelector(
              'app-data-table, table, [class*="pay-stub"], .page-header',
              { timeout: ELEMENT_TIMEOUT },
            ).catch(() => {});
            await page.waitForTimeout(randomDelay(1000, 2000));
          } catch {
            // Pay stubs page may not be accessible — non-critical
          }
        },
      },

      // ------------------------------------------------------------------
      // pb-32: Browse account security
      // ------------------------------------------------------------------
      {
        id: 'pb-32',
        name: 'Browse account security',
        category: 'browse',
        tags: ['account', 'security'],
        execute: async (page: Page) => {
          try {
            await page.goto('/account/security', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForSelector(
              '[class*="security"], .page-header, mat-card, [class*="mfa"]',
              { timeout: ELEMENT_TIMEOUT },
            ).catch(() => {});
            await page.waitForTimeout(randomDelay(1000, 2000));
          } catch {
            // Security page load failed — non-critical
          }
        },
      },

      // ------------------------------------------------------------------
      // pb-33: Return to dashboard — end of shift review
      // ------------------------------------------------------------------
      {
        id: 'pb-33',
        name: 'Return to dashboard — shift review',
        category: 'browse',
        tags: ['dashboard'],
        execute: async (page: Page) => {
          try {
            await page.goto('/dashboard', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForSelector('app-dashboard-widget, .dashboard-widget, .widget', { timeout: ELEMENT_TIMEOUT }).catch(() => {});
            const idleTime = maybe(0.2)
              ? randomDelay(4000, 8000)  // 20% chance of a longer pause
              : randomDelay(1500, 3000);
            await page.waitForTimeout(idleTime);
          } catch {
            // non-critical
          }
        },
      },
    ],
  };
}
