import type { Page } from 'playwright';
import type { Workflow } from '../orchestrator';
import { fillByTestId, selectByTestId, fillDateByTestId } from '../../lib/form.lib';
import { waitForAnySnackbar, dismissSnackbar } from '../../lib/snackbar.lib';
import { waitForTable, sortByColumn } from '../../lib/data-table.lib';
import { randomDelay, testId, maybe, randomPick, randomInt, randomDate, randomAmount } from '../../lib/random.lib';

// ---------------------------------------------------------------------------
// Production Alpha Workflow
//
// Simulates a production worker on the Production track during a full shift.
// 25 steps covering every page a floor worker would realistically visit:
// dashboard, timer, kanban, job details, parts, inventory, quality, chat,
// backlog, calendar, training, expenses, account, notifications, reports,
// AI assistant, events, and lots. The orchestrator loops this workflow for
// the test duration.
// ---------------------------------------------------------------------------

const NAV_TIMEOUT = 15_000;
const ELEMENT_TIMEOUT = 8_000;

// --- Data pools ---

const SEARCH_TERMS = ['steel', 'aluminum', 'bearing', 'shaft', 'bracket', 'housing', 'gasket', 'flange', 'bolt', 'plate'];

const CHAT_MESSAGES = [
  'Alpha team check-in: on station, ready to go.',
  'Starting next job on the board.',
  'Material looks good, moving to production.',
  'QC passed on last batch, moving forward.',
  'Need a quick hand at station 3 when someone is free.',
  'Wrapping up current task, about to clock a break.',
  'Heads up — tooling on press 2 needs inspection soon.',
  'All clear on my end, proceeding to next job.',
  'Just finished setup, starting run now.',
  'Part count verified, marking batch complete.',
];

const TIMER_NOTES_START = [
  'Starting shift — production line setup',
  'Beginning first run of the day',
  'Picking up where I left off yesterday',
  'Starting batch run on press 4',
  'Machine warmup and tool check complete, starting production',
  'Setup verified, running first article',
];

const TIMER_NOTES_STOP = [
  'Completed setup and first run',
  'Batch finished, cleaning station',
  'Break time — pausing for lunch',
  'Shift complete, locking out machine',
  'Run done, moving to next job',
  'QC hold — waiting for inspector',
];

const TIMER_NOTES_START_SECONDARY = [
  'Switching to cleanup duty',
  'Starting setup for next run',
  'Training new hire on fixture alignment',
  'Break over — back on the line',
  'Maintenance assist on press 7',
  'Changeover for different part number',
];

const TIMER_NOTES_STOP_SECONDARY = [
  'Cleanup done, area secured',
  'Setup complete, ready for production',
  'Training session wrapped up',
  'Changeover finished, first piece verified',
  'Maintenance complete, machine back online',
  'Fixture swap done, recalibrated',
];

const MANUAL_ENTRY_NOTES = [
  'Forgot to clock in yesterday — ran bracket assembly for 4 hours',
  'Manual entry for overtime on shaft machining job',
  'Makeup time for early departure last shift',
  'Training session with new hire on press operation',
  'Rework on housing weldment — added time not tracked',
  'Inventory count assistance in warehouse',
];

const EXPENSE_DESCRIPTIONS = [
  'Safety glasses — ANSI Z87.1 rated',
  'Work gloves — cut-resistant, size L',
  'Steel-toe boot insoles — gel cushion',
  'Hearing protection — NRR 33 earplugs (box)',
  'Shop towels — blue roll, industrial grade',
  'Measuring tape — 25ft Stanley FatMax',
  'Sharpie markers — fine point, black (12-pack)',
  'Face shield replacement visor',
  'Anti-fatigue mat for workstation',
  'Cable ties and zip tie gun',
];

const EXPENSE_CATEGORIES = ['Shop Supplies', 'Safety Equipment', 'Tools', 'PPE'];

const TIME_CATEGORIES = ['Production', 'Setup', 'Cleanup', 'Training', 'Break'];

const AI_QUESTIONS = [
  'What is the recommended torque spec for 1/2-13 Grade 8 bolts?',
  'How do I read a surface finish callout on a drawing?',
  'What coolant concentration should I use for aluminum milling?',
  'Explain the difference between 6061-T6 and 7075-T6 aluminum',
  'What are common causes of chatter in lathe turning operations?',
  'How do I calculate feed rate for a 4-flute end mill?',
];

const INVENTORY_SEARCH_TERMS = ['raw stock', 'fastener', 'o-ring', 'steel bar', 'sheet metal', 'weld wire', 'abrasive', 'drill bit'];

