import type { Page } from 'playwright';
import type { Workflow } from '../orchestrator';
import { fillByTestId, selectByTestId, fillDateByTestId } from '../../lib/form.lib';
import { waitForAnySnackbar, dismissSnackbar } from '../../lib/snackbar.lib';
import { waitForTable, sortByColumn } from '../../lib/data-table.lib';
import { randomDelay, testId, maybe, randomPick, randomInt, randomDate, randomAmount } from '../../lib/random.lib';

const NAV_TIMEOUT = 15_000;
const ELEMENT_TIMEOUT = 8_000;

// ---------------------------------------------------------------------------
// Data pools
// ---------------------------------------------------------------------------

const LEAD_CONTACTS = [
  'John Smith', 'Sarah Johnson', 'Mike Chen', 'Lisa Park', 'James Rivera',
  'Amanda Foster', 'David Kim', 'Rachel Nguyen', 'Marcus Thompson', 'Olivia Reeves',
];
const LEAD_SOURCES = ['Referral', 'Website', 'Trade Show', 'Cold Call', 'Email Campaign'];
const LEAD_EMAILS_DOMAINS = ['example.com', 'testcorp.io', 'stressinc.net', 'mfgdemo.com'];

const EXPENSE_CATEGORIES = ['Travel', 'Meals', 'Office Supplies', 'Equipment', 'Software'];
const EXPENSE_DESCRIPTIONS = [
  'Client lunch — contract discussion',
  'Travel to vendor site for QC audit',
  'Office supplies for engineering team',
  'Conference registration — MFG summit',
  'Monthly SaaS subscription renewal',
  'Team dinner after production milestone',
  'Taxi to customer facility for walkthrough',
  'Parking for off-site supplier meeting',
];

const CHAT_MESSAGES = [
  'Manager daily review complete — all departments on track',
  'Scheduling follow-up with new lead this week',
  'Expense reports submitted for approval',
  'Time tracking looks good across the board',
  'Planning cycle review done — capacity looks healthy',
  'New lead added to pipeline from trade show contact',
  'Production backlog triaged — top priorities reassigned',
  'Vendor PO status checked — materials ETA updated',
];

const TIME_ENTRY_NOTES = [
  'Weekly team standup and planning',
  'Reviewed production schedule with floor lead',
  'Lead qualification calls',
  'Expense report review and approvals',
  'Client follow-up and relationship management',
  'Resource planning for next sprint',
  'Vendor negotiations for raw materials',
  'Cross-department coordination meeting',
];

const TRACK_TYPES = ['Production', 'R&D/Tooling', 'Maintenance'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function waitForPageContent(page: Page): Promise<void> {
  await page.locator('app-data-table, app-page-layout, form, .tab-panel, mat-card, .page-content').first()
    .waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });
}

async function browseTableRows(page: Page, maxRows = 5): Promise<void> {
  const rows = page.locator('app-data-table tbody tr');
  const rowCount = await rows.count();
  for (let i = 0; i < Math.min(rowCount, maxRows); i++) {
    await rows.nth(i).scrollIntoViewIfNeeded();
    await page.waitForTimeout(randomDelay(150, 400));
  }
}

async function randomScroll(page: Page): Promise<void> {
  const scrollAmount = Math.floor(Math.random() * 400) + 100;
  await page.mouse.wheel(0, scrollAmount);
  await page.waitForTimeout(randomDelay(300, 600));
}

// ---------------------------------------------------------------------------
// Workflow
// ---------------------------------------------------------------------------

/**
 * Manager workflow — simulates a production manager's full daily review loop.
 *
 * 35 steps covering every page a manager would visit: dashboard, kanban,
 * backlog, leads, expenses, time tracking, reports, planning, customers,
 * sales orders, quotes, purchase orders, invoices, payments, shipments,
 * vendors, chat, assets, quality, training, events, calendar, notifications,
 * and account. Creates real data: leads, expenses, time entries.
 */
