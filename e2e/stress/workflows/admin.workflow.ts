import type { Page } from 'playwright';
import type { Workflow } from '../orchestrator';
import { fillByTestId, selectByTestId, fillDateByTestId } from '../../lib/form.lib';
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

const ADMIN_JOB_DESCRIPTIONS = [
  'Admin-initiated build — rework lot for customer quality escalation',
  'Tooling refurbishment — cavity repair and polish for injection mold #217',
  'Priority hot-job — expedited prototype run for Apex trade-show demo',
  'Scheduled preventive maintenance — rebuild spindle bearings on VMC-04',
  'Engineering change order — update bracket per Rev. C drawing markup',
  'Capital equipment install — foundation work for new 5-axis VMC',
];

const ADMIN_CHAT_MESSAGES = [
  'Admin system check complete — all panels reviewed, system healthy',
  'Verified user accounts and permissions — no issues found',
  'Reference data and terminology settings confirmed',
  'Scheduled tasks running on schedule, no failures detected',
  'System health check complete — all integrations nominal',
  'Reminder: timesheet deadline is end of day Friday',
];

const EXPENSE_CATEGORIES = ['Office Supplies', 'Software', 'Travel', 'Equipment', 'Utilities'];

const EXPENSE_DESCRIPTIONS = [
  'Annual software license renewal — ERP system',
  'Office printer paper and toner — quarterly restock',
  'Cloud hosting infrastructure bill — April',
  'Conference registration fee — manufacturing summit',
  'Network equipment maintenance contract',
  'Safety supplies restock — PPE, signage, first aid',
];

const TIME_ENTRY_NOTES = [
  'System administration — user account audit and cleanup',
  'Quarterly compliance review — checked all form submissions',
  'IT infrastructure planning meeting with vendor',
  'Report generation and KPI analysis for leadership team',
  'Integration troubleshooting — QuickBooks sync queue review',
  'Employee onboarding setup — new hire account provisioning',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function waitForPageContent(page: Page): Promise<void> {
  await page.locator('app-data-table, form, .tab-panel, mat-card, .page-content, app-page-layout').first()
    .waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });
}

async function randomScroll(page: Page): Promise<void> {
  const scrollAmount = Math.floor(Math.random() * 400) + 100;
  await page.mouse.wheel(0, scrollAmount);
  await page.waitForTimeout(randomDelay(300, 600));
}

async function clickRandomRow(page: Page): Promise<boolean> {
  const rows = page.locator('app-data-table tbody tr');
  const rowCount = await rows.count();
  if (rowCount > 0) {
    const index = Math.floor(Math.random() * Math.min(rowCount, 5));
    await rows.nth(index).click({ timeout: ELEMENT_TIMEOUT });
    return true;
  }
  return false;
}

async function closeOverlay(page: Page): Promise<void> {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(randomDelay(300, 600));
}

async function browseTablePage(page: Page, sortCol?: string): Promise<void> {
  await waitForTable(page, 0, ELEMENT_TIMEOUT).catch(() => {});
  await page.waitForTimeout(randomDelay(500, 1000));
  if (sortCol) {
    await sortByColumn(page, sortCol).catch(() => {});
    await page.waitForTimeout(randomDelay(500, 1000));
  }
  await randomScroll(page);
}

async function switchTab(page: Page, tabText: RegExp | string): Promise<void> {
  const selector = typeof tabText === 'string'
    ? `.tab, [role="tab"], mat-tab-header .mdc-tab`
    : `.tab, [role="tab"], mat-tab-header .mdc-tab`;
  const tab = typeof tabText === 'string'
    ? page.locator(selector).filter({ hasText: tabText }).first()
    : page.locator(selector).filter({ hasText: tabText }).first();
  if (await tab.isVisible({ timeout: 2000 }).catch(() => false)) {
    await tab.click();
    await page.waitForTimeout(randomDelay(600, 1200));
  }
}

// ---------------------------------------------------------------------------
// Workflow — 50 steps covering every admin-accessible page
// ---------------------------------------------------------------------------

