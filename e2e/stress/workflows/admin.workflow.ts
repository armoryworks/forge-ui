import type { Page } from 'playwright';
import type { Workflow } from '../orchestrator';
import { fillByTestId, selectByTestId, fillDateByTestId, clickByTestId, fillEntityPickerByTestId } from '../../lib/form.lib';
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

// Must match seed data in SeedData.Essential.cs (expense_category group)
const EXPENSE_CATEGORIES = ['Office Supplies', 'Equipment', 'Travel', 'Other', 'Maintenance'];

const EXPENSE_DESCRIPTIONS = [
  'Annual software license renewal — ERP system',
  'Office printer paper and toner — quarterly restock',
  'Cloud hosting infrastructure bill — April',
  'Conference registration fee — manufacturing summit',
  'Network equipment maintenance contract',
  'Safety supplies restock — PPE, signage, first aid',
];

const EVENT_TITLES = ['Safety standup', 'Production review', 'Quality audit', 'Maintenance planning', 'Team huddle'];
const EVENT_TYPES = ['Meeting', 'Training', 'Safety'];
const EVENT_DESCRIPTIONS = [
  'Weekly sync to review production metrics and blockers',
  'Mandatory safety refresher for all shop floor personnel',
  'Cross-functional planning for next quarter tooling upgrades',
  'Quality audit walkthrough — ISO 9001 readiness check',
  'Morning huddle to align on daily priorities',
];

const INSPECTION_NOTES = [
  'Visual inspection — no defects found on batch',
  'Dimensional check using CMM, all within tolerance',
  'Surface finish roughness exceeds spec — flagged for rework',
  'First-article inspection passed — cleared for production run',
  'In-process sampling — thread pitch verified with go/no-go gauge',
];

const LOT_NOTES = [
  'Production lot for customer order — standard material cert required',
  'Incoming material lot — vendor cert on file, pending QC check',
  'Rework lot — reprocessed after initial QC rejection',
  'Prototype lot — limited quantity for engineering validation',
  'Rush lot — expedited for priority customer shipment',
];

const ASSET_NAMES = ['VMC-08 Haas', 'Bridgeport Mill #3', 'CNC Lathe ST-20', 'Surface Grinder SG-12', 'EDM Sinker #2'];
const ASSET_TYPES = ['Machine', 'Tooling', 'Facility'];
const ASSET_LOCATIONS = ['Bay 1', 'Bay 2', 'Tool Crib', 'QC Lab', 'Assembly Area'];
const ASSET_MANUFACTURERS = ['Haas', 'Mazak', 'DMG Mori', 'Okuma'];
const ASSET_NOTES = [
  'Newly commissioned — requires initial calibration verification',
  'Transferred from secondary facility — needs updated asset tag',
  'Preventive maintenance schedule: quarterly spindle check',
  'Operator training required before first use',
  'Retrofitted with new controller firmware — version logged',
];

const VENDOR_COMPANIES = ['Allied Steel Supply', 'Pacific Components', 'Global Fasteners Inc', 'Premier Coatings LLC'];
const VENDOR_CONTACTS = ['Mike Sullivan', 'Lisa Park', 'Tom Richards'];
const VENDOR_PHONES = ['(555) 234-5678', '(555) 345-6789', '(555) 456-7890', '(555) 567-8901'];

const CUSTOMER_NAMES = ['Atlas Defense', 'Pinnacle Medical', 'Sterling Aerospace', 'Nova Electronics'];
const CUSTOMER_PHONES = ['(555) 678-9012', '(555) 789-0123', '(555) 890-1234', '(555) 901-2345'];

const PART_TYPES = ['Component', 'Assembly', 'Raw Material'];
const PART_DESCRIPTIONS = ['Precision bearing housing', 'CNC machined bracket', 'Aluminum mounting plate', 'Stainless dowel pin'];
const PART_MATERIALS = ['6061-T6 Aluminum', '304 Stainless Steel', '4140 Steel', 'Delrin'];