export function getManagerWorkflow(): Workflow {
  return {
    name: 'manager',
    steps: [
      // ---------------------------------------------------------------
      // mgr-01 — Dashboard: review KPIs and scroll all widgets
      // ---------------------------------------------------------------
      {
        id: 'mgr-01',
        name: 'Dashboard — review KPIs and widgets',
        execute: async (page: Page) => {
          try {
            await page.goto('/dashboard', { waitUntil: 'load', timeout: NAV_TIMEOUT });

            await page.locator('.dashboard-widget, app-kpi-chip, app-dashboard-widget').first()
              .waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });

            // Read through KPI chips
            const kpiChips = page.locator('app-kpi-chip');
            const chipCount = await kpiChips.count();
            for (let i = 0; i < Math.min(chipCount, 6); i++) {
              await kpiChips.nth(i).scrollIntoViewIfNeeded();
              await page.waitForTimeout(randomDelay(300, 700));
            }

            // Scroll through dashboard widgets
            const widgets = page.locator('.dashboard-widget, app-dashboard-widget');
            const widgetCount = await widgets.count();
            for (let i = 0; i < Math.min(widgetCount, 5); i++) {
              await widgets.nth(i).scrollIntoViewIfNeeded();
              await page.waitForTimeout(randomDelay(400, 900));
            }
          } catch {
            // Dashboard may have varying widget counts
          }

          await page.waitForTimeout(randomDelay(800, 2000));
        },
      },

      // ---------------------------------------------------------------
      // mgr-02 — Kanban: review Production track
      // ---------------------------------------------------------------
      {
        id: 'mgr-02',
        name: 'Kanban — review Production track',
        execute: async (page: Page) => {
          try {
            await page.goto('/kanban', { waitUntil: 'load', timeout: NAV_TIMEOUT });

            await page.locator('app-board-column, .board').first()
              .waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });

            // Scroll through columns to review WIP
            const columns = page.locator('app-board-column, .board');
            const columnCount = await columns.count();
            for (let i = 0; i < Math.min(columnCount, 8); i++) {
              await columns.nth(i).scrollIntoViewIfNeeded();
              await page.waitForTimeout(randomDelay(300, 700));
            }

            // Count job cards for mental WIP check
            const jobCards = page.locator('.job-card, .kanban-card, [class*="job-card"]');
            await jobCards.count(); // just read it

            // Maybe click a card to peek at details
            if (maybe(0.4)) {
              const cardCount = await jobCards.count();
              if (cardCount > 0) {
                const idx = randomInt(0, Math.min(cardCount - 1, 9));
                await jobCards.nth(idx).click();
                await page.waitForTimeout(randomDelay(1000, 2000));
                await page.keyboard.press('Escape');
                await page.waitForTimeout(randomDelay(300, 600));
              }
            }
          } catch {
            await page.keyboard.press('Escape').catch(() => {});
          }

          await page.waitForTimeout(randomDelay(800, 1800));
        },
      },

      // ---------------------------------------------------------------
      // mgr-03 — Kanban: switch to Maintenance track
      // ---------------------------------------------------------------
      {
        id: 'mgr-03',
        name: 'Kanban — switch to Maintenance track',
        execute: async (page: Page) => {
          try {
            // Click the Maintenance track type button
            const trackBtn = page.locator('.track-type-btn', { hasText: 'Maintenance' });
            if (await trackBtn.count() > 0) {
              await trackBtn.first().click();
              await page.waitForTimeout(randomDelay(1000, 2000));

              // Wait for board to reload
              await page.locator('app-board-column, .board').first()
                .waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT }).catch(() => {});

              // Scroll through columns
              const columns = page.locator('app-board-column, .board');
              const columnCount = await columns.count();
              for (let i = 0; i < Math.min(columnCount, 6); i++) {
                await columns.nth(i).scrollIntoViewIfNeeded();
                await page.waitForTimeout(randomDelay(200, 500));
              }
            }
          } catch {
            // Track switch may fail
          }

          await page.waitForTimeout(randomDelay(800, 1500));
        },
      },

      // ---------------------------------------------------------------
      // mgr-04 — CREATE LEAD (star step — every field filled)
      // ---------------------------------------------------------------
      {
        id: 'mgr-04',
        name: 'Create new lead — full form',
        execute: async (page: Page) => {
          try {
            await page.goto('/leads', { waitUntil: 'load', timeout: NAV_TIMEOUT });

            await page.locator('app-data-table, app-page-layout').first()
              .waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });

            await page.waitForTimeout(randomDelay(800, 1500));

            // Click new lead button
            const newLeadBtn = page.locator('[data-testid="new-lead-btn"]');
            await newLeadBtn.waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });
            await newLeadBtn.click();
            await page.waitForTimeout(randomDelay(500, 1000));

            // Wait for dialog to appear
            await page.locator('.cdk-overlay-container app-dialog, .cdk-overlay-container .mat-mdc-dialog-container').first()
              .waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });

            // --- Fill every field with realistic data ---

            // Company name — unique stress-test identifier
            const companyName = testId('StressLead');
            await fillByTestId(page, 'lead-company-name', companyName);
            await page.waitForTimeout(randomDelay(400, 800));

            // Contact name — full name from pool
            const contactName = randomPick(LEAD_CONTACTS);
            await fillByTestId(page, 'lead-contact-name', contactName);
            await page.waitForTimeout(randomDelay(300, 600));

            // Email — derived from contact name + random domain
            const emailLocal = contactName.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z.]/g, '');
            const emailDomain = randomPick(LEAD_EMAILS_DOMAINS);
            await fillByTestId(page, 'lead-email', `${emailLocal}@${emailDomain}`);
            await page.waitForTimeout(randomDelay(300, 600));

            // Phone — realistic (555) XXX-XXXX format
            const phone = `(555) ${randomInt(200, 899)}-${randomInt(1000, 9999)}`;
            await fillByTestId(page, 'lead-phone', phone);
            await page.waitForTimeout(randomDelay(200, 500));

            // Source — mat-select from known options
            await selectByTestId(page, 'lead-source', randomPick(LEAD_SOURCES));
            await page.waitForTimeout(randomDelay(300, 600));

            // Follow-up date — 3-14 days out
            await fillDateByTestId(page, 'lead-follow-up', randomDate(3, 14));
            await page.waitForTimeout(randomDelay(300, 500));

            // Notes — detailed manager note
            const notes = [
              `Met ${contactName} at ${randomPick(['MFG Summit', 'IMTS trade show', 'industry mixer', 'LinkedIn outreach'])}. `,
              `Company is looking for ${randomPick(['CNC machining', 'injection molding', 'sheet metal fabrication', 'assembly services'])}. `,
              `Estimated annual volume: ${randomPick(['$50K-100K', '$100K-250K', '$250K-500K', '$500K+'])}. `,
              `Follow up with ${randomPick(['quote package', 'facility tour invite', 'capability deck', 'sample parts'])}.`,
            ].join('');
            await fillByTestId(page, 'lead-notes', notes);
            await page.waitForTimeout(randomDelay(400, 800));

            // Save the lead via DOM click
            await page.waitForTimeout(1000);
            await page.evaluate(() => {
              const btn = document.querySelector('[data-testid="lead-save-btn"]') as HTMLButtonElement;
              if (btn && !btn.disabled) btn.click();
            });
            await page.waitForTimeout(3000);

            // Dismiss any snackbar
            await dismissSnackbar(page);
          } catch {
            // Lead creation failed — close any open dialog
            await page.keyboard.press('Escape');
            await page.waitForTimeout(500);
          }

          await page.waitForTimeout(randomDelay(800, 1500));
        },
      },

      // ---------------------------------------------------------------
      // mgr-05 — Leads: sort table, browse pipeline
      // ---------------------------------------------------------------
      {
        id: 'mgr-05',
        name: 'Leads — sort by company, browse pipeline',
        execute: async (page: Page) => {
          try {
            // Already on /leads from step 04, but navigate anyway for resilience
            await page.goto('/leads', { waitUntil: 'load', timeout: NAV_TIMEOUT });

            await page.locator('app-data-table').first()
              .waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });

            await sortByColumn(page, 'Company');
            await page.waitForTimeout(randomDelay(500, 1000));

            await browseTableRows(page, 6);

            // Maybe click a lead to review detail
            if (maybe(0.4)) {
              const rows = page.locator('app-data-table tbody tr');
              const rowCount = await rows.count();
              if (rowCount > 0) {
                await rows.nth(randomInt(0, Math.min(rowCount - 1, 4))).click();
                await page.waitForTimeout(randomDelay(800, 1500));
                await page.keyboard.press('Escape');
                await page.waitForTimeout(randomDelay(300, 600));
              }
            }
          } catch {
            await page.keyboard.press('Escape').catch(() => {});
          }

          await page.waitForTimeout(randomDelay(800, 1500));
        },
      },

      // ---------------------------------------------------------------
      // mgr-06 — Backlog: sort by priority, review
      // ---------------------------------------------------------------
      {
        id: 'mgr-06',
        name: 'Backlog — sort by priority, review job list',
        execute: async (page: Page) => {
          try {
            await page.goto('/backlog', { waitUntil: 'load', timeout: NAV_TIMEOUT });

            await page.locator('app-data-table').first()
              .waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });

            await page.waitForTimeout(randomDelay(500, 1000));

            await sortByColumn(page, 'Priority');
            await page.waitForTimeout(randomDelay(500, 1000));

            // Maybe sort descending
            if (maybe(0.5)) {
              await sortByColumn(page, 'Priority');
              await page.waitForTimeout(randomDelay(300, 600));
            }

            await browseTableRows(page, 8);
          } catch {
            // Backlog may be empty
          }

          await page.waitForTimeout(randomDelay(800, 1500));
        },
      },

      // ---------------------------------------------------------------
      // mgr-07 — Backlog: click a row to open detail, review, close
      // ---------------------------------------------------------------
      {
        id: 'mgr-07',
        name: 'Backlog — open job detail dialog',
        execute: async (page: Page) => {
          try {
            const rows = page.locator('app-data-table tbody tr');
            const rowCount = await rows.count();
            if (rowCount > 0) {
              const idx = randomInt(0, Math.min(rowCount - 1, 5));
              await rows.nth(idx).click();
              await page.waitForTimeout(randomDelay(1000, 2000));

              // Scroll through detail content
              await randomScroll(page);
              await page.waitForTimeout(randomDelay(500, 1000));

              // Close dialog
              await page.keyboard.press('Escape');
              await page.waitForTimeout(randomDelay(300, 600));
            }
          } catch {
            await page.keyboard.press('Escape').catch(() => {});
          }

          await page.waitForTimeout(randomDelay(800, 1500));
        },
      },

      // ---------------------------------------------------------------
      // mgr-08 — Time tracking: review team entries, sort by date
      // ---------------------------------------------------------------
      {
        id: 'mgr-08',
        name: 'Time tracking — review team entries',
        execute: async (page: Page) => {
          try {
            await page.goto('/time-tracking', { waitUntil: 'load', timeout: NAV_TIMEOUT });

            await page.locator('app-data-table, app-page-layout').first()
              .waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });

            await page.waitForTimeout(randomDelay(800, 1500));

            await sortByColumn(page, 'Date').catch(() => {});
            await page.waitForTimeout(randomDelay(500, 1000));

            await browseTableRows(page, 6);
          } catch {
            // Time tracking page may be empty
          }

          await page.waitForTimeout(randomDelay(800, 1500));
        },
      },

      // ---------------------------------------------------------------
      // mgr-09 — Manual time entry: log management hours
      // ---------------------------------------------------------------
      {
        id: 'mgr-09',
        name: 'Time tracking — log manual management hours',
        execute: async (page: Page) => {
          try {
            const manualBtn = page.locator('[data-testid="manual-entry-btn"]');
            await manualBtn.waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });
            await manualBtn.click();
            await page.waitForTimeout(randomDelay(500, 1000));

            // Wait for dialog
            await page.locator('.cdk-overlay-container app-dialog, .cdk-overlay-container .mat-mdc-dialog-container').first()
              .waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });

            await fillDateByTestId(page, 'time-entry-date', randomDate(-1, 1));
            await page.waitForTimeout(randomDelay(200, 500));

            await selectByTestId(page, 'time-entry-category', 'Management');
            await page.waitForTimeout(randomDelay(200, 400));

            const hours = randomInt(1, 4);
            const minutes = randomPick([0, 15, 30, 45]);
            await fillByTestId(page, 'time-entry-hours', String(hours));
            await page.waitForTimeout(randomDelay(150, 350));

            await fillByTestId(page, 'time-entry-minutes', String(minutes));
            await page.waitForTimeout(randomDelay(150, 350));

            await fillByTestId(page, 'time-entry-notes', randomPick(TIME_ENTRY_NOTES));
            await page.waitForTimeout(randomDelay(300, 600));

            await page.evaluate(() => {
              const btn = document.querySelector('[data-testid="time-entry-save-btn"]') as HTMLButtonElement;
              if (btn && !btn.disabled) btn.click();
            });
            await page.waitForTimeout(3000);
            await dismissSnackbar(page);
          } catch {
            await page.keyboard.press('Escape');
            await page.waitForTimeout(500);
          }

          await page.waitForTimeout(randomDelay(800, 1500));
        },
      },

      // ---------------------------------------------------------------
      // mgr-10 — CREATE EXPENSE
      // ---------------------------------------------------------------
      {
        id: 'mgr-10',
        name: 'Create expense report',
        execute: async (page: Page) => {
          try {
            await page.goto('/expenses', { waitUntil: 'load', timeout: NAV_TIMEOUT });

            await page.locator('app-data-table, app-page-layout').first()
              .waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });

            await page.waitForTimeout(randomDelay(800, 1500));

            const newExpenseBtn = page.locator('[data-testid="new-expense-btn"]');
            await newExpenseBtn.waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });
            await newExpenseBtn.click();
            await page.waitForTimeout(randomDelay(500, 1000));

            await page.locator('.cdk-overlay-container app-dialog, .cdk-overlay-container .mat-mdc-dialog-container').first()
              .waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });

            await fillByTestId(page, 'expense-amount', randomAmount(25, 750));
            await page.waitForTimeout(randomDelay(200, 500));

            await fillDateByTestId(page, 'expense-date', randomDate(-7, 7));
            await page.waitForTimeout(randomDelay(200, 400));

            await selectByTestId(page, 'expense-category', randomPick(EXPENSE_CATEGORIES));
            await page.waitForTimeout(randomDelay(200, 500));

            await fillByTestId(page, 'expense-description', randomPick(EXPENSE_DESCRIPTIONS));
            await page.waitForTimeout(randomDelay(300, 600));

            await page.evaluate(() => {
              const btn = document.querySelector('[data-testid="expense-save-btn"]') as HTMLButtonElement;
              if (btn && !btn.disabled) btn.click();
            });
            await page.waitForTimeout(3000);
            await dismissSnackbar(page);
          } catch {
            await page.keyboard.press('Escape');
            await page.waitForTimeout(500);
          }

          await page.waitForTimeout(randomDelay(800, 1500));
        },
      },

      // ---------------------------------------------------------------
      // mgr-11 — Expenses: sort by date, review list
      // ---------------------------------------------------------------
      {
        id: 'mgr-11',
        name: 'Expenses — sort by date, review list',
        execute: async (page: Page) => {
          try {
            await page.goto('/expenses', { waitUntil: 'load', timeout: NAV_TIMEOUT });

            await page.locator('app-data-table').first()
              .waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });

            await sortByColumn(page, 'Date').catch(() => {});
            await page.waitForTimeout(randomDelay(500, 1000));

            await browseTableRows(page, 5);
          } catch {
            // Expenses may be empty
          }

          await page.waitForTimeout(randomDelay(800, 1500));
        },
      },

      // ---------------------------------------------------------------
      // mgr-12 — Reports: Team Workload report
      // ---------------------------------------------------------------
      {
        id: 'mgr-12',
        name: 'Reports — Team Workload report',
        execute: async (page: Page) => {
          try {
            await page.goto('/reports', { waitUntil: 'load', timeout: NAV_TIMEOUT });

            await page.locator('app-page-layout, .report-nav-item, app-data-table').first()
              .waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });

            await page.waitForTimeout(randomDelay(800, 1500));

            // Click Team Workload report
            const workloadReport = page.locator('.report-nav-item', { hasText: 'Team Workload' });
            if (await workloadReport.count() > 0) {
              await workloadReport.first().click();
              await page.waitForTimeout(randomDelay(1500, 3000));

              // Wait for chart or table content
              await page.locator('canvas, app-data-table, .chart-container, .report-content').first()
                .waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT }).catch(() => {});

              await randomScroll(page);
            }
          } catch {
            // Report may not exist
          }

          await page.waitForTimeout(randomDelay(800, 1500));
        },
      },

      // ---------------------------------------------------------------
      // mgr-13 — Reports: Expense Summary report
      // ---------------------------------------------------------------
      {
        id: 'mgr-13',
        name: 'Reports — Expense Summary report',
        execute: async (page: Page) => {
          try {
            const expenseReport = page.locator('.report-nav-item', { hasText: 'Expense' });
            if (await expenseReport.count() > 0) {
              await expenseReport.first().click();
              await page.waitForTimeout(randomDelay(1500, 3000));

              await page.locator('canvas, app-data-table, .chart-container, .report-content').first()
                .waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT }).catch(() => {});

              await randomScroll(page);
            }
          } catch {
            // Expense report may not exist — navigate fresh
            await page.goto('/reports', { waitUntil: 'load', timeout: NAV_TIMEOUT }).catch(() => {});
          }

          await page.waitForTimeout(randomDelay(800, 1500));
        },
      },

      // ---------------------------------------------------------------
      // mgr-14 — Reports: Lead Pipeline report
      // ---------------------------------------------------------------
      {
        id: 'mgr-14',
        name: 'Reports — Lead Pipeline report',
        execute: async (page: Page) => {
          try {
            const leadReport = page.locator('.report-nav-item', { hasText: 'Lead' });
            if (await leadReport.count() > 0) {
              await leadReport.first().click();
              await page.waitForTimeout(randomDelay(1500, 3000));

              await page.locator('canvas, app-data-table, .chart-container, .report-content').first()
                .waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT }).catch(() => {});

              await randomScroll(page);
            }
          } catch {
            // Lead report may not exist
          }

          await page.waitForTimeout(randomDelay(800, 1500));
        },
      },

      // ---------------------------------------------------------------
      // mgr-15 — Planning: review current cycle
      // ---------------------------------------------------------------
      {
        id: 'mgr-15',
        name: 'Planning — review current cycle',
        execute: async (page: Page) => {
          try {
            await page.goto('/planning', { waitUntil: 'load', timeout: NAV_TIMEOUT });

            await page.locator('app-page-layout, app-data-table, .planning').first()
              .waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });

            await page.waitForTimeout(randomDelay(800, 1500));

            // Browse planning entries
            await browseTableRows(page, 5);

            // Check for cycle header
            const cycleInfo = page.locator('.planning-cycle, .cycle-header, [class*="cycle"]');
            if (await cycleInfo.count() > 0) {
              await cycleInfo.first().scrollIntoViewIfNeeded();
              await page.waitForTimeout(randomDelay(300, 800));
            }
          } catch {
            // Planning page may be empty
          }

          await page.waitForTimeout(randomDelay(800, 1500));
        },
      },

      // ---------------------------------------------------------------
      // mgr-16 — Customers: browse customer list
      // ---------------------------------------------------------------
      {
        id: 'mgr-16',
        name: 'Customers — browse customer list',
        execute: async (page: Page) => {
          try {
            await page.goto('/customers', { waitUntil: 'load', timeout: NAV_TIMEOUT });

            await page.locator('app-data-table, app-page-layout').first()
              .waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });

            await page.waitForTimeout(randomDelay(500, 1000));

            await sortByColumn(page, 'Name').catch(() => {});
            await page.waitForTimeout(randomDelay(400, 800));

            await browseTableRows(page, 5);

            // Maybe click a customer to see detail
            if (maybe(0.3)) {
              const rows = page.locator('app-data-table tbody tr');
              const rowCount = await rows.count();
              if (rowCount > 0) {
                await rows.nth(randomInt(0, Math.min(rowCount - 1, 4))).click();
                await page.waitForTimeout(randomDelay(1000, 2000));
                await page.goBack().catch(() => {});
                await page.waitForTimeout(randomDelay(500, 1000));
              }
            }
          } catch {
            // Customer list may be empty
          }

          await page.waitForTimeout(randomDelay(800, 1500));
        },
      },

      // ---------------------------------------------------------------
      // mgr-17 — Sales Orders: browse, sort by status
      // ---------------------------------------------------------------
      {
        id: 'mgr-17',
        name: 'Sales Orders — browse order list',
        execute: async (page: Page) => {
          try {
            await page.goto('/sales-orders', { waitUntil: 'load', timeout: NAV_TIMEOUT });

            await page.locator('app-data-table, app-page-layout').first()
              .waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });

            await sortByColumn(page, 'Status').catch(() => {});
            await page.waitForTimeout(randomDelay(500, 1000));

            await browseTableRows(page, 5);
          } catch {
            // Sales orders may be empty
          }

          await page.waitForTimeout(randomDelay(800, 1500));
        },
      },

      // ---------------------------------------------------------------
      // mgr-18 — Quotes: browse quote list
      // ---------------------------------------------------------------
      {
        id: 'mgr-18',
        name: 'Quotes — browse quote list',
        execute: async (page: Page) => {
          try {
            await page.goto('/quotes', { waitUntil: 'load', timeout: NAV_TIMEOUT });

            await page.locator('app-data-table, app-page-layout').first()
              .waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });

            await sortByColumn(page, 'Customer').catch(() => {});
            await page.waitForTimeout(randomDelay(500, 1000));

            await browseTableRows(page, 5);

            // Maybe click a quote to review
            if (maybe(0.3)) {
              const rows = page.locator('app-data-table tbody tr');
              const rowCount = await rows.count();
              if (rowCount > 0) {
                await rows.nth(randomInt(0, Math.min(rowCount - 1, 3))).click();
                await page.waitForTimeout(randomDelay(800, 1500));
                await page.keyboard.press('Escape');
                await page.waitForTimeout(randomDelay(300, 600));
              }
            }
          } catch {
            await page.keyboard.press('Escape').catch(() => {});
          }

          await page.waitForTimeout(randomDelay(800, 1500));
        },
      },

      // ---------------------------------------------------------------
      // mgr-19 — Purchase Orders: browse PO list
      // ---------------------------------------------------------------
      {
        id: 'mgr-19',
        name: 'Purchase Orders — browse PO list',
        execute: async (page: Page) => {
          try {
            await page.goto('/purchase-orders', { waitUntil: 'load', timeout: NAV_TIMEOUT });

            await page.locator('app-data-table, app-page-layout').first()
              .waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });

            await sortByColumn(page, 'Status').catch(() => {});
            await page.waitForTimeout(randomDelay(500, 1000));

            await browseTableRows(page, 5);
          } catch {
            // PO list may be empty
          }

          await page.waitForTimeout(randomDelay(800, 1500));
        },
      },

      // ---------------------------------------------------------------
      // mgr-20 — Invoices: browse invoice list
      // ---------------------------------------------------------------
      {
        id: 'mgr-20',
        name: 'Invoices — browse invoice list',
        execute: async (page: Page) => {
          try {
            await page.goto('/invoices', { waitUntil: 'load', timeout: NAV_TIMEOUT });

            await page.locator('app-data-table, app-page-layout').first()
              .waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });

            await sortByColumn(page, 'Date').catch(() => {});
            await page.waitForTimeout(randomDelay(500, 1000));

            await browseTableRows(page, 5);
          } catch {
            // Invoices may be empty
          }

          await page.waitForTimeout(randomDelay(800, 1500));
        },
      },

      // ---------------------------------------------------------------
      // mgr-21 — Payments: browse payment list
      // ---------------------------------------------------------------
      {
        id: 'mgr-21',
        name: 'Payments — browse payment list',
        execute: async (page: Page) => {
          try {
            await page.goto('/payments', { waitUntil: 'load', timeout: NAV_TIMEOUT });

            await page.locator('app-data-table, app-page-layout').first()
              .waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });

            await sortByColumn(page, 'Amount').catch(() => {});
            await page.waitForTimeout(randomDelay(500, 1000));

            await browseTableRows(page, 5);
          } catch {
            // Payments may be empty
          }

          await page.waitForTimeout(randomDelay(800, 1500));
        },
      },

      // ---------------------------------------------------------------
      // mgr-22 — Shipments: browse shipment list
      // ---------------------------------------------------------------
      {
        id: 'mgr-22',
        name: 'Shipments — browse shipment list',
        execute: async (page: Page) => {
          try {
            await page.goto('/shipments', { waitUntil: 'load', timeout: NAV_TIMEOUT });

            await page.locator('app-data-table, app-page-layout').first()
              .waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });

            await sortByColumn(page, 'Status').catch(() => {});
            await page.waitForTimeout(randomDelay(500, 1000));

            await browseTableRows(page, 5);
          } catch {
            // Shipments may be empty
          }

          await page.waitForTimeout(randomDelay(800, 1500));
        },
      },

      // ---------------------------------------------------------------
      // mgr-23 — Vendors: browse vendor list
      // ---------------------------------------------------------------
      {
        id: 'mgr-23',
        name: 'Vendors — browse vendor list',
        execute: async (page: Page) => {
          try {
            await page.goto('/vendors', { waitUntil: 'load', timeout: NAV_TIMEOUT });

            await page.locator('app-data-table, app-page-layout').first()
              .waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });

            await sortByColumn(page, 'Name').catch(() => {});
            await page.waitForTimeout(randomDelay(500, 1000));

            await browseTableRows(page, 5);

            // Maybe click a vendor for detail
            if (maybe(0.3)) {
              const rows = page.locator('app-data-table tbody tr');
              const rowCount = await rows.count();
              if (rowCount > 0) {
                await rows.nth(randomInt(0, Math.min(rowCount - 1, 3))).click();
                await page.waitForTimeout(randomDelay(800, 1500));
                await page.keyboard.press('Escape');
                await page.waitForTimeout(randomDelay(300, 600));
              }
            }
          } catch {
            await page.keyboard.press('Escape').catch(() => {});
          }

          await page.waitForTimeout(randomDelay(800, 1500));
        },
      },

      // ---------------------------------------------------------------
      // mgr-24 — Chat: send management update message
      // ---------------------------------------------------------------
      {
        id: 'mgr-24',
        name: 'Chat — send management update',
        execute: async (page: Page) => {
          try {
            await page.goto('/chat', { waitUntil: 'load', timeout: NAV_TIMEOUT });

            await page.locator('.chat-room, .chat-list, app-page-layout, [class*="chat"]').first()
              .waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });

            await page.waitForTimeout(randomDelay(800, 1500));

            // Select a chat room
            const rooms = page.locator('.chat-room-item, .room-item, [class*="room"]');
            const roomCount = await rooms.count();
            if (roomCount > 0) {
              await rooms.nth(randomInt(0, Math.min(roomCount - 1, 3))).click();
              await page.waitForTimeout(randomDelay(500, 1000));
            }

            // Type and send a message
            const messageInput = page.locator('[data-testid="chat-message-input"]');
            if (await messageInput.count() > 0) {
              await messageInput.first().click();
              await page.waitForTimeout(randomDelay(200, 500));
              await messageInput.first().fill(randomPick(CHAT_MESSAGES));
              await page.waitForTimeout(randomDelay(400, 800));

              const sendBtn = page.locator('[data-testid="chat-send-btn"]');
              if (await sendBtn.count() > 0) {
                await sendBtn.first().click();
              } else {
                await page.keyboard.press('Enter');
              }

              await page.waitForTimeout(randomDelay(500, 1200));
            }
          } catch {
            // Chat may not be available
          }

          await page.waitForTimeout(randomDelay(800, 1500));
        },
      },

      // ---------------------------------------------------------------
      // mgr-25 — Assets: browse asset list
      // ---------------------------------------------------------------
      {
        id: 'mgr-25',
        name: 'Assets — browse asset list',
        execute: async (page: Page) => {
          try {
            await page.goto('/assets', { waitUntil: 'load', timeout: NAV_TIMEOUT });

            await page.locator('app-data-table, app-page-layout').first()
              .waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });

            await sortByColumn(page, 'Name').catch(() => {});
            await page.waitForTimeout(randomDelay(500, 1000));

            await browseTableRows(page, 5);

            // Maybe click asset to review
            if (maybe(0.3)) {
              const rows = page.locator('app-data-table tbody tr');
              const rowCount = await rows.count();
              if (rowCount > 0) {
                await rows.nth(randomInt(0, Math.min(rowCount - 1, 4))).click();
                await page.waitForTimeout(randomDelay(800, 1500));
                await page.keyboard.press('Escape');
                await page.waitForTimeout(randomDelay(300, 600));
              }
            }
          } catch {
            await page.keyboard.press('Escape').catch(() => {});
          }

          await page.waitForTimeout(randomDelay(800, 1500));
        },
      },

      // ---------------------------------------------------------------
      // mgr-26 — Quality: review inspections
      // ---------------------------------------------------------------
      {
        id: 'mgr-26',
        name: 'Quality — review inspections',
        execute: async (page: Page) => {
          try {
            await page.goto('/quality/inspections', { waitUntil: 'load', timeout: NAV_TIMEOUT });

            await page.locator('app-data-table, app-page-layout').first()
              .waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });

            await sortByColumn(page, 'Status').catch(() => {});
            await page.waitForTimeout(randomDelay(500, 1000));

            await browseTableRows(page, 5);
          } catch {
            // Quality inspections may be empty
          }

          await page.waitForTimeout(randomDelay(800, 1500));
        },
      },

      // ---------------------------------------------------------------
      // mgr-27 — Parts: browse parts catalog
      // ---------------------------------------------------------------
      {
        id: 'mgr-27',
        name: 'Parts — browse parts catalog',
        execute: async (page: Page) => {
          try {
            await page.goto('/parts', { waitUntil: 'load', timeout: NAV_TIMEOUT });

            await page.locator('app-data-table, app-page-layout').first()
              .waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });

            await sortByColumn(page, 'Part #').catch(() => {});
            await page.waitForTimeout(randomDelay(500, 1000));

            await browseTableRows(page, 6);

            // Maybe click a part to check detail
            if (maybe(0.3)) {
              const rows = page.locator('app-data-table tbody tr');
              const rowCount = await rows.count();
              if (rowCount > 0) {
                await rows.nth(randomInt(0, Math.min(rowCount - 1, 4))).click();
                await page.waitForTimeout(randomDelay(1000, 2000));
                await page.keyboard.press('Escape');
                await page.waitForTimeout(randomDelay(300, 600));
              }
            }
          } catch {
            await page.keyboard.press('Escape').catch(() => {});
          }

          await page.waitForTimeout(randomDelay(800, 1500));
        },
      },

      // ---------------------------------------------------------------
      // mgr-28 — Inventory: review stock levels
      // ---------------------------------------------------------------
      {
        id: 'mgr-28',
        name: 'Inventory — review stock levels',
        execute: async (page: Page) => {
          try {
            await page.goto('/inventory', { waitUntil: 'load', timeout: NAV_TIMEOUT });

            await page.locator('app-data-table, app-page-layout').first()
              .waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });

            await page.waitForTimeout(randomDelay(500, 1000));

            await browseTableRows(page, 5);

            await randomScroll(page);
          } catch {
            // Inventory may be empty
          }

          await page.waitForTimeout(randomDelay(800, 1500));
        },
      },

      // ---------------------------------------------------------------
      // mgr-29 — Customer Returns: browse returns
      // ---------------------------------------------------------------
      {
        id: 'mgr-29',
        name: 'Customer Returns — browse returns',
        execute: async (page: Page) => {
          try {
            await page.goto('/customer-returns', { waitUntil: 'load', timeout: NAV_TIMEOUT });

            await page.locator('app-data-table, app-page-layout').first()
              .waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });

            await sortByColumn(page, 'Status').catch(() => {});
            await page.waitForTimeout(randomDelay(500, 1000));

            await browseTableRows(page, 4);
          } catch {
            // Returns may be empty
          }

          await page.waitForTimeout(randomDelay(800, 1500));
        },
      },

      // ---------------------------------------------------------------
      // mgr-30 — Training: review team training status
      // ---------------------------------------------------------------
      {
        id: 'mgr-30',
        name: 'Training — review team training status',
        execute: async (page: Page) => {
          try {
            await page.goto('/training', { waitUntil: 'load', timeout: NAV_TIMEOUT });

            await page.locator('app-data-table, app-page-layout, .training-module, mat-card').first()
              .waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });

            await page.waitForTimeout(randomDelay(800, 1500));

            // Scroll through training modules
            await randomScroll(page);
            await page.waitForTimeout(randomDelay(500, 1000));
            await randomScroll(page);
          } catch {
            // Training may be empty
          }

          await page.waitForTimeout(randomDelay(800, 1500));
        },
      },

      // ---------------------------------------------------------------
      // mgr-31 — Events: check upcoming events
      // ---------------------------------------------------------------
      {
        id: 'mgr-31',
        name: 'Events — check upcoming events',
        execute: async (page: Page) => {
          try {
            await page.goto('/admin/events', { waitUntil: 'load', timeout: NAV_TIMEOUT });

            await page.locator('app-data-table, app-page-layout').first()
              .waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });

            await page.waitForTimeout(randomDelay(500, 1000));

            await browseTableRows(page, 4);
          } catch {
            // Events page may redirect or be empty
          }

          await page.waitForTimeout(randomDelay(800, 1500));
        },
      },

      // ---------------------------------------------------------------
      // mgr-32 — Calendar: review schedule
      // ---------------------------------------------------------------
      {
        id: 'mgr-32',
        name: 'Calendar — review schedule',
        execute: async (page: Page) => {
          try {
            await page.goto('/calendar', { waitUntil: 'load', timeout: NAV_TIMEOUT });

            await page.locator('mat-calendar, .calendar, app-page-layout, [class*="calendar"]').first()
              .waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });

            await page.waitForTimeout(randomDelay(1000, 2000));

            // Maybe click a date
            if (maybe(0.4)) {
              const dates = page.locator('.mat-calendar-body-cell');
              const dateCount = await dates.count();
              if (dateCount > 0) {
                await dates.nth(randomInt(0, Math.min(dateCount - 1, 27))).click();
                await page.waitForTimeout(randomDelay(500, 1000));
              }
            }
          } catch {
            // Calendar may not render
          }

          await page.waitForTimeout(randomDelay(800, 1500));
        },
      },

      // ---------------------------------------------------------------
      // mgr-33 — Notifications: check notifications
      // ---------------------------------------------------------------
      {
        id: 'mgr-33',
        name: 'Notifications — check and manage',
        execute: async (page: Page) => {
          try {
            // Click the notification bell in the header
            const bellBtn = page.locator(
              '[data-testid="notification-bell"], button[aria-label*="notification" i], .notification-bell, button:has(.material-icons-outlined:text("notifications"))',
            );

            if (await bellBtn.count() > 0) {
              await bellBtn.first().click();
              await page.waitForTimeout(randomDelay(500, 1200));

              const panel = page.locator('.notification-panel, app-notification-panel, [class*="notification-panel"]');
              if (await panel.count() > 0) {
                await panel.first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});

                // Scroll through notifications
                const items = page.locator('.notification-item, .notification-entry, [class*="notification-item"]');
                const itemCount = await items.count();
                for (let i = 0; i < Math.min(itemCount, 5); i++) {
                  await items.nth(i).scrollIntoViewIfNeeded();
                  await page.waitForTimeout(randomDelay(150, 400));
                }

                // Maybe mark all as read
                if (maybe(0.3)) {
                  const markAllBtn = page.locator('button:has-text("Mark all"), button:has-text("mark all read"), [data-testid="mark-all-read"]');
                  if (await markAllBtn.count() > 0) {
                    await markAllBtn.first().click();
                    await page.waitForTimeout(randomDelay(300, 800));
                  }
                }
              }

              // Close notification panel
              await page.keyboard.press('Escape');
              await page.waitForTimeout(randomDelay(300, 600));
            }
          } catch {
            await page.keyboard.press('Escape').catch(() => {});
          }

          await page.waitForTimeout(randomDelay(800, 1500));
        },
      },

      // ---------------------------------------------------------------
      // mgr-34 — Account: review profile
      // ---------------------------------------------------------------
      {
        id: 'mgr-34',
        name: 'Account — review profile',
        execute: async (page: Page) => {
          try {
            await page.goto('/account', { waitUntil: 'load', timeout: NAV_TIMEOUT });

            await page.locator('app-page-layout, form, .account, .profile, mat-card').first()
              .waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });

            await page.waitForTimeout(randomDelay(1000, 2000));

            // Scroll through profile sections
            await randomScroll(page);
            await page.waitForTimeout(randomDelay(500, 1000));
          } catch {
            // Account page may not load
          }

          await page.waitForTimeout(randomDelay(800, 1500));
        },
      },

      // ---------------------------------------------------------------
      // mgr-35 — Return to dashboard
      // ---------------------------------------------------------------
      {
        id: 'mgr-35',
        name: 'Return to dashboard — end of shift',
        execute: async (page: Page) => {
          try {
            await page.goto('/dashboard', { waitUntil: 'load', timeout: NAV_TIMEOUT });

            await page.locator('.dashboard-widget, app-kpi-chip, app-dashboard-widget').first()
              .waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });

            // Final review of KPIs
            const kpiChips = page.locator('app-kpi-chip');
            const chipCount = await kpiChips.count();
            for (let i = 0; i < Math.min(chipCount, 4); i++) {
              await kpiChips.nth(i).scrollIntoViewIfNeeded();
              await page.waitForTimeout(randomDelay(200, 500));
            }
          } catch {
            // Dashboard navigation failed
          }

          await page.waitForTimeout(randomDelay(800, 2000));
        },
      },
    ],
  };
}