export function getAdminWorkflow(): Workflow {
  return {
    name: 'admin',
    steps: [
      // =================================================================
      // ADMIN-ONLY PAGES (steps 1-10)
      // =================================================================

      // ---------------------------------------------------------------
      // 1. Dashboard — review system KPIs
      // ---------------------------------------------------------------
      {
        id: 'adm-01',
        name: 'Review dashboard overview',
        execute: async (page: Page) => {
          try {
            await page.goto('/dashboard', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.locator('app-dashboard-widget, app-kpi-chip, .dashboard-widget').first()
              .waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });
            await page.waitForTimeout(randomDelay(1000, 2000));
            await randomScroll(page);
            await page.waitForTimeout(randomDelay(800, 1500));
          } catch {
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // ---------------------------------------------------------------
      // 2. Admin Users — browse user list, sort, click detail
      // ---------------------------------------------------------------
      {
        id: 'adm-02',
        name: 'Browse admin user list',
        execute: async (page: Page) => {
          try {
            await page.goto('/admin/users', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await waitForTable(page, 1, ELEMENT_TIMEOUT);
            await page.waitForTimeout(randomDelay(800, 1500));

            await sortByColumn(page, 'Name');
            await page.waitForTimeout(randomDelay(600, 1200));

            if (await clickRandomRow(page)) {
              await page.waitForTimeout(randomDelay(1000, 2000));
              await closeOverlay(page);
            }
          } catch {
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // ---------------------------------------------------------------
      // 3. Admin Settings — review company profile, scroll to locations
      // ---------------------------------------------------------------
      {
        id: 'adm-03',
        name: 'Review company settings and locations',
        execute: async (page: Page) => {
          try {
            await page.goto('/admin/settings', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await waitForPageContent(page);
            await page.waitForTimeout(randomDelay(800, 1500));

            const formFields = page.locator('app-input, app-select, mat-form-field');
            await formFields.first().waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });
            await page.waitForTimeout(randomDelay(600, 1200));

            // Scroll to locations section
            await randomScroll(page);
            await page.waitForTimeout(randomDelay(500, 1000));
            await randomScroll(page);
          } catch {
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // ---------------------------------------------------------------
      // 4. Admin Integrations — review integration status
      // ---------------------------------------------------------------
      {
        id: 'adm-04',
        name: 'Review integration status',
        execute: async (page: Page) => {
          try {
            await page.goto('/admin/integrations', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await waitForPageContent(page);
            await page.waitForTimeout(randomDelay(1000, 2000));
            await randomScroll(page);
            await page.waitForTimeout(randomDelay(600, 1200));
          } catch {
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // ---------------------------------------------------------------
      // 5. Admin Compliance — review compliance status across users
      // ---------------------------------------------------------------
      {
        id: 'adm-05',
        name: 'Review compliance status',
        execute: async (page: Page) => {
          try {
            await page.goto('/admin/compliance', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await waitForPageContent(page);
            await page.waitForTimeout(randomDelay(800, 1500));

            // Browse compliance table/list
            await browseTablePage(page, 'Status');
            await page.waitForTimeout(randomDelay(500, 1000));

            // Click a user row to see their compliance detail
            if (maybe(0.6) && await clickRandomRow(page)) {
              await page.waitForTimeout(randomDelay(1000, 2000));
              await closeOverlay(page);
            }
          } catch {
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // ---------------------------------------------------------------
      // 6. Admin Events — browse/create events
      // ---------------------------------------------------------------
      {
        id: 'adm-06',
        name: 'Browse admin events',
        execute: async (page: Page) => {
          try {
            await page.goto('/admin/events', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await waitForPageContent(page);
            await page.waitForTimeout(randomDelay(800, 1500));

            await browseTablePage(page, 'Date');

            if (maybe(0.5) && await clickRandomRow(page)) {
              await page.waitForTimeout(randomDelay(1000, 2000));
              await closeOverlay(page);
            }
          } catch {
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // ---------------------------------------------------------------
      // 7. Admin Time Corrections — browse correction requests
      // ---------------------------------------------------------------
      {
        id: 'adm-07',
        name: 'Browse time correction requests',
        execute: async (page: Page) => {
          try {
            await page.goto('/admin/time-corrections', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await waitForPageContent(page);
            await page.waitForTimeout(randomDelay(800, 1500));
            await browseTablePage(page);
            await page.waitForTimeout(randomDelay(500, 1000));
          } catch {
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // ---------------------------------------------------------------
      // 8. Admin EDI — browse trading partners
      // ---------------------------------------------------------------
      {
        id: 'adm-08',
        name: 'Browse EDI trading partners',
        execute: async (page: Page) => {
          try {
            await page.goto('/admin/edi', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await waitForPageContent(page);
            await page.waitForTimeout(randomDelay(800, 1500));
            await browseTablePage(page);

            if (maybe(0.4) && await clickRandomRow(page)) {
              await page.waitForTimeout(randomDelay(1000, 2000));
              await closeOverlay(page);
            }
          } catch {
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // ---------------------------------------------------------------
      // 9. Admin AI Assistants — browse configured assistants
      // ---------------------------------------------------------------
      {
        id: 'adm-09',
        name: 'Browse AI assistants',
        execute: async (page: Page) => {
          try {
            await page.goto('/admin/ai-assistants', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await waitForPageContent(page);
            await page.waitForTimeout(randomDelay(800, 1500));
            await randomScroll(page);
            await page.waitForTimeout(randomDelay(600, 1200));

            if (maybe(0.5) && await clickRandomRow(page)) {
              await page.waitForTimeout(randomDelay(1000, 2000));
              await closeOverlay(page);
            }
          } catch {
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // ---------------------------------------------------------------
      // 10. Admin MFA — review MFA policy settings
      // ---------------------------------------------------------------
      {
        id: 'adm-10',
        name: 'Review MFA policy settings',
        execute: async (page: Page) => {
          try {
            await page.goto('/admin/mfa', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await waitForPageContent(page);
            await page.waitForTimeout(randomDelay(800, 1500));

            // Check that the policy save button exists (verify page loaded)
            const saveBtn = page.locator('[data-testid="mfa-save-policy"]');
            await saveBtn.waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT }).catch(() => {});
            await page.waitForTimeout(randomDelay(600, 1200));
            await randomScroll(page);
          } catch {
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // =================================================================
      // REGULAR FEATURES — admin reviews everything (steps 11-50)
      // =================================================================

      // ---------------------------------------------------------------
      // 11. CREATE JOB — star data-creation step
      // ---------------------------------------------------------------
      {
        id: 'adm-11',
        name: 'Create new job on kanban board',
        execute: async (page: Page) => {
          try {
            await page.goto('/kanban', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.locator('app-board-column, .board').first()
              .waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });
            await page.waitForTimeout(randomDelay(800, 1500));

            // Open new job dialog
            const newJobBtn = page.locator('[data-testid="new-job-btn"]');
            await newJobBtn.waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });
            await newJobBtn.click();
            await page.waitForTimeout(randomDelay(500, 1000));

            // Wait for dialog
            await page.locator('app-dialog .dialog').first()
              .waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });

            // Fill job form
            const jobTitle = testId('admin-job');
            await fillByTestId(page, 'job-title', jobTitle);
            await page.waitForTimeout(randomDelay(200, 500));

            // Fill description
            const descWrapper = page.locator('[data-testid="job-description"]');
            const descTextarea = descWrapper.locator('textarea').first();
            if (await descTextarea.isVisible({ timeout: 2000 }).catch(() => false)) {
              await descTextarea.click();
              await descTextarea.fill(randomPick(ADMIN_JOB_DESCRIPTIONS));
              await page.waitForTimeout(randomDelay(200, 400));
            }

            // Select track type
            await selectByTestId(page, 'job-track-type', randomPick(TRACK_TYPES));
            await page.waitForTimeout(randomDelay(200, 500));

            // Select customer (50% chance)
            if (maybe(0.5)) {
              try {
                await selectByTestId(page, 'job-customer', randomPick(CUSTOMERS));
              } catch { /* customer list may vary */ }
              await page.waitForTimeout(randomDelay(200, 400));
            }

            // Select priority
            await selectByTestId(page, 'job-priority', randomPick(PRIORITIES));
            await page.waitForTimeout(randomDelay(200, 500));

            // Fill due date
            await fillDateByTestId(page, 'job-due-date', randomDate(3, 21));
            await page.waitForTimeout(randomDelay(200, 500));

            // Click save via DOM click
            await page.waitForTimeout(1000);
            await page.evaluate(() => {
              const btn = document.querySelector('[data-testid="job-save-btn"]') as HTMLButtonElement;
              if (btn && !btn.disabled) btn.click();
            });
            await page.waitForTimeout(4000);
            await dismissSnackbar(page);
            await page.waitForTimeout(randomDelay(800, 1500));
          } catch {
            await page.keyboard.press('Escape');
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // ---------------------------------------------------------------
      // 12. Kanban — browse Production track
      // ---------------------------------------------------------------
      {
        id: 'adm-12',
        name: 'Browse Production kanban track',
        execute: async (page: Page) => {
          try {
            await page.goto('/kanban', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.locator('app-board-column, .board').first()
              .waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });
            await page.waitForTimeout(randomDelay(1000, 2000));

            // Click a card to view detail
            const card = page.locator('.kanban-card, .job-card').first();
            if (await card.isVisible({ timeout: 3000 }).catch(() => false)) {
              await card.click();
              await page.waitForTimeout(randomDelay(1000, 2000));
              await closeOverlay(page);
            }
          } catch {
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // ---------------------------------------------------------------
      // 13. Kanban — switch to Maintenance track
      // ---------------------------------------------------------------
      {
        id: 'adm-13',
        name: 'Browse Maintenance kanban track',
        execute: async (page: Page) => {
          try {
            // Switch track via tab or dropdown
            const trackTab = page.locator('.tab, [role="tab"], button').filter({ hasText: /Maintenance/i }).first();
            if (await trackTab.isVisible({ timeout: 3000 }).catch(() => false)) {
              await trackTab.click();
              await page.waitForTimeout(randomDelay(1000, 2000));
            } else {
              // Try select-based track switcher
              const trackSelect = page.locator('mat-select, app-select').first();
              if (await trackSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
                await trackSelect.click();
                await page.waitForTimeout(randomDelay(300, 500));
                const option = page.locator('.cdk-overlay-container mat-option', { hasText: 'Maintenance' }).first();
                if (await option.isVisible({ timeout: 2000 }).catch(() => false)) {
                  await option.click();
                  await page.waitForTimeout(randomDelay(1000, 2000));
                }
              }
            }
            await randomScroll(page);
          } catch {
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // ---------------------------------------------------------------
      // 14. Backlog — browse and sort by priority
      // ---------------------------------------------------------------
      {
        id: 'adm-14',
        name: 'Browse backlog sorted by priority',
        execute: async (page: Page) => {
          try {
            await page.goto('/backlog', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForTimeout(randomDelay(800, 1500));
            await browseTablePage(page, 'Priority');

            if (maybe(0.5) && await clickRandomRow(page)) {
              await page.waitForTimeout(randomDelay(1000, 2000));
              await closeOverlay(page);
            }
          } catch {
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // ---------------------------------------------------------------
      // 15. Parts — browse catalog
      // ---------------------------------------------------------------
      {
        id: 'adm-15',
        name: 'Browse parts catalog',
        execute: async (page: Page) => {
          try {
            await page.goto('/parts', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForTimeout(randomDelay(800, 1500));
            await browseTablePage(page, 'Part');

            if (maybe(0.4) && await clickRandomRow(page)) {
              await page.waitForTimeout(randomDelay(1000, 2000));
              await closeOverlay(page);
            }
          } catch {
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // ---------------------------------------------------------------
      // 16. Inventory — stock tab
      // ---------------------------------------------------------------
      {
        id: 'adm-16',
        name: 'Browse inventory stock levels',
        execute: async (page: Page) => {
          try {
            await page.goto('/inventory/stock', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForTimeout(randomDelay(800, 1500));
            await browseTablePage(page);
            await page.waitForTimeout(randomDelay(500, 1000));
          } catch {
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // ---------------------------------------------------------------
      // 17. Inventory — receiving tab
      // ---------------------------------------------------------------
      {
        id: 'adm-17',
        name: 'Check inventory receiving',
        execute: async (page: Page) => {
          try {
            await page.goto('/inventory/receiving', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForTimeout(randomDelay(800, 1500));
            await browseTablePage(page);
          } catch {
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // ---------------------------------------------------------------
      // 18. Inventory — locations tab
      // ---------------------------------------------------------------
      {
        id: 'adm-18',
        name: 'Review inventory locations',
        execute: async (page: Page) => {
          try {
            await page.goto('/inventory/locations', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForTimeout(randomDelay(800, 1500));
            await browseTablePage(page, 'Name');
          } catch {
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // ---------------------------------------------------------------
      // 19. Quality — inspections tab
      // ---------------------------------------------------------------
      {
        id: 'adm-19',
        name: 'Browse quality inspections',
        execute: async (page: Page) => {
          try {
            await page.goto('/quality/inspections', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForTimeout(randomDelay(800, 1500));
            await browseTablePage(page);

            if (maybe(0.4) && await clickRandomRow(page)) {
              await page.waitForTimeout(randomDelay(1000, 2000));
              await closeOverlay(page);
            }
          } catch {
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // ---------------------------------------------------------------
      // 20. Quality — lots tab
      // ---------------------------------------------------------------
      {
        id: 'adm-20',
        name: 'Browse quality lots',
        execute: async (page: Page) => {
          try {
            await page.goto('/quality/lots', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForTimeout(randomDelay(800, 1500));
            await browseTablePage(page);
          } catch {
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // ---------------------------------------------------------------
      // 21. Quality — gages tab
      // ---------------------------------------------------------------
      {
        id: 'adm-21',
        name: 'Browse quality gages',
        execute: async (page: Page) => {
          try {
            await page.goto('/quality/gages', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForTimeout(randomDelay(800, 1500));
            await browseTablePage(page);
          } catch {
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // ---------------------------------------------------------------
      // 22. Customers — browse customer list
      // ---------------------------------------------------------------
      {
        id: 'adm-22',
        name: 'Browse customer list',
        execute: async (page: Page) => {
          try {
            await page.goto('/customers', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForTimeout(randomDelay(800, 1500));
            await browseTablePage(page, 'Name');

            if (maybe(0.5) && await clickRandomRow(page)) {
              await page.waitForTimeout(randomDelay(1000, 2000));
              // Customer detail is a full page, go back
              await page.goBack({ timeout: NAV_TIMEOUT }).catch(() => {});
              await page.waitForTimeout(randomDelay(500, 1000));
            }
          } catch {
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // ---------------------------------------------------------------
      // 23. Leads — browse lead pipeline
      // ---------------------------------------------------------------
      {
        id: 'adm-23',
        name: 'Browse lead pipeline',
        execute: async (page: Page) => {
          try {
            await page.goto('/leads', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForTimeout(randomDelay(800, 1500));
            await browseTablePage(page, 'Status');

            if (maybe(0.4) && await clickRandomRow(page)) {
              await page.waitForTimeout(randomDelay(1000, 2000));
              await closeOverlay(page);
            }
          } catch {
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // ---------------------------------------------------------------
      // 24. Vendors — browse vendor list
      // ---------------------------------------------------------------
      {
        id: 'adm-24',
        name: 'Browse vendor list',
        execute: async (page: Page) => {
          try {
            await page.goto('/vendors', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForTimeout(randomDelay(800, 1500));
            await browseTablePage(page, 'Name');

            if (maybe(0.4) && await clickRandomRow(page)) {
              await page.waitForTimeout(randomDelay(1000, 2000));
              await closeOverlay(page);
            }
          } catch {
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // ---------------------------------------------------------------
      // 25. Purchase Orders — browse POs
      // ---------------------------------------------------------------
      {
        id: 'adm-25',
        name: 'Browse purchase orders',
        execute: async (page: Page) => {
          try {
            await page.goto('/purchase-orders', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForTimeout(randomDelay(800, 1500));
            await browseTablePage(page, 'Date');

            if (maybe(0.4) && await clickRandomRow(page)) {
              await page.waitForTimeout(randomDelay(1000, 2000));
              await closeOverlay(page);
            }
          } catch {
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // ---------------------------------------------------------------
      // 26. Sales Orders — browse SOs
      // ---------------------------------------------------------------
      {
        id: 'adm-26',
        name: 'Browse sales orders',
        execute: async (page: Page) => {
          try {
            await page.goto('/sales-orders', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForTimeout(randomDelay(800, 1500));
            await browseTablePage(page, 'Date');

            if (maybe(0.4) && await clickRandomRow(page)) {
              await page.waitForTimeout(randomDelay(1000, 2000));
              await closeOverlay(page);
            }
          } catch {
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // ---------------------------------------------------------------
      // 27. Quotes — browse quotes
      // ---------------------------------------------------------------
      {
        id: 'adm-27',
        name: 'Browse quotes',
        execute: async (page: Page) => {
          try {
            await page.goto('/quotes', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForTimeout(randomDelay(800, 1500));
            await browseTablePage(page, 'Status');

            if (maybe(0.4) && await clickRandomRow(page)) {
              await page.waitForTimeout(randomDelay(1000, 2000));
              await closeOverlay(page);
            }
          } catch {
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // ---------------------------------------------------------------
      // 28. Invoices — browse invoices
      // ---------------------------------------------------------------
      {
        id: 'adm-28',
        name: 'Browse invoices',
        execute: async (page: Page) => {
          try {
            await page.goto('/invoices', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForTimeout(randomDelay(800, 1500));
            await browseTablePage(page, 'Date');

            if (maybe(0.4) && await clickRandomRow(page)) {
              await page.waitForTimeout(randomDelay(1000, 2000));
              await closeOverlay(page);
            }
          } catch {
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // ---------------------------------------------------------------
      // 29. Payments — browse payments
      // ---------------------------------------------------------------
      {
        id: 'adm-29',
        name: 'Browse payments',
        execute: async (page: Page) => {
          try {
            await page.goto('/payments', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForTimeout(randomDelay(800, 1500));
            await browseTablePage(page, 'Date');
          } catch {
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // ---------------------------------------------------------------
      // 30. Shipments — browse shipments
      // ---------------------------------------------------------------
      {
        id: 'adm-30',
        name: 'Browse shipments',
        execute: async (page: Page) => {
          try {
            await page.goto('/shipments', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForTimeout(randomDelay(800, 1500));
            await browseTablePage(page, 'Status');

            if (maybe(0.4) && await clickRandomRow(page)) {
              await page.waitForTimeout(randomDelay(1000, 2000));
              await closeOverlay(page);
            }
          } catch {
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // ---------------------------------------------------------------
      // 31. Customer Returns — browse returns
      // ---------------------------------------------------------------
      {
        id: 'adm-31',
        name: 'Browse customer returns',
        execute: async (page: Page) => {
          try {
            await page.goto('/customer-returns', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForTimeout(randomDelay(800, 1500));
            await browseTablePage(page);
          } catch {
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // ---------------------------------------------------------------
      // 32. Purchasing/RFQ — browse RFQs
      // ---------------------------------------------------------------
      {
        id: 'adm-32',
        name: 'Browse RFQs',
        execute: async (page: Page) => {
          try {
            await page.goto('/purchasing', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForTimeout(randomDelay(800, 1500));
            await browseTablePage(page);

            if (maybe(0.4) && await clickRandomRow(page)) {
              await page.waitForTimeout(randomDelay(1000, 2000));
              await closeOverlay(page);
            }
          } catch {
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // ---------------------------------------------------------------
      // 33. Reports — view "Jobs by Stage" then "Team Workload"
      // ---------------------------------------------------------------
      {
        id: 'adm-33',
        name: 'View reports — Jobs by Stage and Team Workload',
        execute: async (page: Page) => {
          try {
            await page.goto('/reports', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.locator('app-data-table, .report-card, .report-list, .page-content').first()
              .waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });
            await page.waitForTimeout(randomDelay(800, 1500));

            // Click "Jobs by Stage" report
            const jobsByStage = page.locator('app-data-table tbody tr, .report-card, mat-card')
              .filter({ hasText: /jobs.*stage/i }).first();
            if (await jobsByStage.isVisible({ timeout: 3000 }).catch(() => false)) {
              await jobsByStage.click();
              await page.waitForTimeout(randomDelay(1500, 3000));
              await randomScroll(page);
              await page.waitForTimeout(randomDelay(800, 1500));
              // Go back to report list
              await page.goBack({ timeout: NAV_TIMEOUT }).catch(() => {});
              await page.waitForTimeout(randomDelay(500, 1000));
            }

            // Click "Team Workload" report
            const teamWorkload = page.locator('app-data-table tbody tr, .report-card, mat-card')
              .filter({ hasText: /team.*workload/i }).first();
            if (await teamWorkload.isVisible({ timeout: 3000 }).catch(() => false)) {
              await teamWorkload.click();
              await page.waitForTimeout(randomDelay(1500, 3000));
              await randomScroll(page);
              await page.waitForTimeout(randomDelay(800, 1500));
            }
          } catch {
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // ---------------------------------------------------------------
      // 34. MRP — browse MRP dashboard
      // ---------------------------------------------------------------
      {
        id: 'adm-34',
        name: 'Browse MRP dashboard',
        execute: async (page: Page) => {
          try {
            await page.goto('/mrp', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await waitForPageContent(page);
            await page.waitForTimeout(randomDelay(1000, 2000));
            await randomScroll(page);
            await page.waitForTimeout(randomDelay(600, 1200));
          } catch {
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // ---------------------------------------------------------------
      // 35. Scheduling — browse schedule
      // ---------------------------------------------------------------
      {
        id: 'adm-35',
        name: 'Browse scheduling',
        execute: async (page: Page) => {
          try {
            await page.goto('/scheduling', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await waitForPageContent(page);
            await page.waitForTimeout(randomDelay(1000, 2000));
            await randomScroll(page);
          } catch {
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // ---------------------------------------------------------------
      // 36. OEE — browse OEE metrics
      // ---------------------------------------------------------------
      {
        id: 'adm-36',
        name: 'Browse OEE metrics',
        execute: async (page: Page) => {
          try {
            await page.goto('/oee', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await waitForPageContent(page);
            await page.waitForTimeout(randomDelay(1000, 2000));
            await randomScroll(page);
          } catch {
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // ---------------------------------------------------------------
      // 37. Approvals — check pending approvals
      // ---------------------------------------------------------------
      {
        id: 'adm-37',
        name: 'Check pending approvals',
        execute: async (page: Page) => {
          try {
            await page.goto('/approvals', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await waitForPageContent(page);
            await page.waitForTimeout(randomDelay(800, 1500));
            await browseTablePage(page);
          } catch {
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // ---------------------------------------------------------------
      // 38. Training — browse modules + admin panel
      // ---------------------------------------------------------------
      {
        id: 'adm-38',
        name: 'Browse training modules and admin panel',
        execute: async (page: Page) => {
          try {
            await page.goto('/training', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.locator('app-data-table, .training-module, .module-card, .page-content').first()
              .waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });
            await page.waitForTimeout(randomDelay(800, 1500));

            // Switch to Admin tab if available
            await switchTab(page, /admin/i);
            await page.waitForTimeout(randomDelay(600, 1200));
            await randomScroll(page);

            // Click a module to view details
            if (maybe(0.5) && await clickRandomRow(page)) {
              await page.waitForTimeout(randomDelay(1000, 2000));
              await closeOverlay(page);
            }
          } catch {
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // ---------------------------------------------------------------
      // 39. Chat — send admin announcement
      // ---------------------------------------------------------------
      {
        id: 'adm-39',
        name: 'Send admin announcement in chat',
        execute: async (page: Page) => {
          try {
            await page.goto('/chat', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.locator('.chat-room, .chat-list, .chat-container, .page-content').first()
              .waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });
            await page.waitForTimeout(randomDelay(800, 1500));

            // Select first chat room
            const rooms = page.locator('.chat-room-item, .room-list-item, .chat-room');
            const roomCount = await rooms.count();
            if (roomCount > 0) {
              await rooms.first().click({ timeout: ELEMENT_TIMEOUT });
              await page.waitForTimeout(randomDelay(500, 1000));
            }

            // Type and send message
            const chatInput = page.locator('[data-testid="chat-message-input"]').first();
            if (await chatInput.isVisible({ timeout: 3000 }).catch(() => false)) {
              const message = randomPick(ADMIN_CHAT_MESSAGES);
              await chatInput.click();
              await chatInput.fill(message);
              await page.waitForTimeout(randomDelay(300, 600));

              const sendBtn = page.locator('[data-testid="chat-send-btn"]').first();
              if (await sendBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                await sendBtn.click({ timeout: ELEMENT_TIMEOUT });
              } else {
                await chatInput.press('Enter');
              }
              await page.waitForTimeout(randomDelay(500, 1000));
            }
          } catch {
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // ---------------------------------------------------------------
      // 40. Time tracking — create manual entry (Administrative)
      // ---------------------------------------------------------------
      {
        id: 'adm-40',
        name: 'Create manual time entry — Administrative',
        execute: async (page: Page) => {
          try {
            await page.goto('/time-tracking', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await waitForPageContent(page);
            await page.waitForTimeout(randomDelay(800, 1500));

            // Click manual entry button
            const manualBtn = page.locator('[data-testid="manual-entry-btn"]');
            await manualBtn.waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });
            await manualBtn.click();
            await page.waitForTimeout(randomDelay(500, 1000));

            // Wait for dialog
            await page.locator('app-dialog .dialog').first()
              .waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });

            // Fill date
            await fillDateByTestId(page, 'time-entry-date', randomDate(-2, 3));
            await page.waitForTimeout(randomDelay(200, 400));

            // Select category
            await selectByTestId(page, 'time-entry-category', 'Administrative');
            await page.waitForTimeout(randomDelay(200, 400));

            // Fill hours
            const hours = randomInt(1, 3);
            await fillByTestId(page, 'time-entry-hours', String(hours));
            await page.waitForTimeout(randomDelay(100, 300));

            // Fill minutes
            const minutes = randomPick(['0', '15', '30', '45']);
            await fillByTestId(page, 'time-entry-minutes', minutes);
            await page.waitForTimeout(randomDelay(100, 300));

            // Fill notes
            const notesWrapper = page.locator('[data-testid="time-entry-notes"]');
            const notesInput = notesWrapper.locator('textarea, input').first();
            if (await notesInput.isVisible({ timeout: 2000 }).catch(() => false)) {
              await notesInput.click();
              await notesInput.fill(randomPick(TIME_ENTRY_NOTES));
              await page.waitForTimeout(randomDelay(200, 400));
            }

            // Save via DOM click
            await page.waitForTimeout(1000);
            await page.evaluate(() => {
              const btn = document.querySelector('[data-testid="time-entry-save-btn"]') as HTMLButtonElement;
              if (btn && !btn.disabled) btn.click();
            });
            await page.waitForTimeout(3000);
            await dismissSnackbar(page);
            await page.waitForTimeout(randomDelay(500, 1000));
          } catch {
            await page.keyboard.press('Escape');
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // ---------------------------------------------------------------
      // 41. Expenses — create admin expense
      // ---------------------------------------------------------------
      {
        id: 'adm-41',
        name: 'Create admin expense',
        execute: async (page: Page) => {
          try {
            await page.goto('/expenses', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await waitForPageContent(page);
            await page.waitForTimeout(randomDelay(800, 1500));

            // Click new expense button
            const newBtn = page.locator('[data-testid="new-expense-btn"]');
            await newBtn.waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });
            await newBtn.click();
            await page.waitForTimeout(randomDelay(500, 1000));

            // Wait for dialog
            await page.locator('app-dialog .dialog').first()
              .waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });

            // Fill amount
            const amount = randomAmount(50, 800);
            await fillByTestId(page, 'expense-amount', amount);
            await page.waitForTimeout(randomDelay(200, 400));

            // Fill date
            await fillDateByTestId(page, 'expense-date', randomDate(-7, 7));
            await page.waitForTimeout(randomDelay(200, 400));

            // Select category
            await selectByTestId(page, 'expense-category', randomPick(EXPENSE_CATEGORIES));
            await page.waitForTimeout(randomDelay(200, 400));

            // Fill description
            const descWrapper = page.locator('[data-testid="expense-description"]');
            const descInput = descWrapper.locator('textarea, input').first();
            if (await descInput.isVisible({ timeout: 2000 }).catch(() => false)) {
              await descInput.click();
              await descInput.fill(randomPick(EXPENSE_DESCRIPTIONS));
              await page.waitForTimeout(randomDelay(200, 400));
            }

            // Save via DOM click
            await page.waitForTimeout(1000);
            await page.evaluate(() => {
              const btn = document.querySelector('[data-testid="expense-save-btn"]') as HTMLButtonElement;
              if (btn && !btn.disabled) btn.click();
            });
            await page.waitForTimeout(3000);
            await dismissSnackbar(page);
            await page.waitForTimeout(randomDelay(500, 1000));
          } catch {
            await page.keyboard.press('Escape');
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // ---------------------------------------------------------------
      // 42. Planning — review planning cycle
      // ---------------------------------------------------------------
      {
        id: 'adm-42',
        name: 'Review planning cycle',
        execute: async (page: Page) => {
          try {
            await page.goto('/planning', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await waitForPageContent(page);
            await page.waitForTimeout(randomDelay(1000, 2000));
            await randomScroll(page);
            await page.waitForTimeout(randomDelay(600, 1200));
          } catch {
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // ---------------------------------------------------------------
      // 43. Calendar — check schedule
      // ---------------------------------------------------------------
      {
        id: 'adm-43',
        name: 'Check calendar schedule',
        execute: async (page: Page) => {
          try {
            await page.goto('/calendar', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await waitForPageContent(page);
            await page.waitForTimeout(randomDelay(1000, 2000));

            // Click a calendar event if visible
            const event = page.locator('.fc-event, .calendar-event, mat-card').first();
            if (await event.isVisible({ timeout: 3000 }).catch(() => false)) {
              await event.click();
              await page.waitForTimeout(randomDelay(800, 1500));
              await closeOverlay(page);
            }
          } catch {
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // ---------------------------------------------------------------
      // 44. AI — quick question to AI assistant
      // ---------------------------------------------------------------
      {
        id: 'adm-44',
        name: 'Ask AI assistant a question',
        execute: async (page: Page) => {
          try {
            await page.goto('/ai', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await waitForPageContent(page);
            await page.waitForTimeout(randomDelay(800, 1500));

            // Find the AI input and ask a question
            const aiInput = page.locator('textarea, input[type="text"]').last();
            if (await aiInput.isVisible({ timeout: 3000 }).catch(() => false)) {
              await aiInput.click();
              await aiInput.fill('What are the most overdue jobs on the board right now?');
              await page.waitForTimeout(randomDelay(300, 600));

              // Submit via Enter or button
              const submitBtn = page.locator('button').filter({ hasText: /send|ask|submit/i }).first();
              if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                await submitBtn.click();
              } else {
                await aiInput.press('Enter');
              }
              await page.waitForTimeout(randomDelay(2000, 4000));
            }
          } catch {
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // ---------------------------------------------------------------
      // 45. Lots — browse lot records
      // ---------------------------------------------------------------
      {
        id: 'adm-45',
        name: 'Browse lot records',
        execute: async (page: Page) => {
          try {
            await page.goto('/quality/lots', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForTimeout(randomDelay(800, 1500));
            await browseTablePage(page);

            if (maybe(0.4) && await clickRandomRow(page)) {
              await page.waitForTimeout(randomDelay(1000, 2000));
              await closeOverlay(page);
            }
          } catch {
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // ---------------------------------------------------------------
      // 46. Assets — browse asset list
      // ---------------------------------------------------------------
      {
        id: 'adm-46',
        name: 'Browse assets',
        execute: async (page: Page) => {
          try {
            await page.goto('/assets', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForTimeout(randomDelay(800, 1500));
            await browseTablePage(page, 'Name');

            if (maybe(0.4) && await clickRandomRow(page)) {
              await page.waitForTimeout(randomDelay(1000, 2000));
              await closeOverlay(page);
            }
          } catch {
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // ---------------------------------------------------------------
      // 47. Events — check upcoming events
      // ---------------------------------------------------------------
      {
        id: 'adm-47',
        name: 'Check upcoming events',
        execute: async (page: Page) => {
          try {
            await page.goto('/admin/events', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await waitForPageContent(page);
            await page.waitForTimeout(randomDelay(800, 1500));
            await browseTablePage(page, 'Date');
          } catch {
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // ---------------------------------------------------------------
      // 48. Notifications — check notification panel
      // ---------------------------------------------------------------
      {
        id: 'adm-48',
        name: 'Check notifications',
        execute: async (page: Page) => {
          try {
            const bellBtn = page.locator(
              'button[aria-label*="notification" i], button[aria-label*="Notification"]',
            ).first();

            if (await bellBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
              await bellBtn.click({ timeout: ELEMENT_TIMEOUT });
              await page.waitForTimeout(randomDelay(800, 1500));

              const panel = page.locator('.notification-panel, app-notification-panel').first();
              if (await panel.isVisible({ timeout: 2000 }).catch(() => false)) {
                await randomScroll(page);
                await page.waitForTimeout(randomDelay(600, 1200));

                // Mark all read if button available
                if (maybe(0.4)) {
                  const markAllBtn = page.locator('button', { hasText: /mark.*read/i }).first();
                  if (await markAllBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
                    await markAllBtn.click({ timeout: ELEMENT_TIMEOUT });
                    await page.waitForTimeout(randomDelay(400, 800));
                  }
                }
              }

              await closeOverlay(page);
            }
          } catch {
            await page.keyboard.press('Escape');
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // ---------------------------------------------------------------
      // 49. Account — review profile
      // ---------------------------------------------------------------
      {
        id: 'adm-49',
        name: 'Review account profile',
        execute: async (page: Page) => {
          try {
            await page.goto('/account', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await waitForPageContent(page);
            await page.waitForTimeout(randomDelay(1000, 2000));

            // Browse profile tabs if available
            await switchTab(page, /security/i);
            await page.waitForTimeout(randomDelay(600, 1200));

            await switchTab(page, /customization/i);
            await page.waitForTimeout(randomDelay(600, 1200));
          } catch {
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // ---------------------------------------------------------------
      // 50. Return to dashboard — end of admin shift
      // ---------------------------------------------------------------
      {
        id: 'adm-50',
        name: 'Return to dashboard — shift complete',
        execute: async (page: Page) => {
          try {
            await page.goto('/dashboard', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.locator('app-dashboard-widget, app-kpi-chip, .dashboard-widget').first()
              .waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });
            await page.waitForTimeout(randomDelay(1000, 2000));
            await randomScroll(page);
            await page.waitForTimeout(randomDelay(800, 1500));
          } catch {
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },
    ],
  };
}