const ECO_TITLES = ['Update bracket dimensions per Rev. C', 'Material change: 303 to 304 SS', 'Add chamfer to bore edge'];
const ECO_CHANGE_TYPES = ['Design', 'Material', 'Process'];
const ECO_PRIORITIES = ['Normal', 'High'];
const ECO_DESCRIPTIONS = [
  'Customer requested tighter tolerance on bore diameter — updated to +/- 0.001',
  'Switching supplier requires material substitution — functionally equivalent per eng. review',
  'Adding 0.5mm chamfer to eliminate burr formation during assembly',
];
const ECO_REASONS = [
  'Customer feedback — field failure analysis traced to dimension drift',
  'Supply chain disruption — current material unavailable for 12 weeks',
  'Assembly line improvement — reduces manual deburring step by 3 minutes per unit',
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
        category: 'browse',
        tags: ['dashboard'],
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

      // =================================================================
      // REGULAR FEATURES — admin reviews everything (steps 11-50)
      // =================================================================

      // ---------------------------------------------------------------
      // 2. CREATE JOB — star data-creation step
      // ---------------------------------------------------------------
      {
        id: 'adm-02',  // originally adm-11
        name: 'Create new job on kanban board',
        category: 'create',
        tags: ['kanban'],
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
            const jobSaveDisabled = await page.evaluate(() => {
              const btn = document.querySelector('[data-testid="job-save-btn"]') as HTMLButtonElement;
              if (btn && !btn.disabled) { btn.click(); return false; }
              return true;
            });
            if (jobSaveDisabled) {
              console.log('[admin] adm-02 save button disabled — form invalid, skipping');
            } else {
              await page.waitForTimeout(4000);
              return 'job';
            }
            await dismissSnackbar(page);
            await page.waitForTimeout(randomDelay(800, 1500));
          } catch {
            await page.keyboard.press('Escape');
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // ---------------------------------------------------------------
      // 3. Time tracking — create manual entry (Administrative)
      // ---------------------------------------------------------------
      {
        id: 'adm-03',  // originally adm-40
        name: 'Create manual time entry — Administrative',
        category: 'create',
        tags: ['time-tracking'],
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
            await selectByTestId(page, 'time-entry-category', 'Admin');
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
            const admTimeSaveDisabled = await page.evaluate(() => {
              const btn = document.querySelector('[data-testid="time-entry-save-btn"]') as HTMLButtonElement;
              if (btn && !btn.disabled) { btn.click(); return false; }
              return true;
            });
            if (admTimeSaveDisabled) {
              console.log('[admin] adm-03 save button disabled — form invalid, skipping');
            } else {
              await page.waitForTimeout(3000);
              return 'time-entry';
            }
            await dismissSnackbar(page);
            await page.waitForTimeout(randomDelay(500, 1000));
          } catch {
            await page.keyboard.press('Escape');
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // ---------------------------------------------------------------
      // 4. Expenses — create admin expense
      // ---------------------------------------------------------------
      {
        id: 'adm-04',  // originally adm-41
        name: 'Create admin expense',
        category: 'create',
        tags: ['expenses'],
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
            const admExpSaveDisabled = await page.evaluate(() => {
              const btn = document.querySelector('[data-testid="expense-save-btn"]') as HTMLButtonElement;
              if (btn && !btn.disabled) { btn.click(); return false; }
              return true;
            });
            if (admExpSaveDisabled) {
              console.log('[admin] adm-04 save button disabled — form invalid, skipping');
            } else {
              await page.waitForTimeout(3000);
              return 'expense';
            }
            await dismissSnackbar(page);
            await page.waitForTimeout(randomDelay(500, 1000));
          } catch {
            await page.keyboard.press('Escape');
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // ---------------------------------------------------------------
      // 5. Admin Users — browse user list, sort, click detail
      // ---------------------------------------------------------------
      {
        id: 'adm-05',  // originally adm-02
        name: 'Browse admin user list',
        category: 'admin',
        tags: ['users'],
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
      // 6. Admin Settings — review company profile, scroll to locations
      // ---------------------------------------------------------------
      {
        id: 'adm-06',  // originally adm-03
        name: 'Review company settings and locations',
        category: 'admin',
        tags: ['settings'],
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
      // 7. Admin Integrations — review integration status
      // ---------------------------------------------------------------
      {
        id: 'adm-07',  // originally adm-04
        name: 'Review integration status',
        category: 'admin',
        tags: ['admin'],
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
      // 8. Admin Compliance — review compliance status across users
      // ---------------------------------------------------------------
      {
        id: 'adm-08',  // originally adm-05
        name: 'Review compliance status',
        category: 'admin',
        tags: ['admin'],
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
      // 9. Admin Events — create an event
      // ---------------------------------------------------------------
      {
        id: 'adm-09',  // originally adm-06
        name: 'Create an admin event',
        category: 'create',
        tags: ['events'],
        execute: async (page: Page) => {
          try {
            await page.goto('/admin/events', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await waitForPageContent(page);
            await page.waitForTimeout(randomDelay(800, 1500));

            // Open new event dialog
            await clickByTestId(page, 'new-event-btn');
            await page.waitForTimeout(randomDelay(500, 1000));

            // Wait for dialog
            await page.locator('app-dialog .dialog').first()
              .waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });

            const todayStr = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });

            // Fill event form
            await fillByTestId(page, 'event-title', randomPick(EVENT_TITLES));
            await page.waitForTimeout(randomDelay(200, 500));

            await selectByTestId(page, 'event-type', randomPick(EVENT_TYPES));
            await page.waitForTimeout(randomDelay(200, 400));

            await fillDateByTestId(page, 'event-start-date', todayStr);
            await page.waitForTimeout(randomDelay(200, 400));

            await fillByTestId(page, 'event-start-time', '09:00');
            await page.waitForTimeout(randomDelay(200, 400));

            await fillDateByTestId(page, 'event-end-date', todayStr);
            await page.waitForTimeout(randomDelay(200, 400));

            await fillByTestId(page, 'event-end-time', '10:00');
            await page.waitForTimeout(randomDelay(200, 400));

            const descWrapper = page.locator('[data-testid="event-description"]');
            const descInput = descWrapper.locator('textarea, input').first();
            if (await descInput.isVisible({ timeout: 2000 }).catch(() => false)) {
              await descInput.click();
              await descInput.fill(randomPick(EVENT_DESCRIPTIONS));
              await page.waitForTimeout(randomDelay(200, 400));
            }

            // Save via DOM click
            await page.waitForTimeout(1000);
            const saveDisabled = await page.evaluate(() => {
              const btn = document.querySelector('[data-testid="event-save-btn"]') as HTMLButtonElement;
              if (btn && !btn.disabled) { btn.click(); return false; }
              return true;
            });
            if (saveDisabled) {
              console.log('[admin] adm-09 save button disabled — form invalid, skipping');
            } else {
              await waitForAnySnackbar(page);
              await dismissSnackbar(page);
              await page.waitForTimeout(randomDelay(500, 1000));
              return 'event';
            }
          } catch {
            await page.keyboard.press('Escape');
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // ---------------------------------------------------------------
      // 10. Admin Time Corrections — browse correction requests
      // ---------------------------------------------------------------
      {
        id: 'adm-10',  // originally adm-07
        name: 'Browse time correction requests',
        category: 'admin',
        tags: ['time-tracking'],
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
      // 11. Admin EDI — browse trading partners
      // ---------------------------------------------------------------
      {
        id: 'adm-11',  // originally adm-08
        name: 'Browse EDI trading partners',
        category: 'admin',
        tags: ['admin'],
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
      // 12. Admin AI Assistants — browse configured assistants
      // ---------------------------------------------------------------
      {
        id: 'adm-12',  // originally adm-09
        name: 'Browse AI assistants',
        category: 'admin',
        tags: ['admin'],
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
      // 13. Admin MFA — review MFA policy settings
      // ---------------------------------------------------------------
      {
        id: 'adm-13',  // originally adm-10
        name: 'Review MFA policy settings',
        category: 'admin',
        tags: ['admin'],
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

      // ---------------------------------------------------------------
      // 14. Kanban — browse Production track
      // ---------------------------------------------------------------
      {
        id: 'adm-14',  // originally adm-12
        name: 'Browse Production kanban track',
        category: 'browse',
        tags: ['kanban'],
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
      // 15. Kanban — switch to Maintenance track
      // ---------------------------------------------------------------
      {
        id: 'adm-15',  // originally adm-13
        name: 'Browse Maintenance kanban track',
        category: 'browse',
        tags: ['kanban'],
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
      // 16. Backlog — browse and sort by priority
      // ---------------------------------------------------------------
      {
        id: 'adm-16',  // originally adm-14
        name: 'Browse backlog sorted by priority',
        category: 'browse',
        tags: ['backlog'],
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
      // 17. Parts — browse catalog
      // ---------------------------------------------------------------
      {
        id: 'adm-17',  // originally adm-15
        name: 'Browse parts catalog',
        category: 'browse',
        tags: ['parts'],
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
      // 18. Inventory — stock tab
      // ---------------------------------------------------------------
      {
        id: 'adm-18',  // originally adm-16
        name: 'Browse inventory stock levels',
        category: 'browse',
        tags: ['inventory'],
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
      // 19. Inventory — receiving tab
      // ---------------------------------------------------------------
      {
        id: 'adm-19',  // originally adm-17
        name: 'Check inventory receiving',
        category: 'browse',
        tags: ['inventory'],
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
      // 20. Inventory — locations tab
      // ---------------------------------------------------------------
      {
        id: 'adm-20',  // originally adm-18
        name: 'Review inventory locations',
        category: 'browse',
        tags: ['inventory'],
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
      // 21. Quality — create inspection
      // ---------------------------------------------------------------
      {
        id: 'adm-21',  // originally adm-19
        name: 'Create quality inspection',
        category: 'create',
        tags: ['quality'],
        execute: async (page: Page) => {
          try {
            await page.goto('/quality/inspections', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForTimeout(randomDelay(800, 1500));

            // Open new inspection dialog
            await clickByTestId(page, 'new-inspection-btn');
            await page.waitForTimeout(randomDelay(500, 1000));

            // Wait for dialog
            await page.locator('app-dialog .dialog').first()
              .waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });

            // Fill inspection notes
            const notesWrapper = page.locator('[data-testid="inspection-notes"]');
            const notesInput = notesWrapper.locator('textarea, input').first();
            if (await notesInput.isVisible({ timeout: 2000 }).catch(() => false)) {
              await notesInput.click();
              await notesInput.fill(randomPick(INSPECTION_NOTES));
              await page.waitForTimeout(randomDelay(200, 400));
            }

            // Save via DOM click
            await page.waitForTimeout(1000);
            const saveDisabled = await page.evaluate(() => {
              const btn = document.querySelector('[data-testid="inspection-save-btn"]') as HTMLButtonElement;
              if (btn && !btn.disabled) { btn.click(); return false; }
              return true;
            });
            if (saveDisabled) {
              console.log('[admin] adm-21 save button disabled — form invalid, skipping');
            } else {
              await waitForAnySnackbar(page);
              await dismissSnackbar(page);
              await page.waitForTimeout(randomDelay(500, 1000));
              return 'inspection';
            }
          } catch {
            await page.keyboard.press('Escape');
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // ---------------------------------------------------------------
      // 22. Quality — lots tab
      // ---------------------------------------------------------------
      {
        id: 'adm-22',  // originally adm-20
        name: 'Browse quality lots',
        category: 'browse',
        tags: ['quality'],
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
      // 23. Quality — gages tab
      // ---------------------------------------------------------------
      {
        id: 'adm-23',  // originally adm-21
        name: 'Browse quality gages',
        category: 'browse',
        tags: ['quality'],
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
      // 24. Customers — browse customer list
      // ---------------------------------------------------------------
      {
        id: 'adm-24',  // originally adm-22
        name: 'Browse customer list',
        category: 'browse',
        tags: ['customers'],
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
      // 25. Leads — browse lead pipeline
      // ---------------------------------------------------------------
      {
        id: 'adm-25',  // originally adm-23
        name: 'Browse lead pipeline',
        category: 'browse',
        tags: ['leads'],
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
      // 26. Vendors — browse vendor list
      // ---------------------------------------------------------------
      {
        id: 'adm-26',  // originally adm-24
        name: 'Browse vendor list',
        category: 'browse',
        tags: ['vendors'],
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
      // 27. Purchase Orders — browse POs
      // ---------------------------------------------------------------
      {
        id: 'adm-27',  // originally adm-25
        name: 'Browse purchase orders',
        category: 'browse',
        tags: ['purchase-orders'],
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
      // 28. Sales Orders — browse SOs
      // ---------------------------------------------------------------
      {
        id: 'adm-28',  // originally adm-26
        name: 'Browse sales orders',
        category: 'browse',
        tags: ['sales-orders'],
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
      // 29. Quotes — browse quotes
      // ---------------------------------------------------------------
      {
        id: 'adm-29',  // originally adm-27
        name: 'Browse quotes',
        category: 'browse',
        tags: ['quotes'],
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
      // 30. Invoices — browse invoices
      // ---------------------------------------------------------------
      {
        id: 'adm-30',  // originally adm-28
        name: 'Browse invoices',
        category: 'browse',
        tags: ['invoices'],
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
      // 31. Payments — browse payments
      // ---------------------------------------------------------------
      {
        id: 'adm-31',  // originally adm-29
        name: 'Browse payments',
        category: 'browse',
        tags: ['payments'],
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
      // 32. Shipments — browse shipments
      // ---------------------------------------------------------------
      {
        id: 'adm-32',  // originally adm-30
        name: 'Browse shipments',
        category: 'browse',
        tags: ['shipments'],
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
      // 33. Customer Returns — browse returns
      // ---------------------------------------------------------------
      {
        id: 'adm-33',  // originally adm-31
        name: 'Browse customer returns',
        category: 'browse',
        tags: ['customer-returns'],
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
      // 34. Purchasing/RFQ — browse RFQs
      // ---------------------------------------------------------------
      {
        id: 'adm-34',  // originally adm-32
        name: 'Browse RFQs',
        category: 'browse',
        tags: ['purchasing'],
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
      // 35. Reports — view "Jobs by Stage" then "Team Workload"
      // ---------------------------------------------------------------
      {
        id: 'adm-35',  // originally adm-33
        name: 'View reports — Jobs by Stage and Team Workload',
        category: 'report',
        tags: ['reports'],
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
      // 36. MRP — browse MRP dashboard
      // ---------------------------------------------------------------
      {
        id: 'adm-36',  // originally adm-34
        name: 'Browse MRP dashboard',
        category: 'browse',
        tags: ['mrp'],
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
      // 37. Scheduling — browse schedule
      // ---------------------------------------------------------------
      {
        id: 'adm-37',  // originally adm-35
        name: 'Browse scheduling',
        category: 'browse',
        tags: ['scheduling'],
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
      // 38. OEE — browse OEE metrics
      // ---------------------------------------------------------------
      {
        id: 'adm-38',  // originally adm-36
        name: 'Browse OEE metrics',
        category: 'browse',
        tags: ['oee'],
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
      // 39. Approvals — check pending approvals
      // ---------------------------------------------------------------
      {
        id: 'adm-39',  // originally adm-37
        name: 'Check pending approvals',
        category: 'browse',
        tags: ['approvals'],
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
      // 40. Training — browse modules + admin panel
      // ---------------------------------------------------------------
      {
        id: 'adm-40',  // originally adm-38
        name: 'Browse training modules and admin panel',
        category: 'admin',
        tags: ['training'],
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
      // 41. Chat — send admin announcement
      // ---------------------------------------------------------------
      {
        id: 'adm-41',  // originally adm-39
        name: 'Send admin announcement in chat',
        category: 'chat',
        tags: ['chat'],
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
      // 42. Planning — review planning cycle
      // ---------------------------------------------------------------
      {
        id: 'adm-42',
        name: 'Review planning cycle',
        category: 'browse',
        tags: ['planning'],
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
        category: 'browse',
        tags: ['calendar'],
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
        category: 'search',
        tags: ['ai'],
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
      // 45. Lots — create lot record
      // ---------------------------------------------------------------
      {
        id: 'adm-45',
        name: 'Create lot record',
        category: 'create',
        tags: ['lots'],
        execute: async (page: Page) => {
          try {
            await page.goto('/lots', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await waitForPageContent(page);
            await page.waitForTimeout(randomDelay(800, 1500));

            // Open new lot dialog
            await clickByTestId(page, 'new-lot-btn');
            await page.waitForTimeout(randomDelay(500, 1000));

            // Wait for dialog
            await page.locator('app-dialog .dialog').first()
              .waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });

            // Fill required entity-picker: part
            let foundPart = await fillEntityPickerByTestId(page, 'lot-part', 'bracket');
            if (!foundPart) foundPart = await fillEntityPickerByTestId(page, 'lot-part', 'aluminum');
            if (!foundPart) foundPart = await fillEntityPickerByTestId(page, 'lot-part', 'steel');
            if (!foundPart) foundPart = await fillEntityPickerByTestId(page, 'lot-part', 'bearing');
            if (!foundPart) {
              console.log('[admin] adm-45 no parts found for entity-picker — skipping lot creation');
              await page.keyboard.press('Escape');
              await page.waitForTimeout(randomDelay(300, 600));
              return;
            }
            await page.waitForTimeout(randomDelay(200, 400));

            // Fill lot quantity
            await fillByTestId(page, 'lot-quantity', String(randomInt(10, 500)));
            await page.waitForTimeout(randomDelay(200, 400));

            // Fill lot notes
            const notesWrapper = page.locator('[data-testid="lot-notes"]');
            const notesInput = notesWrapper.locator('textarea, input').first();
            if (await notesInput.isVisible({ timeout: 2000 }).catch(() => false)) {
              await notesInput.click();
              await notesInput.fill(randomPick(LOT_NOTES));
              await page.waitForTimeout(randomDelay(200, 400));
            }

            // Save via DOM click
            await page.waitForTimeout(1000);
            const saveDisabled = await page.evaluate(() => {
              const btn = document.querySelector('[data-testid="lot-save-btn"]') as HTMLButtonElement;
              if (btn && !btn.disabled) { btn.click(); return false; }
              return true;
            });
            if (saveDisabled) {
              console.log('[admin] adm-45 save button disabled — form invalid, skipping');
            } else {
              await waitForAnySnackbar(page);
              await dismissSnackbar(page);
              await page.waitForTimeout(randomDelay(500, 1000));
              return 'lot';
            }
          } catch {
            await page.keyboard.press('Escape');
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // ---------------------------------------------------------------
      // 46. Assets — create asset
      // ---------------------------------------------------------------
      {
        id: 'adm-46',
        name: 'Create asset',
        category: 'create',
        tags: ['assets'],
        execute: async (page: Page) => {
          try {
            await page.goto('/assets', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await waitForPageContent(page);
            await page.waitForTimeout(randomDelay(800, 1500));

            // Open new asset dialog
            await clickByTestId(page, 'new-asset-btn');
            await page.waitForTimeout(randomDelay(500, 1000));

            // Wait for dialog
            await page.locator('app-dialog .dialog').first()
              .waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });

            // Fill asset form
            await fillByTestId(page, 'asset-name', randomPick(ASSET_NAMES));
            await page.waitForTimeout(randomDelay(200, 500));

            await selectByTestId(page, 'asset-type', randomPick(ASSET_TYPES));
            await page.waitForTimeout(randomDelay(200, 400));

            await fillByTestId(page, 'asset-location', randomPick(ASSET_LOCATIONS));
            await page.waitForTimeout(randomDelay(200, 400));

            await fillByTestId(page, 'asset-manufacturer', randomPick(ASSET_MANUFACTURERS));
            await page.waitForTimeout(randomDelay(200, 400));

            // Fill notes
            const notesWrapper = page.locator('[data-testid="asset-notes"]');
            const notesInput = notesWrapper.locator('textarea, input').first();
            if (await notesInput.isVisible({ timeout: 2000 }).catch(() => false)) {
              await notesInput.click();
              await notesInput.fill(randomPick(ASSET_NOTES));
              await page.waitForTimeout(randomDelay(200, 400));
            }

            // Save via DOM click
            await page.waitForTimeout(1000);
            const saveDisabled = await page.evaluate(() => {
              const btn = document.querySelector('[data-testid="asset-save-btn"]') as HTMLButtonElement;
              if (btn && !btn.disabled) { btn.click(); return false; }
              return true;
            });
            if (saveDisabled) {
              console.log('[admin] adm-46 save button disabled — form invalid, skipping');
            } else {
              await waitForAnySnackbar(page);
              await dismissSnackbar(page);
              await page.waitForTimeout(randomDelay(500, 1000));
              return 'asset';
            }
          } catch {
            await page.keyboard.press('Escape');
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
        category: 'browse',
        tags: ['events'],
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
        category: 'browse',
        tags: ['notifications'],
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
        category: 'browse',
        tags: ['account'],
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
      // 51. Browse scheduled tasks
      // ---------------------------------------------------------------
      {
        id: 'adm-51',
        name: 'Browse scheduled tasks',
        category: 'admin',
        tags: ['scheduled-tasks'],
        execute: async (page: Page) => {
          try {
            await page.goto('/admin/scheduled-tasks', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await waitForPageContent(page);
            await page.waitForTimeout(randomDelay(800, 1500));
            await browseTablePage(page, 'Name');
            await randomScroll(page);
            await page.waitForTimeout(randomDelay(600, 1200));
          } catch {
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // ---------------------------------------------------------------
      // 52. Use global search
      // ---------------------------------------------------------------
      {
        id: 'adm-52',
        name: 'Use global search',
        category: 'search',
        tags: ['search', 'header'],
        execute: async (page: Page) => {
          try {
            await page.keyboard.press('Control+k');
            await page.waitForTimeout(randomDelay(500, 1000));
            const searchInput = page.locator('input[type="search"], .search-input, [placeholder*="Search"]').first();
            if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
              const terms = ['bracket', 'motor', 'seal', 'pump', 'gasket', 'bolt'];
              await searchInput.fill(randomPick(terms));
              await page.waitForTimeout(randomDelay(1000, 2000));
            }
            await page.keyboard.press('Escape');
            await page.waitForTimeout(randomDelay(500, 800));
          } catch {
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // ---------------------------------------------------------------
      // 53. Browse account pay stubs
      // ---------------------------------------------------------------
      {
        id: 'adm-53',
        name: 'Browse account pay stubs',
        category: 'browse',
        tags: ['account', 'payroll'],
        execute: async (page: Page) => {
          try {
            await page.goto('/account/pay-stubs', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await waitForPageContent(page);
            await page.waitForTimeout(randomDelay(800, 1500));
            await randomScroll(page);
            await page.waitForTimeout(randomDelay(600, 1200));
          } catch {
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // ---------------------------------------------------------------
      // 54. Browse account tax documents
      // ---------------------------------------------------------------
      {
        id: 'adm-54',
        name: 'Browse account tax documents',
        category: 'browse',
        tags: ['account', 'payroll'],
        execute: async (page: Page) => {
          try {
            await page.goto('/account/tax-documents', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await waitForPageContent(page);
            await page.waitForTimeout(randomDelay(800, 1500));
            await randomScroll(page);
            await page.waitForTimeout(randomDelay(600, 1200));
          } catch {
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // ---------------------------------------------------------------
      // 55. Browse account tax forms
      // ---------------------------------------------------------------
      {
        id: 'adm-55',
        name: 'Browse account tax forms',
        category: 'browse',
        tags: ['account', 'compliance'],
        execute: async (page: Page) => {
          try {
            await page.goto('/account/tax-forms', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await waitForPageContent(page);
            await page.waitForTimeout(randomDelay(800, 1500));
            await randomScroll(page);
            await page.waitForTimeout(randomDelay(600, 1200));
          } catch {
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // ---------------------------------------------------------------
      // 56. Browse account security / MFA
      // ---------------------------------------------------------------
      {
        id: 'adm-56',
        name: 'Browse account security / MFA',
        category: 'browse',
        tags: ['account', 'security', 'mfa'],
        execute: async (page: Page) => {
          try {
            await page.goto('/account/security', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await waitForPageContent(page);
            await page.waitForTimeout(randomDelay(800, 1500));
            await randomScroll(page);
            await page.waitForTimeout(randomDelay(600, 1200));
          } catch {
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // ---------------------------------------------------------------
      // 57. Browse recurring expenses
      // ---------------------------------------------------------------
      {
        id: 'adm-57',
        name: 'Browse recurring expenses',
        category: 'browse',
        tags: ['expenses', 'recurring'],
        execute: async (page: Page) => {
          try {
            await page.goto('/expenses/upcoming', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await waitForPageContent(page);
            await page.waitForTimeout(randomDelay(800, 1500));
            await randomScroll(page);
            await page.waitForTimeout(randomDelay(600, 1200));
          } catch {
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // ---------------------------------------------------------------
      // 58. Use report builder
      // ---------------------------------------------------------------
      {
        id: 'adm-58',
        name: 'Use report builder',
        category: 'report',
        tags: ['reports', 'builder'],
        execute: async (page: Page) => {
          try {
            await page.goto('/reports/builder', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await waitForPageContent(page);
            await page.waitForTimeout(randomDelay(800, 1500));
            // Try to interact with entity source dropdown if visible
            const sourceSelect = page.locator('app-select, mat-select').first();
            if (await sourceSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
              await sourceSelect.click();
              await page.waitForTimeout(randomDelay(500, 1000));
              await page.keyboard.press('Escape');
            }
            await randomScroll(page);
            await page.waitForTimeout(randomDelay(600, 1200));
          } catch {
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // ---------------------------------------------------------------
      // 59. Browse customer returns detail
      // ---------------------------------------------------------------
      {
        id: 'adm-59',
        name: 'Browse customer returns detail',
        category: 'browse',
        tags: ['customer-returns'],
        execute: async (page: Page) => {
          try {
            await page.goto('/customer-returns', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await waitForPageContent(page);
            await page.waitForTimeout(randomDelay(800, 1500));
            const clicked = await clickRandomRow(page);
            if (clicked) {
              await page.waitForTimeout(randomDelay(1000, 2000));
              await randomScroll(page);
              await closeOverlay(page);
            }
            await page.waitForTimeout(randomDelay(500, 1000));
          } catch {
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // ---------------------------------------------------------------
      // 60. Browse production lot detail
      // ---------------------------------------------------------------
      {
        id: 'adm-60',
        name: 'Browse production lot detail',
        category: 'browse',
        tags: ['lots', 'quality'],
        execute: async (page: Page) => {
          try {
            await page.goto('/lots', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await waitForPageContent(page);
            await page.waitForTimeout(randomDelay(800, 1500));
            const clicked = await clickRandomRow(page);
            if (clicked) {
              await page.waitForTimeout(randomDelay(1000, 2000));
              await randomScroll(page);
              await closeOverlay(page);
            }
            await page.waitForTimeout(randomDelay(500, 1000));
          } catch {
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // ---------------------------------------------------------------
      // 61. Create a vendor
      // ---------------------------------------------------------------
      {
        id: 'adm-61',
        name: 'Create a vendor',
        category: 'create',
        tags: ['vendors'],
        execute: async (page: Page) => {
          try {
            await page.goto('/vendors', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await waitForPageContent(page);
            await page.waitForTimeout(randomDelay(800, 1500));

            // Open new vendor dialog
            await clickByTestId(page, 'new-vendor-btn');
            await page.waitForTimeout(randomDelay(500, 1000));

            // Wait for dialog
            await page.locator('app-dialog .dialog').first()
              .waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });

            const company = randomPick(VENDOR_COMPANIES);
            await fillByTestId(page, 'vendor-company', company);
            await page.waitForTimeout(randomDelay(200, 500));

            await fillByTestId(page, 'vendor-contact', randomPick(VENDOR_CONTACTS));
            await page.waitForTimeout(randomDelay(200, 400));

            const emailDomain = company.toLowerCase().replace(/[^a-z]/g, '').slice(0, 12);
            await fillByTestId(page, 'vendor-email', `purchasing@${emailDomain}.com`);
            await page.waitForTimeout(randomDelay(200, 400));

            await fillByTestId(page, 'vendor-phone', randomPick(VENDOR_PHONES));
            await page.waitForTimeout(randomDelay(200, 400));

            // Save via DOM click
            await page.waitForTimeout(1000);
            const saveDisabled = await page.evaluate(() => {
              const btn = document.querySelector('[data-testid="vendor-save-btn"]') as HTMLButtonElement;
              if (btn && !btn.disabled) { btn.click(); return false; }
              return true;
            });
            if (saveDisabled) {
              console.log('[admin] adm-61 save button disabled — form invalid, skipping');
            } else {
              await waitForAnySnackbar(page);
              await dismissSnackbar(page);
              await page.waitForTimeout(randomDelay(500, 1000));
              return 'vendor';
            }
          } catch {
            await page.keyboard.press('Escape');
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // ---------------------------------------------------------------
      // 62. Create a customer
      // ---------------------------------------------------------------
      {
        id: 'adm-62',
        name: 'Create a customer',
        category: 'create',
        tags: ['customers'],
        execute: async (page: Page) => {
          try {
            await page.goto('/customers', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await waitForPageContent(page);
            await page.waitForTimeout(randomDelay(800, 1500));

            // Open new customer dialog
            await clickByTestId(page, 'new-customer-btn');
            await page.waitForTimeout(randomDelay(500, 1000));

            // Wait for dialog
            await page.locator('app-dialog .dialog').first()
              .waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });

            const customerName = randomPick(CUSTOMER_NAMES);
            await fillByTestId(page, 'customer-name', customerName);
            await page.waitForTimeout(randomDelay(200, 500));

            const emailDomain = customerName.toLowerCase().replace(/[^a-z]/g, '').slice(0, 12);
            await fillByTestId(page, 'customer-email', `info@${emailDomain}.com`);
            await page.waitForTimeout(randomDelay(200, 400));

            await fillByTestId(page, 'customer-phone', randomPick(CUSTOMER_PHONES));
            await page.waitForTimeout(randomDelay(200, 400));

            // Save via DOM click
            await page.waitForTimeout(1000);
            const saveDisabled = await page.evaluate(() => {
              const btn = document.querySelector('[data-testid="customer-save-btn"]') as HTMLButtonElement;
              if (btn && !btn.disabled) { btn.click(); return false; }
              return true;
            });
            if (saveDisabled) {
              console.log('[admin] adm-62 save button disabled — form invalid, skipping');
            } else {
              await waitForAnySnackbar(page);
              await dismissSnackbar(page);
              await page.waitForTimeout(randomDelay(500, 1000));
              return 'customer';
            }
          } catch {
            await page.keyboard.press('Escape');
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // ---------------------------------------------------------------
      // 63. Create a part
      // ---------------------------------------------------------------
      {
        id: 'adm-63',
        name: 'Create a part',
        category: 'create',
        tags: ['parts'],
        execute: async (page: Page) => {
          try {
            await page.goto('/parts', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await waitForPageContent(page);
            await page.waitForTimeout(randomDelay(800, 1500));

            // Open new part dialog
            await clickByTestId(page, 'new-part-btn');
            await page.waitForTimeout(randomDelay(500, 1000));

            // Wait for dialog
            await page.locator('app-dialog .dialog').first()
              .waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });

            await selectByTestId(page, 'part-type', randomPick(PART_TYPES));
            await page.waitForTimeout(randomDelay(200, 500));

            const descWrapper = page.locator('[data-testid="part-description"]');
            const descInput = descWrapper.locator('textarea, input').first();
            if (await descInput.isVisible({ timeout: 2000 }).catch(() => false)) {
              await descInput.click();
              await descInput.fill(randomPick(PART_DESCRIPTIONS));
              await page.waitForTimeout(randomDelay(200, 400));
            }

            await fillByTestId(page, 'part-material', randomPick(PART_MATERIALS));
            await page.waitForTimeout(randomDelay(200, 400));

            // Save via DOM click
            await page.waitForTimeout(1000);
            const saveDisabled = await page.evaluate(() => {
              const btn = document.querySelector('[data-testid="part-save-btn"]') as HTMLButtonElement;
              if (btn && !btn.disabled) { btn.click(); return false; }
              return true;
            });
            if (saveDisabled) {
              console.log('[admin] adm-63 save button disabled — form invalid, skipping');
            } else {
              await waitForAnySnackbar(page);
              await dismissSnackbar(page);
              await page.waitForTimeout(randomDelay(500, 1000));
              return 'part';
            }
          } catch {
            await page.keyboard.press('Escape');
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // ---------------------------------------------------------------
      // 64. Create ECO
      // ---------------------------------------------------------------
      {
        id: 'adm-64',
        name: 'Create ECO',
        category: 'create',
        tags: ['quality'],
        execute: async (page: Page) => {
          try {
            await page.goto('/quality/ecos', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await waitForPageContent(page);
            await page.waitForTimeout(randomDelay(800, 1500));

            // Open new ECO form
            const newEcoBtn = page.locator('[data-testid="new-eco-btn"]');
            await newEcoBtn.waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });
            await newEcoBtn.click();
            await page.waitForTimeout(randomDelay(500, 1000));

            // Wait for dialog
            await page.locator('app-dialog .dialog').first()
              .waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });

            await fillByTestId(page, 'eco-title', randomPick(ECO_TITLES));
            await page.waitForTimeout(randomDelay(200, 500));

            await selectByTestId(page, 'eco-change-type', randomPick(ECO_CHANGE_TYPES));
            await page.waitForTimeout(randomDelay(200, 400));

            await selectByTestId(page, 'eco-priority', randomPick(ECO_PRIORITIES));
            await page.waitForTimeout(randomDelay(200, 400));

            const descWrapper = page.locator('[data-testid="eco-description"]');
            const descInput = descWrapper.locator('textarea, input').first();
            if (await descInput.isVisible({ timeout: 2000 }).catch(() => false)) {
              await descInput.click();
              await descInput.fill(randomPick(ECO_DESCRIPTIONS));
              await page.waitForTimeout(randomDelay(200, 400));
            }

            const reasonWrapper = page.locator('[data-testid="eco-reason"]');
            const reasonInput = reasonWrapper.locator('textarea, input').first();
            if (await reasonInput.isVisible({ timeout: 2000 }).catch(() => false)) {
              await reasonInput.click();
              await reasonInput.fill(randomPick(ECO_REASONS));
              await page.waitForTimeout(randomDelay(200, 400));
            }

            // Save via DOM click
            await page.waitForTimeout(1000);
            const saveDisabled = await page.evaluate(() => {
              const btn = document.querySelector('[data-testid="eco-save-btn"]') as HTMLButtonElement;
              if (btn && !btn.disabled) { btn.click(); return false; }
              return true;
            });
            if (saveDisabled) {
              console.log('[admin] adm-64 save button disabled — form invalid, skipping');
            } else {
              await waitForAnySnackbar(page);
              await dismissSnackbar(page);
              await page.waitForTimeout(randomDelay(500, 1000));
              return 'eco';
            }
          } catch {
            await page.keyboard.press('Escape');
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // ---------------------------------------------------------------
      // 65. Return to dashboard — end of admin shift
      // ---------------------------------------------------------------
      {
        id: 'adm-65',
        name: 'Return to dashboard — shift complete',
        category: 'browse',
        tags: ['dashboard'],
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