export function getProductionAlphaWorkflow(): Workflow {
  return {
    name: 'production-alpha',
    steps: [
      // ------------------------------------------------------------------
      // 1. Dashboard — check KPIs, scroll widgets, orient for the shift
      // ------------------------------------------------------------------
      {
        id: 'pa-01',
        name: 'Check dashboard KPIs',
        execute: async (page: Page) => {
          try {
            await page.goto('/dashboard', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForSelector('.dashboard-widget, app-dashboard-widget', { timeout: ELEMENT_TIMEOUT }).catch(() => {});
            await page.waitForTimeout(randomDelay(1000, 2000));

            // Scan through visible widgets
            const widgets = page.locator('app-dashboard-widget, .dashboard-widget');
            const widgetCount = await widgets.count();
            if (widgetCount > 0) {
              for (let i = 0; i < Math.min(widgetCount, 4); i++) {
                await widgets.nth(i).scrollIntoViewIfNeeded().catch(() => {});
                await page.waitForTimeout(randomDelay(400, 800));
              }
            }

            // Check the mini calendar widget if visible
            const calendar = page.locator('app-mini-calendar-widget').first();
            if (await calendar.isVisible({ timeout: 2000 }).catch(() => false)) {
              await calendar.scrollIntoViewIfNeeded().catch(() => {});
              await page.waitForTimeout(randomDelay(500, 1000));
            }
          } catch {
            // Dashboard may be slow to load — non-critical
          }
        },
      },

      // ------------------------------------------------------------------
      // 2. Start a timer for the shift (Production)
      // ------------------------------------------------------------------
      {
        id: 'pa-02',
        name: 'Start shift timer',
        execute: async (page: Page) => {
          try {
            await page.goto('/time-tracking', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForSelector('app-data-table, [class*="time-tracking"]', { timeout: ELEMENT_TIMEOUT }).catch(() => {});
            await page.waitForTimeout(randomDelay(500, 1000));

            const startBtn = page.locator('[data-testid="start-timer-btn"]');
            if (await startBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
              await startBtn.click();
              await page.waitForTimeout(randomDelay(400, 800));

              await selectByTestId(page, 'timer-category', 'Production');
              await page.waitForTimeout(randomDelay(200, 400));

              await fillByTestId(page, 'timer-notes', randomPick(TIMER_NOTES_START));
              await page.waitForTimeout(randomDelay(300, 600));

              const timerStartBtn = page.locator('[data-testid="timer-start-btn"]');
              if (await timerStartBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
                await timerStartBtn.click();
                await page.waitForTimeout(randomDelay(500, 1000));

                await waitForAnySnackbar(page, 4000).catch(() => {});
                await dismissSnackbar(page).catch(() => {});
              }
            }
          } catch {
            await page.keyboard.press('Escape').catch(() => {});
          }
        },
      },

      // ------------------------------------------------------------------
      // 3. Browse kanban board (Production track) — scan columns
      // ------------------------------------------------------------------
      {
        id: 'pa-03',
        name: 'Browse production kanban board',
        execute: async (page: Page) => {
          try {
            await page.goto('/kanban', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForSelector('.kanban-board, .board-column, app-kanban-board', { timeout: ELEMENT_TIMEOUT }).catch(() => {});
            await page.waitForTimeout(randomDelay(800, 1500));

            // Scroll through columns to simulate scanning the board
            const columns = page.locator('app-board-column, .board');
            const columnCount = await columns.count();

            if (columnCount > 0) {
              const columnsToScan = Math.min(columnCount, randomInt(3, 5));
              for (let i = 0; i < columnsToScan; i++) {
                const colIndex = randomInt(0, columnCount - 1);
                await columns.nth(colIndex).scrollIntoViewIfNeeded().catch(() => {});
                await page.waitForTimeout(randomDelay(500, 1000));
              }
            }

            // Count visible cards — production workers care about queue depth
            const cards = page.locator('.job-card, [class*="job-card"]');
            await cards.count();
            await page.waitForTimeout(randomDelay(300, 700));
          } catch {
            // Board may be empty or loading — non-critical
          }
        },
      },

      // ------------------------------------------------------------------
      // 4. Open a job card — browse tabs (overview, subtasks, files, activity)
      // ------------------------------------------------------------------
      {
        id: 'pa-04',
        name: 'Open job card and browse detail tabs',
        execute: async (page: Page) => {
          try {
            const cards = page.locator('.job-card, [class*="job-card"]');
            const count = await cards.count();

            if (count === 0) {
              await page.waitForTimeout(randomDelay(300, 600));
              return;
            }

            // Click a random card
            const index = randomInt(0, Math.min(count - 1, 9));
            const card = cards.nth(index);
            await card.scrollIntoViewIfNeeded().catch(() => {});
            await card.click({ timeout: 5000 });

            // Wait for the detail dialog
            await page.waitForSelector(
              '.mat-mdc-dialog-container, [class*="cdk-overlay"]',
              { timeout: ELEMENT_TIMEOUT },
            ).catch(() => {});
            await page.waitForTimeout(randomDelay(1000, 2000));

            // Browse multiple tabs
            const dialog = page.locator('.mat-mdc-dialog-container').first();
            if (await dialog.isVisible({ timeout: 2000 }).catch(() => false)) {
              const tabs = dialog.locator('[role="tab"]');
              const tabCount = await tabs.count();

              if (tabCount > 1) {
                // Visit 2-3 tabs — subtasks, files, activity are most relevant
                const tabsToVisit = Math.min(tabCount, randomInt(2, 3));
                for (let t = 0; t < tabsToVisit; t++) {
                  const tabIndex = randomInt(1, Math.min(tabCount - 1, 4));
                  await tabs.nth(tabIndex).click().catch(() => {});
                  await page.waitForTimeout(randomDelay(800, 1500));
                }
              }

              // Scroll through dialog content
              const dialogContent = dialog.locator('.mat-mdc-dialog-content, .dialog__body').first();
              if (await dialogContent.isVisible({ timeout: 1000 }).catch(() => false)) {
                await dialogContent.evaluate(el => el.scrollTo(0, el.scrollHeight / 2)).catch(() => {});
                await page.waitForTimeout(randomDelay(500, 1000));
              }
            }

            // Close the dialog
            const closeBtn = page.locator(
              '.mat-mdc-dialog-container button[aria-label*="lose"], ' +
              'button.dialog__close, button[mat-dialog-close]',
            ).first();

            if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
              await closeBtn.click();
            } else {
              await page.keyboard.press('Escape');
            }
            await page.waitForTimeout(randomDelay(300, 600));
            await page.waitForSelector('app-dialog .dialog', { state: 'hidden', timeout: 3000 }).catch(() => {});
          } catch {
            await page.keyboard.press('Escape').catch(() => {});
            await page.waitForTimeout(300);
          }
        },
      },

      // ------------------------------------------------------------------
      // 5. Parts catalog — search for material, browse results
      // ------------------------------------------------------------------
      {
        id: 'pa-05',
        name: 'Search parts catalog for material',
        execute: async (page: Page) => {
          try {
            await page.goto('/parts', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForSelector('app-data-table, table, [class*="data-table"]', { timeout: ELEMENT_TIMEOUT }).catch(() => {});
            await page.waitForTimeout(randomDelay(500, 1000));

            // Find and use the search input
            const searchInput = page.locator(
              '[data-testid="part-search"] input, ' +
              'app-input[label*="earch"] input, ' +
              'input[placeholder*="earch"], ' +
              'mat-form-field input[type="text"]',
            ).first();

            if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
              const term = randomPick(SEARCH_TERMS);
              await searchInput.click();
              await searchInput.clear();
              await searchInput.type(term, { delay: randomInt(40, 90) });
              await page.waitForTimeout(randomDelay(1000, 2000));

              // Click on a result row if available
              const rows = page.locator('app-data-table tbody tr').filter({ hasNot: page.locator('.empty-state') });
              const rowCount = await rows.count();
              if (rowCount > 0 && maybe(0.6)) {
                const rowIndex = randomInt(0, Math.min(rowCount - 1, 4));
                await rows.nth(rowIndex).click({ timeout: 3000 });

                // Wait for detail dialog
                await page.waitForSelector('.mat-mdc-dialog-container', { timeout: ELEMENT_TIMEOUT }).catch(() => {});
                await page.waitForTimeout(randomDelay(800, 1500));

                // Close detail
                await page.keyboard.press('Escape');
                await page.waitForTimeout(randomDelay(300, 500));
                await page.waitForSelector('app-dialog .dialog', { state: 'hidden', timeout: 3000 }).catch(() => {});
              }

              // Clear the search
              await searchInput.clear();
              await page.waitForTimeout(randomDelay(300, 600));
            }
          } catch {
            await page.keyboard.press('Escape').catch(() => {});
          }
        },
      },

      // ------------------------------------------------------------------
      // 6. Inventory check — browse stock levels, search for consumables
      // ------------------------------------------------------------------
      {
        id: 'pa-06',
        name: 'Check inventory stock levels',
        execute: async (page: Page) => {
          try {
            await page.goto('/inventory/stock', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForSelector('app-data-table, table', { timeout: ELEMENT_TIMEOUT }).catch(() => {});
            await page.waitForTimeout(randomDelay(800, 1500));

            // Search for consumable materials
            const searchInput = page.locator(
              'app-input[label*="earch"] input, ' +
              'input[placeholder*="earch"], ' +
              'mat-form-field input[type="text"]',
            ).first();

            if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
              const term = randomPick(INVENTORY_SEARCH_TERMS);
              await searchInput.click();
              await searchInput.clear();
              await searchInput.type(term, { delay: randomInt(40, 80) });
              await page.waitForTimeout(randomDelay(1000, 2000));
              await searchInput.clear();
            }

            // Browse tabs — stock, receiving, locations
            if (maybe(0.4)) {
              await page.goto('/inventory/receiving', { waitUntil: 'load', timeout: NAV_TIMEOUT });
              await page.waitForTimeout(randomDelay(800, 1500));
            }

            if (maybe(0.3)) {
              await page.goto('/inventory/locations', { waitUntil: 'load', timeout: NAV_TIMEOUT });
              await page.waitForTimeout(randomDelay(800, 1500));
            }
          } catch {
            // Inventory page may not have data — non-critical
          }
        },
      },

      // ------------------------------------------------------------------
      // 7. Back to kanban — open a different job, read details
      // ------------------------------------------------------------------
      {
        id: 'pa-07',
        name: 'View another job on kanban',
        execute: async (page: Page) => {
          try {
            await page.goto('/kanban', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForSelector('.kanban-board, .board-column', { timeout: ELEMENT_TIMEOUT }).catch(() => {});
            await page.waitForTimeout(randomDelay(500, 1000));

            const cards = page.locator('.job-card, [class*="job-card"]');
            const count = await cards.count();

            if (count === 0) {
              await page.waitForTimeout(randomDelay(300, 600));
              return;
            }

            // Pick a different card than step 4 — use higher index
            const index = randomInt(Math.min(3, count - 1), Math.min(count - 1, 12));
            await cards.nth(index).scrollIntoViewIfNeeded().catch(() => {});
            await cards.nth(index).click({ timeout: 5000 });

            const dialogVisible = await page.waitForSelector(
              '.mat-mdc-dialog-container',
              { timeout: ELEMENT_TIMEOUT },
            ).catch(() => null);

            if (dialogVisible) {
              await page.waitForTimeout(randomDelay(1000, 2000));

              // Close the detail dialog
              await page.keyboard.press('Escape');
              await page.waitForTimeout(randomDelay(300, 600));
              await page.waitForSelector('app-dialog .dialog', { state: 'hidden', timeout: 3000 }).catch(() => {});
            }
          } catch {
            await page.keyboard.press('Escape').catch(() => {});
            await page.waitForTimeout(300);
          }
        },
      },

      // ------------------------------------------------------------------
      // 8. Quality check — browse inspections and lots tabs
      // ------------------------------------------------------------------
      {
        id: 'pa-08',
        name: 'Browse quality inspections',
        execute: async (page: Page) => {
          try {
            await page.goto('/quality/inspections', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForSelector('app-data-table, table, [class*="quality"]', { timeout: ELEMENT_TIMEOUT }).catch(() => {});
            await page.waitForTimeout(randomDelay(1000, 2000));

            // Sort by date if table is loaded
            await sortByColumn(page, 'Date').catch(() => {});
            await page.waitForTimeout(randomDelay(500, 1000));

            // Click on an inspection row if available
            const rows = page.locator('app-data-table tbody tr');
            const rowCount = await rows.count();
            if (rowCount > 0 && maybe(0.5)) {
              await rows.first().click({ timeout: 3000 }).catch(() => {});
              await page.waitForTimeout(randomDelay(800, 1500));
              await page.keyboard.press('Escape').catch(() => {});
              await page.waitForTimeout(randomDelay(300, 500));
            }

            // Switch to lots tab
            if (maybe(0.5)) {
              await page.goto('/quality/lots', { waitUntil: 'load', timeout: NAV_TIMEOUT });
              await page.waitForSelector('app-data-table, table, [class*="lot"]', { timeout: ELEMENT_TIMEOUT }).catch(() => {});
              await page.waitForTimeout(randomDelay(800, 1500));
            }

            // Maybe check gages tab
            if (maybe(0.3)) {
              await page.goto('/quality/gages', { waitUntil: 'load', timeout: NAV_TIMEOUT });
              await page.waitForTimeout(randomDelay(800, 1500));
            }
          } catch {
            await page.keyboard.press('Escape').catch(() => {});
          }
        },
      },

      // ------------------------------------------------------------------
      // 9. Chat — send a shift update message
      // ------------------------------------------------------------------
      {
        id: 'pa-09',
        name: 'Send chat message to team',
        execute: async (page: Page) => {
          try {
            await page.goto('/chat', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForSelector(
              'app-chat, [class*="chat"], [class*="message-list"]',
              { timeout: ELEMENT_TIMEOUT },
            ).catch(() => {});
            await page.waitForTimeout(randomDelay(500, 1000));

            // Select a chat room
            const roomItems = page.locator('[class*="room-item"], [class*="chat-room"], [class*="conversation-item"]');
            const roomCount = await roomItems.count();
            if (roomCount > 0) {
              const roomIndex = randomInt(0, Math.min(roomCount - 1, 4));
              await roomItems.nth(roomIndex).click({ timeout: 3000 });
              await page.waitForTimeout(randomDelay(500, 1000));
            }

            // Scroll through recent messages to catch up
            const messageList = page.locator('[class*="message-list"], [class*="chat-messages"]').first();
            if (await messageList.isVisible({ timeout: 2000 }).catch(() => false)) {
              await messageList.evaluate(el => el.scrollTo(0, el.scrollHeight)).catch(() => {});
              await page.waitForTimeout(randomDelay(600, 1200));
            }

            // Send a message
            const messageInput = page.locator('[data-testid="chat-message-input"] input, [data-testid="chat-message-input"] textarea').first();

            if (await messageInput.isVisible({ timeout: 3000 }).catch(() => false)) {
              const message = `${randomPick(CHAT_MESSAGES)} [${testId('alpha')}]`;
              await messageInput.click();
              await messageInput.fill(message);
              await page.waitForTimeout(randomDelay(300, 600));

              const sendBtn = page.locator('[data-testid="chat-send-btn"]').first();
              if (await sendBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                await sendBtn.click();
              } else {
                await page.keyboard.press('Enter');
              }
              await page.waitForTimeout(randomDelay(500, 1000));
            }
          } catch {
            // Chat may not be available — non-critical
          }
        },
      },

      // ------------------------------------------------------------------
      // 10. Stop timer — end first production run
      // ------------------------------------------------------------------
      {
        id: 'pa-10',
        name: 'Stop production timer',
        execute: async (page: Page) => {
          try {
            await page.goto('/time-tracking', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForSelector('app-data-table, [class*="time-tracking"]', { timeout: ELEMENT_TIMEOUT }).catch(() => {});
            await page.waitForTimeout(randomDelay(500, 1000));

            const stopBtn = page.locator('[data-testid="stop-timer-btn"]');
            if (await stopBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
              await stopBtn.click();
              await page.waitForTimeout(randomDelay(400, 800));

              await fillByTestId(page, 'timer-stop-notes', randomPick(TIMER_NOTES_STOP));
              await page.waitForTimeout(randomDelay(300, 600));

              const confirmStopBtn = page.locator('[data-testid="timer-stop-btn"]');
              if (await confirmStopBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
                await confirmStopBtn.click();
                await page.waitForTimeout(randomDelay(500, 1000));

                await waitForAnySnackbar(page, 4000).catch(() => {});
                await dismissSnackbar(page).catch(() => {});
              }
            }
          } catch {
            await page.keyboard.press('Escape').catch(() => {});
          }
        },
      },

      // ------------------------------------------------------------------
      // 11. Start new timer — Setup/Cleanup task
      // ------------------------------------------------------------------
      {
        id: 'pa-11',
        name: 'Start secondary timer (setup/cleanup)',
        execute: async (page: Page) => {
          try {
            const url = page.url();
            if (!url.includes('/time-tracking')) {
              await page.goto('/time-tracking', { waitUntil: 'load', timeout: NAV_TIMEOUT });
              await page.waitForSelector('app-data-table, [class*="time-tracking"]', { timeout: ELEMENT_TIMEOUT }).catch(() => {});
            }
            await page.waitForTimeout(randomDelay(400, 800));

            const startBtn = page.locator('[data-testid="start-timer-btn"]');
            if (await startBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
              await startBtn.click();
              await page.waitForTimeout(randomDelay(400, 800));

              const category = randomPick(['Setup', 'Cleanup', 'Maintenance']);
              await selectByTestId(page, 'timer-category', category);
              await page.waitForTimeout(randomDelay(200, 400));

              await fillByTestId(page, 'timer-notes', randomPick(TIMER_NOTES_START_SECONDARY));
              await page.waitForTimeout(randomDelay(300, 600));

              const timerStartBtn = page.locator('[data-testid="timer-start-btn"]');
              if (await timerStartBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
                await timerStartBtn.click();
                await page.waitForTimeout(randomDelay(500, 1000));

                await waitForAnySnackbar(page, 4000).catch(() => {});
                await dismissSnackbar(page).catch(() => {});
              }
            }
          } catch {
            await page.keyboard.press('Escape').catch(() => {});
          }
        },
      },

      // ------------------------------------------------------------------
      // 12. Backlog — browse job list, sort by priority or due date
      // ------------------------------------------------------------------
      {
        id: 'pa-12',
        name: 'Browse backlog and sort',
        execute: async (page: Page) => {
          try {
            await page.goto('/backlog', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForSelector('app-data-table, table', { timeout: ELEMENT_TIMEOUT }).catch(() => {});
            await page.waitForTimeout(randomDelay(800, 1500));

            // Sort by priority or due date
            const sortColumn = randomPick(['Priority', 'Due Date', 'Status', 'Title']);
            await sortByColumn(page, sortColumn).catch(() => {});
            await page.waitForTimeout(randomDelay(500, 1000));

            // Click a row to peek at job details
            const rows = page.locator('app-data-table tbody tr');
            const rowCount = await rows.count();
            if (rowCount > 0 && maybe(0.5)) {
              const rowIndex = randomInt(0, Math.min(rowCount - 1, 7));
              await rows.nth(rowIndex).click({ timeout: 3000 }).catch(() => {});
              await page.waitForTimeout(randomDelay(800, 1500));

              // Close any detail dialog
              await page.keyboard.press('Escape').catch(() => {});
              await page.waitForTimeout(randomDelay(300, 500));
              await page.waitForSelector('app-dialog .dialog', { state: 'hidden', timeout: 3000 }).catch(() => {});
            }
          } catch {
            await page.keyboard.press('Escape').catch(() => {});
          }
        },
      },

      // ------------------------------------------------------------------
      // 13. Calendar — check schedule for the week
      // ------------------------------------------------------------------
      {
        id: 'pa-13',
        name: 'Browse calendar',
        execute: async (page: Page) => {
          try {
            await page.goto('/calendar', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForSelector(
              'mat-calendar, .calendar, [class*="calendar"], full-calendar',
              { timeout: ELEMENT_TIMEOUT },
            ).catch(() => {});
            await page.waitForTimeout(randomDelay(1000, 2000));

            // Click next/previous month buttons if visible
            if (maybe(0.4)) {
              const nextBtn = page.locator(
                'button[aria-label*="ext"], button[aria-label*="orward"], .fc-next-button',
              ).first();
              if (await nextBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                await nextBtn.click();
                await page.waitForTimeout(randomDelay(800, 1500));
              }
            }

            // Click a date cell if one has events
            const eventDot = page.locator('.calendar-event, .fc-event, [class*="event-dot"], .mat-calendar-body-cell--has-event').first();
            if (await eventDot.isVisible({ timeout: 2000 }).catch(() => false)) {
              await eventDot.click().catch(() => {});
              await page.waitForTimeout(randomDelay(800, 1500));
              await page.keyboard.press('Escape').catch(() => {});
            }

            await page.waitForTimeout(randomDelay(500, 1000));
          } catch {
            // Calendar may not render immediately — non-critical
          }
        },
      },

      // ------------------------------------------------------------------
      // 14. Kanban — interact with a job (try moving a card)
      // ------------------------------------------------------------------
      {
        id: 'pa-14',
        name: 'Interact with job on kanban board',
        execute: async (page: Page) => {
          try {
            await page.goto('/kanban', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForSelector('.kanban-board, .board-column', { timeout: ELEMENT_TIMEOUT }).catch(() => {});
            await page.waitForTimeout(randomDelay(500, 1000));

            const cards = page.locator('.job-card, [class*="job-card"]');
            const count = await cards.count();

            if (count === 0) {
              await page.waitForTimeout(randomDelay(300, 600));
              return;
            }

            // Open a card and try an action
            const index = randomInt(0, Math.min(count - 1, 9));
            await cards.nth(index).scrollIntoViewIfNeeded().catch(() => {});
            await cards.nth(index).click({ timeout: 5000 });

            const dialogVisible = await page.waitForSelector(
              '.mat-mdc-dialog-container',
              { timeout: ELEMENT_TIMEOUT },
            ).catch(() => null);

            if (dialogVisible) {
              await page.waitForTimeout(randomDelay(600, 1200));

              // Maybe try to move the job to next stage
              if (maybe(0.3)) {
                const actionBtn = page.locator(
                  'button:has-text("Move"), button:has-text("Advance"), button:has-text("Complete"), ' +
                  'button:has-text("Mark Complete")',
                ).first();

                if (await actionBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                  await actionBtn.click();
                  await page.waitForTimeout(randomDelay(800, 1500));

                  // Handle confirmation dialog
                  const confirmBtn = page.locator(
                    '.mat-mdc-dialog-container button:has-text("Confirm"), ' +
                    '.mat-mdc-dialog-container button:has-text("Yes"), ' +
                    '.mat-mdc-dialog-container button:has-text("Move")',
                  ).first();
                  if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                    await confirmBtn.click();
                    await page.waitForTimeout(randomDelay(500, 1000));
                    await waitForAnySnackbar(page, 4000).catch(() => {});
                    await dismissSnackbar(page).catch(() => {});
                  }
                }
              }

              // Close the detail dialog
              await page.keyboard.press('Escape');
              await page.waitForTimeout(randomDelay(300, 600));
              await page.waitForSelector('app-dialog .dialog', { state: 'hidden', timeout: 3000 }).catch(() => {});
            }
          } catch {
            await page.keyboard.press('Escape').catch(() => {});
            await page.waitForTimeout(300);
          }
        },
      },

      // ------------------------------------------------------------------
      // 15. Training — browse modules, maybe click into one
      // ------------------------------------------------------------------
      {
        id: 'pa-15',
        name: 'Browse training modules',
        execute: async (page: Page) => {
          try {
            await page.goto('/training/my-learning', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForSelector(
              'app-data-table, [class*="training"], [class*="module-card"], [class*="learning"]',
              { timeout: ELEMENT_TIMEOUT },
            ).catch(() => {});
            await page.waitForTimeout(randomDelay(1000, 2000));

            // Switch to catalog tab to see available modules
            if (maybe(0.6)) {
              await page.goto('/training/catalog', { waitUntil: 'load', timeout: NAV_TIMEOUT });
              await page.waitForTimeout(randomDelay(800, 1500));

              // Click a module card if visible
              const moduleCards = page.locator('[class*="module-card"], [class*="training-card"], .card');
              const cardCount = await moduleCards.count();
              if (cardCount > 0) {
                const cardIndex = randomInt(0, Math.min(cardCount - 1, 5));
                await moduleCards.nth(cardIndex).click({ timeout: 3000 }).catch(() => {});
                await page.waitForTimeout(randomDelay(1000, 2000));

                // Close any dialog that opened
                await page.keyboard.press('Escape').catch(() => {});
                await page.waitForTimeout(randomDelay(300, 500));
              }
            }

            // Scroll through the page content
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2)).catch(() => {});
            await page.waitForTimeout(randomDelay(500, 1000));
          } catch {
            await page.keyboard.press('Escape').catch(() => {});
          }
        },
      },

      // ------------------------------------------------------------------
      // 16. Stop secondary timer
      // ------------------------------------------------------------------
      {
        id: 'pa-16',
        name: 'Stop secondary timer',
        execute: async (page: Page) => {
          try {
            await page.goto('/time-tracking', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForSelector('app-data-table, [class*="time-tracking"]', { timeout: ELEMENT_TIMEOUT }).catch(() => {});
            await page.waitForTimeout(randomDelay(500, 1000));

            const stopBtn = page.locator('[data-testid="stop-timer-btn"]');
            if (await stopBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
              await stopBtn.click();
              await page.waitForTimeout(randomDelay(400, 800));

              await fillByTestId(page, 'timer-stop-notes', randomPick(TIMER_NOTES_STOP_SECONDARY));
              await page.waitForTimeout(randomDelay(300, 600));

              const confirmStopBtn = page.locator('[data-testid="timer-stop-btn"]');
              if (await confirmStopBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
                await confirmStopBtn.click();
                await page.waitForTimeout(randomDelay(500, 1000));

                await waitForAnySnackbar(page, 4000).catch(() => {});
                await dismissSnackbar(page).catch(() => {});
              }
            } else {
              await page.waitForTimeout(randomDelay(300, 500));
            }
          } catch {
            await page.keyboard.press('Escape').catch(() => {});
          }
        },
      },

      // ------------------------------------------------------------------
      // 17. Manual time entry — fill out yesterday's forgotten entry
      // ------------------------------------------------------------------
      {
        id: 'pa-17',
        name: 'Create manual time entry',
        execute: async (page: Page) => {
          try {
            const url = page.url();
            if (!url.includes('/time-tracking')) {
              await page.goto('/time-tracking', { waitUntil: 'load', timeout: NAV_TIMEOUT });
              await page.waitForSelector('app-data-table, [class*="time-tracking"]', { timeout: ELEMENT_TIMEOUT }).catch(() => {});
            }
            await page.waitForTimeout(randomDelay(400, 800));

            const manualBtn = page.locator('[data-testid="manual-entry-btn"]');
            if (await manualBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
              await manualBtn.click();
              await page.waitForTimeout(randomDelay(400, 800));

              const entryDate = randomDate(-3, 3);
              const hours = randomInt(1, 8);
              const minutes = randomPick([0, 15, 30, 45]);

              await fillDateByTestId(page, 'time-entry-date', entryDate);
              await page.waitForTimeout(randomDelay(200, 400));

              await selectByTestId(page, 'time-entry-category', randomPick(TIME_CATEGORIES));
              await page.waitForTimeout(randomDelay(200, 400));

              await fillByTestId(page, 'time-entry-hours', String(hours));
              await page.waitForTimeout(randomDelay(150, 300));

              await fillByTestId(page, 'time-entry-minutes', String(minutes));
              await page.waitForTimeout(randomDelay(150, 300));

              await fillByTestId(page, 'time-entry-notes', randomPick(MANUAL_ENTRY_NOTES));
              await page.waitForTimeout(randomDelay(300, 600));

              const saveBtn = page.locator('[data-testid="time-entry-save-btn"]');
              if (await saveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
                await page.evaluate(() => {
                  const btn = document.querySelector('[data-testid="time-entry-save-btn"]') as HTMLButtonElement;
                  if (btn && !btn.disabled) btn.click();
                });
                await page.waitForTimeout(3000);
                await dismissSnackbar(page).catch(() => {});
              }
            }
          } catch {
            await page.keyboard.press('Escape').catch(() => {});
          }
        },
      },

      // ------------------------------------------------------------------
      // 18. Expenses — submit a small PPE/shop supplies expense
      // ------------------------------------------------------------------
      {
        id: 'pa-18',
        name: 'Submit expense for shop supplies',
        execute: async (page: Page) => {
          try {
            await page.goto('/expenses', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForSelector('app-data-table, [class*="expense"]', { timeout: ELEMENT_TIMEOUT }).catch(() => {});
            await page.waitForTimeout(randomDelay(500, 1000));

            const newExpenseBtn = page.locator('[data-testid="new-expense-btn"]');
            if (await newExpenseBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
              await newExpenseBtn.click();
              await page.waitForTimeout(randomDelay(400, 800));

              const amount = randomAmount(5, 75);
              const expenseDate = randomDate(-7, 7);

              await fillByTestId(page, 'expense-amount', amount);
              await page.waitForTimeout(randomDelay(200, 400));

              await fillDateByTestId(page, 'expense-date', expenseDate);
              await page.waitForTimeout(randomDelay(200, 400));

              await selectByTestId(page, 'expense-category', randomPick(EXPENSE_CATEGORIES));
              await page.waitForTimeout(randomDelay(200, 400));

              await fillByTestId(page, 'expense-description', randomPick(EXPENSE_DESCRIPTIONS));
              await page.waitForTimeout(randomDelay(300, 600));

              const saveBtn = page.locator('[data-testid="expense-save-btn"]');
              if (await saveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
                await page.evaluate(() => {
                  const btn = document.querySelector('[data-testid="expense-save-btn"]') as HTMLButtonElement;
                  if (btn && !btn.disabled) btn.click();
                });
                await page.waitForTimeout(3000);
                await dismissSnackbar(page).catch(() => {});
              }
            }
          } catch {
            await page.keyboard.press('Escape').catch(() => {});
          }
        },
      },

      // ------------------------------------------------------------------
      // 19. Account profile — review personal info
      // ------------------------------------------------------------------
      {
        id: 'pa-19',
        name: 'Review account profile',
        execute: async (page: Page) => {
          try {
            await page.goto('/account/profile', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForSelector(
              '[class*="profile"], [class*="account"], form, .page-layout',
              { timeout: ELEMENT_TIMEOUT },
            ).catch(() => {});
            await page.waitForTimeout(randomDelay(1000, 2000));

            // Scroll through the profile page
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 3)).catch(() => {});
            await page.waitForTimeout(randomDelay(500, 1000));
            await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
            await page.waitForTimeout(randomDelay(400, 800));
          } catch {
            // Profile page may require auth refresh — non-critical
          }
        },
      },

      // ------------------------------------------------------------------
      // 20. Notifications — open panel, scroll, maybe mark read
      // ------------------------------------------------------------------
      {
        id: 'pa-20',
        name: 'Check and read notifications',
        execute: async (page: Page) => {
          try {
            const bellButton = page.locator(
              'button[aria-label*="otification"], button[aria-label*="bell"], .notification-bell',
            ).first();

            if (await bellButton.isVisible({ timeout: 3000 })) {
              await bellButton.click();
              await page.waitForTimeout(randomDelay(1000, 2000));

              // Scroll through notifications in the panel
              const panel = page.locator('.notification-panel, app-notification-panel').first();
              if (await panel.isVisible({ timeout: 2000 }).catch(() => false)) {
                await page.waitForTimeout(randomDelay(500, 1000));

                // Mark a notification as read
                if (maybe(0.5)) {
                  const unreadItem = page.locator(
                    '[class*="notification-item"]:not([class*="read"]), [class*="unread"]',
                  ).first();
                  if (await unreadItem.isVisible({ timeout: 1500 }).catch(() => false)) {
                    await unreadItem.click();
                    await page.waitForTimeout(randomDelay(500, 800));
                  }
                }

                // Maybe click "Mark all read" if available
                if (maybe(0.2)) {
                  const markAllBtn = page.locator(
                    'button:has-text("Mark all"), button:has-text("mark all"), button[aria-label*="mark all"]',
                  ).first();
                  if (await markAllBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
                    await markAllBtn.click();
                    await page.waitForTimeout(randomDelay(500, 800));
                  }
                }
              }

              // Close the panel
              await page.keyboard.press('Escape');
              await page.waitForTimeout(randomDelay(300, 600));
            }
          } catch {
            // Notifications panel may not be available — non-critical
          }
        },
      },

      // ------------------------------------------------------------------
      // 21. Reports — view "My Time Log" or similar personal report
      // ------------------------------------------------------------------
      {
        id: 'pa-21',
        name: 'View personal report',
        execute: async (page: Page) => {
          try {
            await page.goto('/reports', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForSelector(
              '[class*="report"], [class*="nav-item"], app-data-table',
              { timeout: ELEMENT_TIMEOUT },
            ).catch(() => {});
            await page.waitForTimeout(randomDelay(800, 1500));

            // Try to click a relevant report link
            const reportLinks = ['My Time Log', 'My Work History', 'Time Summary', 'Hours'];
            for (const reportName of reportLinks) {
              const link = page.locator(
                `.report-nav-item:has-text("${reportName}"), ` +
                `[class*="nav-item"]:has-text("${reportName}"), ` +
                `a:has-text("${reportName}"), ` +
                `button:has-text("${reportName}")`,
              ).first();

              if (await link.isVisible({ timeout: 1500 }).catch(() => false)) {
                await link.click();
                await page.waitForTimeout(randomDelay(1500, 3000));

                // Scroll through the report content
                await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2)).catch(() => {});
                await page.waitForTimeout(randomDelay(500, 1000));
                break;
              }
            }
          } catch {
            // Reports may require specific permissions — non-critical
          }
        },
      },

      // ------------------------------------------------------------------
      // 22. AI assistant — ask a quick manufacturing question
      // ------------------------------------------------------------------
      {
        id: 'pa-22',
        name: 'Ask AI assistant a question',
        execute: async (page: Page) => {
          try {
            await page.goto('/ai', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForSelector(
              '[class*="ai"], [class*="chat"], [class*="assistant"], textarea, input[type="text"]',
              { timeout: ELEMENT_TIMEOUT },
            ).catch(() => {});
            await page.waitForTimeout(randomDelay(800, 1500));

            // Find a text input or textarea for the AI prompt
            const aiInput = page.locator(
              'textarea, input[type="text"], [contenteditable="true"]',
            ).last();

            if (await aiInput.isVisible({ timeout: 3000 }).catch(() => false)) {
              const question = randomPick(AI_QUESTIONS);
              await aiInput.click();
              await aiInput.fill(question);
              await page.waitForTimeout(randomDelay(300, 600));

              // Submit — try Enter or a send button
              const sendBtn = page.locator(
                'button:has-text("Send"), button:has-text("Ask"), button[aria-label*="send"]',
              ).first();

              if (await sendBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                await sendBtn.click();
              } else {
                await page.keyboard.press('Enter');
              }

              // Wait for response to start appearing
              await page.waitForTimeout(randomDelay(2000, 4000));

              // Scroll to see the full response
              await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)).catch(() => {});
              await page.waitForTimeout(randomDelay(1000, 2000));
            }
          } catch {
            // AI may be offline — non-critical
          }
        },
      },

      // ------------------------------------------------------------------
      // 23. Events — browse upcoming events (safety meetings, training)
      // ------------------------------------------------------------------
      {
        id: 'pa-23',
        name: 'Browse upcoming events',
        execute: async (page: Page) => {
          try {
            await page.goto('/admin/events', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForSelector(
              'app-data-table, table, [class*="event"]',
              { timeout: ELEMENT_TIMEOUT },
            ).catch(() => {});
            await page.waitForTimeout(randomDelay(1000, 2000));

            // Sort by date to see upcoming
            await sortByColumn(page, 'Date').catch(() => {});
            await page.waitForTimeout(randomDelay(500, 1000));

            // Click an event row if available
            const rows = page.locator('app-data-table tbody tr');
            const rowCount = await rows.count();
            if (rowCount > 0 && maybe(0.5)) {
              await rows.first().click({ timeout: 3000 }).catch(() => {});
              await page.waitForTimeout(randomDelay(800, 1500));
              await page.keyboard.press('Escape').catch(() => {});
              await page.waitForTimeout(randomDelay(300, 500));
            }
          } catch {
            // Events may require admin access — non-critical, worker can still try
          }
        },
      },

      // ------------------------------------------------------------------
      // 24. Lots — browse production lot records for traceability
      // ------------------------------------------------------------------
      {
        id: 'pa-24',
        name: 'Browse production lot records',
        execute: async (page: Page) => {
          try {
            await page.goto('/quality/lots', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForSelector(
              'app-data-table, table, [class*="lot"]',
              { timeout: ELEMENT_TIMEOUT },
            ).catch(() => {});
            await page.waitForTimeout(randomDelay(1000, 2000));

            // Sort by lot number or date
            const sortCol = randomPick(['Lot #', 'Created', 'Part', 'Quantity']);
            await sortByColumn(page, sortCol).catch(() => {});
            await page.waitForTimeout(randomDelay(500, 1000));

            // Click a lot row if available
            const rows = page.locator('app-data-table tbody tr');
            const rowCount = await rows.count();
            if (rowCount > 0 && maybe(0.4)) {
              const rowIndex = randomInt(0, Math.min(rowCount - 1, 4));
              await rows.nth(rowIndex).click({ timeout: 3000 }).catch(() => {});
              await page.waitForTimeout(randomDelay(800, 1500));
              await page.keyboard.press('Escape').catch(() => {});
              await page.waitForTimeout(randomDelay(300, 500));
              await page.waitForSelector('app-dialog .dialog', { state: 'hidden', timeout: 3000 }).catch(() => {});
            }
          } catch {
            await page.keyboard.press('Escape').catch(() => {});
          }
        },
      },

      // ------------------------------------------------------------------
      // 25. Return to dashboard — end of shift cycle review
      // ------------------------------------------------------------------
      {
        id: 'pa-25',
        name: 'Return to dashboard — end of shift cycle',
        execute: async (page: Page) => {
          try {
            await page.goto('/dashboard', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForSelector('.dashboard-widget, app-dashboard-widget', { timeout: ELEMENT_TIMEOUT }).catch(() => {});

            // Final scan of KPIs before the loop restarts
            const widgets = page.locator('app-dashboard-widget, .dashboard-widget');
            const widgetCount = await widgets.count();
            if (widgetCount > 0) {
              for (let i = 0; i < Math.min(widgetCount, 2); i++) {
                await widgets.nth(i).scrollIntoViewIfNeeded().catch(() => {});
                await page.waitForTimeout(randomDelay(300, 600));
              }
            }

            // Brief idle — simulate reviewing before next loop iteration
            const idleTime = maybe(0.2)
              ? randomDelay(4000, 8000)   // 20% chance of a longer pause
              : randomDelay(1500, 3000);  // 80% short glance
            await page.waitForTimeout(idleTime);
          } catch {
            // Dashboard load failed — non-critical
          }
        },
      },
    ],
  };
}
