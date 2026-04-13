import type { Page } from 'playwright';
import type { Workflow } from '../orchestrator';
import { fillByTestId, selectByTestId, fillDateByTestId } from '../../lib/form.lib';
import { waitForAnySnackbar, dismissSnackbar } from '../../lib/snackbar.lib';
import { waitForTable, sortByColumn } from '../../lib/data-table.lib';
import { randomDelay, testId, maybe, randomPick, randomInt, randomDate, randomAmount } from '../../lib/random.lib';

/**
 * Office/Sales worker workflow — the broadest role in the app.
 * Covers the full quote-to-cash pipeline: customers, quotes (create),
 * sales orders, purchase orders (create), vendors, invoices, payments,
 * shipments, RFQs (create), customer returns, expenses (create),
 * time tracking, chat, reports, parts catalog, inventory, kanban,
 * calendar, training, notifications, and account settings.
 *
 * 35 steps, with quote creation and PO creation as the star steps.
 */

const NAV_TIMEOUT = 15_000;
const ELEMENT_TIMEOUT = 8_000;

// ---------------------------------------------------------------------------
// Data pools
// ---------------------------------------------------------------------------

const CUSTOMERS = ['Acme Corp', 'Apex Manufacturing', 'Quantum Dynamics', 'Meridian Systems'];

const VENDORS = ['Metal', 'Supply', 'Steel', 'Precision', 'Components', 'Fastener', 'Industrial'];

const QUOTE_NOTES = [
  'Standard manufacturing order — lead time 4-6 weeks',
  'Rush order — customer needs expedited turnaround within 2 weeks',
  'Repeat order — same specs as previous run, verify tooling still on hand',
  'Prototype run — small quantity for design validation before production release',
  'Annual blanket order — monthly releases per customer schedule',
  'Engineering change — revised specs from customer, re-quote required',
  'New customer first order — competitive pricing to establish relationship',
  'Rework quote — customer-supplied material, labor only',
];

const TAX_RATES = ['0', '6.25', '7.0', '7.5', '8.0', '8.5', '9.25'];

const RFQ_DESCRIPTIONS = [
  'Raw aluminum plate 6061-T6, 0.5" thick, 48x96 sheets',
  'Steel round bar 4140 HT, 2" dia x 12ft lengths',
  'Stainless steel 304 sheet, 16 gauge, brushed finish',
  'Brass hex bar C360, 3/4" A/F, 6ft lengths',
  'UHMW-PE sheet, 1" thick, natural color, 4x8 sheets',
  'Delrin rod, 3" dia, black, 4ft lengths',
  'Fasteners assortment — grade 8 hex bolts, various sizes',
  'Carbide inserts CNMG 432 — qty 100 per box',
];

const RFQ_INSTRUCTIONS = [
  'Please include material test certs with shipment',
  'Require domestic-only sourcing per customer spec',
  'Need hot-rolled, not cold-finished',
  'Ship in protective packaging — no surface scratches acceptable',
  'Include COC with each lot delivered',
  '',
];

const EXPENSE_CATEGORIES = ['Office Supplies', 'Shipping', 'Postage', 'Printing', 'Software', 'Travel'];

const EXPENSE_DESCRIPTIONS = [
  'Printer toner and paper for office copier',
  'Overnight shipping for customer samples',
  'Postage stamps and padded envelopes',
  'Color printing for customer quote packages',
  'Monthly CRM subscription renewal',
  'Mileage reimbursement — customer site visit',
  'USB cables and adapters for conference room',
  'Business cards reorder — 500 qty',
  'Office chair mat replacement',
  'Whiteboard markers and erasers',
];

const TIME_ENTRY_NOTES = [
  'Customer follow-up calls — reviewed open quotes and pending orders',
  'Quote preparation — pricing research and margin analysis',
  'Sales order entry and verification with customer PO',
  'Invoice reconciliation and payment posting',
  'Vendor coordination — PO status check and expedite requests',
  'Customer onboarding — setup account and credit terms',
  'RFQ processing — sourced materials from three vendors',
  'Shipping coordination — arranged LTL pickup for outbound orders',
];

const CHAT_MESSAGES = [
  'Office update: reviewed customer pipeline, quotes and orders status check complete.',
  'Updated vendor contacts. PO follow-ups scheduled for this week.',
  'Invoice batch reviewed. All current invoices reconciled.',
  'New quote requests processed and sent to customers.',
  'Expense reports submitted for the month.',
  'Customer follow-up calls done — pipeline looks healthy.',
  'Heads up: Apex Manufacturing PO arriving tomorrow, need dock space.',
  'AR aging report reviewed — two accounts past 60 days, sending reminders.',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fillEntityPicker(page: Page, dataTestId: string, searchText: string): Promise<boolean> {
  try {
    const wrapper = page.locator(`[data-testid="${dataTestId}"]`);
    const input = wrapper.locator('input').first();
    await input.waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });
    await input.click();
    await input.fill(searchText);
    await page.waitForTimeout(500);

    const option = page.locator('.cdk-overlay-container mat-option').first();
    if (await option.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await option.click();
      await page.waitForTimeout(300);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

async function safeCloseDialog(page: Page): Promise<void> {
  try {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    const confirmBtn = page.locator('.confirm-dialog button', { hasText: /discard|yes|confirm/i }).first();
    if (await confirmBtn.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await confirmBtn.click();
      await page.waitForTimeout(300);
    }
  } catch {
    // Already closed
  }
}

async function waitForSnackbarSafe(page: Page): Promise<void> {
  try {
    await waitForAnySnackbar(page, 5_000);
    await page.waitForTimeout(randomDelay(300, 600));
    try { await dismissSnackbar(page); } catch { /* auto-dismissed */ }
  } catch {
    // Snackbar may have auto-dismissed or not appeared
  }
}

async function clickFirstTableRow(page: Page): Promise<boolean> {
  try {
    const rows = page.locator('app-data-table tbody tr');
    const count = await rows.count();
    if (count > 0) {
      await rows.nth(randomInt(0, Math.min(count - 1, 4))).click({ timeout: 5_000 });
      await page.waitForTimeout(randomDelay(800, 1_500));
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

async function closeDetailOrDialog(page: Page): Promise<void> {
  try {
    // Try dialog close button first
    const dialogClose = page.locator('app-dialog .dialog__close, .mat-mdc-dialog-container button[aria-label="Close"]').first();
    if (await dialogClose.isVisible({ timeout: 1_500 }).catch(() => false)) {
      await dialogClose.click();
      await page.waitForTimeout(300);
      return;
    }
    // Fallback to Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  } catch {
    // Already closed
  }
}

async function sortRandomColumn(page: Page): Promise<void> {
  try {
    const headers = page.locator('app-data-table thead th');
    const count = await headers.count();
    if (count > 1) {
      await headers.nth(randomInt(0, Math.min(count - 1, 4))).click();
      await page.waitForTimeout(randomDelay(400, 800));
    }
  } catch {
    // Non-critical
  }
}

async function scrollTable(page: Page): Promise<void> {
  try {
    const tableScroll = page.locator('app-data-table .data-table__scroll');
    if (await tableScroll.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await tableScroll.evaluate((el) => el.scrollBy(0, 300));
      await page.waitForTimeout(randomDelay(400, 800));
    }
  } catch {
    // Non-critical
  }
}

async function waitForDialog(page: Page): Promise<void> {
  const dialog = page.locator('.cdk-overlay-container .mat-mdc-dialog-container, .cdk-overlay-container app-dialog').first();
  await dialog.waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });
  await page.waitForTimeout(randomDelay(300, 600));
}

async function clickSaveButton(page: Page, testIdName: string): Promise<void> {
  const saveBtn = page.locator(`[data-testid="${testIdName}"]`).first();
  if (await saveBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await page.evaluate((tid) => {
      const btn = document.querySelector(`[data-testid="${tid}"]`) as HTMLButtonElement;
      if (btn && !btn.disabled) btn.click();
    }, testIdName);
    await page.waitForTimeout(3000);
    await waitForSnackbarSafe(page);
    return;
  }
  // Fallback: generic Save button
  const genericSave = page.getByRole('button', { name: /save/i }).first();
  if (await genericSave.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await page.evaluate(() => {
      const btns = document.querySelectorAll('button');
      for (const btn of btns) {
        if (/save/i.test(btn.textContent ?? '') && !btn.disabled) {
          btn.click();
          break;
        }
      }
    });
    await page.waitForTimeout(3000);
    await waitForSnackbarSafe(page);
  } else {
    await safeCloseDialog(page);
  }
}

// ---------------------------------------------------------------------------
// Workflow definition
// ---------------------------------------------------------------------------

export function getOfficeWorkflow(): Workflow {
  return {
    name: 'office',
    steps: [
      // -----------------------------------------------------------------
      // ofc-01  Dashboard — review KPIs and widgets
      // -----------------------------------------------------------------
      {
        id: 'ofc-01',
        name: 'Review dashboard KPIs',
        execute: async (page: Page) => {
          try {
            await page.goto('/dashboard', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForSelector('app-dashboard-widget, app-kpi-chip, .dashboard', { timeout: ELEMENT_TIMEOUT });
            await page.waitForTimeout(randomDelay(1_200, 2_500));

            // Scroll through dashboard widgets
            const content = page.locator('.dashboard, app-dashboard');
            if (await content.isVisible({ timeout: 2_000 }).catch(() => false)) {
              await content.evaluate((el) => el.scrollBy(0, 400));
              await page.waitForTimeout(randomDelay(600, 1_200));
            }
          } catch {
            // Dashboard may be slow — continue
          }
        },
      },

      // -----------------------------------------------------------------
      // ofc-02  Customers — browse list, sort by name
      // -----------------------------------------------------------------
      {
        id: 'ofc-02',
        name: 'Browse customer list',
        execute: async (page: Page) => {
          try {
            await page.goto('/customers', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForSelector('app-data-table', { timeout: ELEMENT_TIMEOUT });
            await page.waitForTimeout(randomDelay(800, 1_500));

            // Sort by name
            try { await sortByColumn(page, 'Name'); } catch { /* column may not exist */ }
            await page.waitForTimeout(randomDelay(500, 1_000));
            await scrollTable(page);
          } catch {
            // Non-critical browsing
          }
        },
      },

      // -----------------------------------------------------------------
      // ofc-03  Customer detail — click a customer row, browse tabs
      // -----------------------------------------------------------------
      {
        id: 'ofc-03',
        name: 'View customer detail tabs',
        execute: async (page: Page) => {
          try {
            // Click a customer row
            const opened = await clickFirstTableRow(page);
            if (!opened) return;

            // Browse through tabs
            const tabs = ['Overview', 'Contacts', 'Addresses', 'Orders', 'Invoices'];
            for (const tab of tabs) {
              try {
                const tabEl = page.locator('[role="tab"], .tab', { hasText: tab }).first();
                if (await tabEl.isVisible({ timeout: 2_000 }).catch(() => false)) {
                  await tabEl.click();
                  await page.waitForTimeout(randomDelay(600, 1_200));
                }
              } catch {
                // Tab may not exist
              }
            }

            await page.waitForTimeout(randomDelay(500, 1_000));
          } catch {
            // Non-critical
          }
        },
      },

      // -----------------------------------------------------------------
      // ofc-04  CREATE QUOTE  (star step)
      // -----------------------------------------------------------------
      {
        id: 'ofc-04',
        name: 'Create a new quote',
        execute: async (page: Page) => {
          try {
            await page.goto('/quotes', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForTimeout(randomDelay(500, 1_000));

            // Click New Quote
            const newQuoteBtn = page.locator('[data-testid="new-quote-btn"]').first();
            await newQuoteBtn.waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });
            await newQuoteBtn.click();
            await page.waitForTimeout(randomDelay(400, 800));

            await waitForDialog(page);

            // Select customer via entity picker
            const customer = randomPick(CUSTOMERS);
            const searchTerm = customer.split(' ')[0];
            let pickerFilled = await fillEntityPicker(page, 'quote-customer', searchTerm);

            if (!pickerFilled) {
              // Try alternate customers
              for (const alt of ['Acme', 'Apex', 'Blue']) {
                pickerFilled = await fillEntityPicker(page, 'quote-customer', alt);
                if (pickerFilled) break;
              }
            }

            await page.waitForTimeout(randomDelay(300, 600));

            // Fill expiry date (14-45 days out)
            try {
              await fillDateByTestId(page, 'quote-expiry', randomDate(14, 31));
            } catch {
              // Expiry may be optional
            }

            // Fill tax rate
            try {
              await fillByTestId(page, 'quote-tax-rate', randomPick(TAX_RATES));
            } catch {
              // Tax rate optional
            }

            // Fill notes
            try {
              const notesWrapper = page.locator('[data-testid="quote-notes"]');
              const textarea = notesWrapper.locator('textarea').first();
              if (await textarea.isVisible({ timeout: 2_000 }).catch(() => false)) {
                await textarea.click();
                await textarea.fill(randomPick(QUOTE_NOTES));
                await page.waitForTimeout(randomDelay(200, 400));
              }
            } catch {
              // Notes optional
            }

            await page.waitForTimeout(randomDelay(300, 600));

            // Add a quote line (part + qty + price)
            try {
              const addLineBtn = page.locator('[data-testid="quote-add-line-btn"]').first();
              if (await addLineBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
                await addLineBtn.click();
                await page.waitForTimeout(randomDelay(300, 600));

                // Fill part via entity picker
                const partTerms = ['Bracket', 'Shaft', 'Housing', 'Plate', 'Coupling', 'Block'];
                for (const pt of partTerms) {
                  if (await fillEntityPicker(page, 'quote-line-part', pt)) break;
                }

                // Fill quantity
                try {
                  await fillByTestId(page, 'quote-line-qty', String(randomInt(1, 100)));
                } catch { /* qty field may differ */ }

                // Fill unit price
                try {
                  await fillByTestId(page, 'quote-line-price', randomAmount(25, 2500));
                } catch { /* price field may differ */ }

                await page.waitForTimeout(randomDelay(200, 500));
              }
            } catch {
              // Line items may not be available in create dialog
            }

            // Save the quote
            await clickSaveButton(page, 'quote-save-btn');
            await page.waitForTimeout(randomDelay(500, 1_000));
          } catch {
            await safeCloseDialog(page);
          }
        },
      },

      // -----------------------------------------------------------------
      // ofc-05  Quotes — browse list, sort by status
      // -----------------------------------------------------------------
      {
        id: 'ofc-05',
        name: 'Browse quote list',
        execute: async (page: Page) => {
          try {
            await page.goto('/quotes', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForSelector('app-data-table', { timeout: ELEMENT_TIMEOUT });
            await page.waitForTimeout(randomDelay(800, 1_500));

            try { await sortByColumn(page, 'Status'); } catch { /* non-critical */ }
            await page.waitForTimeout(randomDelay(400, 800));
            await scrollTable(page);
          } catch {
            // Non-critical
          }
        },
      },

      // -----------------------------------------------------------------
      // ofc-06  Quote detail — click a quote row, review, close
      // -----------------------------------------------------------------
      {
        id: 'ofc-06',
        name: 'View quote detail',
        execute: async (page: Page) => {
          try {
            const opened = await clickFirstTableRow(page);
            if (opened) {
              await page.waitForTimeout(randomDelay(1_000, 2_000));
              await closeDetailOrDialog(page);
            }
          } catch {
            // Non-critical
          }
        },
      },

      // -----------------------------------------------------------------
      // ofc-07  Sales Orders — browse list, sort by status
      // -----------------------------------------------------------------
      {
        id: 'ofc-07',
        name: 'Browse sales orders',
        execute: async (page: Page) => {
          try {
            await page.goto('/sales-orders', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForSelector('app-data-table', { timeout: ELEMENT_TIMEOUT });
            await page.waitForTimeout(randomDelay(800, 1_500));

            try { await sortByColumn(page, 'Status'); } catch { /* non-critical */ }
            await page.waitForTimeout(randomDelay(400, 800));
            await scrollTable(page);
          } catch {
            // Non-critical
          }
        },
      },

      // -----------------------------------------------------------------
      // ofc-08  Sales Order detail — click row, browse tabs, close
      // -----------------------------------------------------------------
      {
        id: 'ofc-08',
        name: 'View sales order detail',
        execute: async (page: Page) => {
          try {
            const opened = await clickFirstTableRow(page);
            if (opened) {
              // Browse tabs if present
              for (const tab of ['Lines', 'Shipments', 'Activity']) {
                try {
                  const tabEl = page.locator('[role="tab"], .tab', { hasText: tab }).first();
                  if (await tabEl.isVisible({ timeout: 1_500 }).catch(() => false)) {
                    await tabEl.click();
                    await page.waitForTimeout(randomDelay(500, 1_000));
                  }
                } catch { /* tab may not exist */ }
              }
              await closeDetailOrDialog(page);
            }
          } catch {
            // Non-critical
          }
        },
      },

      // -----------------------------------------------------------------
      // ofc-09  CREATE PURCHASE ORDER  (star step)
      // -----------------------------------------------------------------
      {
        id: 'ofc-09',
        name: 'Create a new purchase order',
        execute: async (page: Page) => {
          try {
            await page.goto('/purchase-orders', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForTimeout(randomDelay(500, 1_000));

            // Click New PO
            const newPoBtn = page.locator('[data-testid="new-po-btn"]').first();
            await newPoBtn.waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });
            await newPoBtn.click();
            await page.waitForTimeout(randomDelay(400, 800));

            await waitForDialog(page);

            // Select vendor via entity picker — try multiple search terms
            let vendorFilled = false;
            const shuffledVendors = [...VENDORS].sort(() => Math.random() - 0.5);
            for (const term of shuffledVendors) {
              vendorFilled = await fillEntityPicker(page, 'po-vendor', term);
              if (vendorFilled) break;
            }

            if (!vendorFilled) {
              // Last resort: try clicking the input and picking first option
              try {
                const wrapper = page.locator('[data-testid="po-vendor"]');
                const input = wrapper.locator('input').first();
                await input.click();
                await input.fill('a');
                await page.waitForTimeout(600);
                const option = page.locator('.cdk-overlay-container mat-option').first();
                if (await option.isVisible({ timeout: 3_000 }).catch(() => false)) {
                  await option.click();
                  vendorFilled = true;
                }
              } catch { /* vendor selection failed */ }
            }

            await page.waitForTimeout(randomDelay(300, 600));

            // Optionally link to a job
            if (maybe(0.3)) {
              try {
                await fillByTestId(page, 'po-job-id', String(randomInt(1, 50)));
              } catch { /* job ID field may not exist */ }
            }

            // Add a PO line (part + qty + price)
            try {
              const addLineBtn = page.locator('[data-testid="po-add-line-btn"]').first();
              if (await addLineBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
                await addLineBtn.click();
                await page.waitForTimeout(randomDelay(300, 600));

                // Fill part via entity picker
                const partTerms = ['Aluminum', 'Steel', 'Brass', 'Bolt', 'Insert', 'Bar'];
                for (const pt of partTerms) {
                  if (await fillEntityPicker(page, 'po-line-part', pt)) break;
                }

                // Quantity
                try {
                  await fillByTestId(page, 'po-line-qty', String(randomInt(10, 500)));
                } catch { /* qty field may differ */ }

                // Unit price
                try {
                  await fillByTestId(page, 'po-line-price', randomAmount(5, 500));
                } catch { /* price field may differ */ }

                await page.waitForTimeout(randomDelay(200, 500));
              }
            } catch {
              // Line items may not be available in create dialog
            }

            // Save
            await clickSaveButton(page, 'po-save-btn');
            await page.waitForTimeout(randomDelay(500, 1_000));
          } catch {
            await safeCloseDialog(page);
          }
        },
      },

      // -----------------------------------------------------------------
      // ofc-10  Purchase Orders — browse list, sort by status
      // -----------------------------------------------------------------
      {
        id: 'ofc-10',
        name: 'Browse purchase order list',
        execute: async (page: Page) => {
          try {
            await page.goto('/purchase-orders', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForSelector('app-data-table', { timeout: ELEMENT_TIMEOUT });
            await page.waitForTimeout(randomDelay(800, 1_500));

            try { await sortByColumn(page, 'Status'); } catch { /* non-critical */ }
            await page.waitForTimeout(randomDelay(400, 800));
          } catch {
            // Non-critical
          }
        },
      },

      // -----------------------------------------------------------------
      // ofc-11  PO detail — click row, browse tabs, close
      // -----------------------------------------------------------------
      {
        id: 'ofc-11',
        name: 'View purchase order detail',
        execute: async (page: Page) => {
          try {
            const opened = await clickFirstTableRow(page);
            if (opened) {
              for (const tab of ['Lines', 'Receiving', 'Activity']) {
                try {
                  const tabEl = page.locator('[role="tab"], .tab', { hasText: tab }).first();
                  if (await tabEl.isVisible({ timeout: 1_500 }).catch(() => false)) {
                    await tabEl.click();
                    await page.waitForTimeout(randomDelay(500, 1_000));
                  }
                } catch { /* tab may not exist */ }
              }
              await closeDetailOrDialog(page);
            }
          } catch {
            // Non-critical
          }
        },
      },

      // -----------------------------------------------------------------
      // ofc-12  Vendors — browse list, sort by name
      // -----------------------------------------------------------------
      {
        id: 'ofc-12',
        name: 'Browse vendor list',
        execute: async (page: Page) => {
          try {
            await page.goto('/vendors', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForSelector('app-data-table', { timeout: ELEMENT_TIMEOUT });
            await page.waitForTimeout(randomDelay(800, 1_500));

            try { await sortByColumn(page, 'Name'); } catch { /* non-critical */ }
            await page.waitForTimeout(randomDelay(400, 800));
            await scrollTable(page);
          } catch {
            // Non-critical
          }
        },
      },

      // -----------------------------------------------------------------
      // ofc-13  Vendor detail — click row, view, close
      // -----------------------------------------------------------------
      {
        id: 'ofc-13',
        name: 'View vendor detail',
        execute: async (page: Page) => {
          try {
            const opened = await clickFirstTableRow(page);
            if (opened) {
              await page.waitForTimeout(randomDelay(800, 1_500));
              await closeDetailOrDialog(page);
            }
          } catch {
            // Non-critical
          }
        },
      },

      // -----------------------------------------------------------------
      // ofc-14  Invoices — browse list, sort by status
      // -----------------------------------------------------------------
      {
        id: 'ofc-14',
        name: 'Browse invoice list',
        execute: async (page: Page) => {
          try {
            await page.goto('/invoices', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForSelector('app-data-table', { timeout: ELEMENT_TIMEOUT });
            await page.waitForTimeout(randomDelay(800, 1_500));

            try { await sortByColumn(page, 'Status'); } catch { /* non-critical */ }
            await page.waitForTimeout(randomDelay(400, 800));
            await scrollTable(page);
          } catch {
            // Non-critical
          }
        },
      },

      // -----------------------------------------------------------------
      // ofc-15  Invoice detail — click row, view, close
      // -----------------------------------------------------------------
      {
        id: 'ofc-15',
        name: 'View invoice detail',
        execute: async (page: Page) => {
          try {
            const opened = await clickFirstTableRow(page);
            if (opened) {
              await page.waitForTimeout(randomDelay(1_000, 2_000));
              await closeDetailOrDialog(page);
            }
          } catch {
            // Non-critical
          }
        },
      },

      // -----------------------------------------------------------------
      // ofc-16  Payments — browse payment list
      // -----------------------------------------------------------------
      {
        id: 'ofc-16',
        name: 'Browse payment list',
        execute: async (page: Page) => {
          try {
            await page.goto('/payments', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForSelector('app-data-table', { timeout: ELEMENT_TIMEOUT });
            await page.waitForTimeout(randomDelay(800, 1_500));

            await sortRandomColumn(page);
            await scrollTable(page);
          } catch {
            // Non-critical
          }
        },
      },

      // -----------------------------------------------------------------
      // ofc-17  Shipments — browse list, sort by status
      // -----------------------------------------------------------------
      {
        id: 'ofc-17',
        name: 'Browse shipment list',
        execute: async (page: Page) => {
          try {
            await page.goto('/shipments', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForSelector('app-data-table', { timeout: ELEMENT_TIMEOUT });
            await page.waitForTimeout(randomDelay(800, 1_500));

            try { await sortByColumn(page, 'Status'); } catch { /* non-critical */ }
            await page.waitForTimeout(randomDelay(400, 800));
          } catch {
            // Non-critical
          }
        },
      },

      // -----------------------------------------------------------------
      // ofc-18  Shipment detail — click row, view, close
      // -----------------------------------------------------------------
      {
        id: 'ofc-18',
        name: 'View shipment detail',
        execute: async (page: Page) => {
          try {
            const opened = await clickFirstTableRow(page);
            if (opened) {
              await page.waitForTimeout(randomDelay(800, 1_500));
              await closeDetailOrDialog(page);
            }
          } catch {
            // Non-critical
          }
        },
      },

      // -----------------------------------------------------------------
      // ofc-19  CREATE RFQ
      // -----------------------------------------------------------------
      {
        id: 'ofc-19',
        name: 'Create a new RFQ',
        execute: async (page: Page) => {
          try {
            await page.goto('/purchasing', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForTimeout(randomDelay(500, 1_000));

            const newRfqBtn = page.locator('[data-testid="new-rfq-btn"]').first();
            await newRfqBtn.waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });
            await newRfqBtn.click();
            await page.waitForTimeout(randomDelay(400, 800));

            await waitForDialog(page);

            // Fill part via entity picker (optional — RFQ may allow free-text)
            const partTerms = ['Aluminum', 'Steel', 'Brass', 'Fastener', 'Rod', 'Sheet'];
            for (const pt of partTerms) {
              if (await fillEntityPicker(page, 'rfq-part', pt)) break;
            }

            await page.waitForTimeout(randomDelay(200, 400));

            // Fill quantity
            try {
              await fillByTestId(page, 'rfq-quantity', String(randomInt(50, 1000)));
            } catch { /* qty may differ */ }

            // Fill required date
            try {
              await fillDateByTestId(page, 'rfq-required-date', randomDate(14, 30));
            } catch { /* date optional */ }

            // Fill response deadline
            if (maybe(0.6)) {
              try {
                await fillDateByTestId(page, 'rfq-response-deadline', randomDate(5, 10));
              } catch { /* optional */ }
            }

            // Fill description
            try {
              const descWrapper = page.locator('[data-testid="rfq-description"]');
              const textarea = descWrapper.locator('textarea').first();
              if (await textarea.isVisible({ timeout: 2_000 }).catch(() => false)) {
                await textarea.click();
                await textarea.fill(randomPick(RFQ_DESCRIPTIONS));
                await page.waitForTimeout(randomDelay(200, 400));
              } else {
                await fillByTestId(page, 'rfq-description', randomPick(RFQ_DESCRIPTIONS));
              }
            } catch { /* description optional */ }

            // Fill special instructions
            if (maybe(0.5)) {
              try {
                const instrWrapper = page.locator('[data-testid="rfq-special-instructions"]');
                const textarea = instrWrapper.locator('textarea').first();
                if (await textarea.isVisible({ timeout: 2_000 }).catch(() => false)) {
                  const instructions = randomPick(RFQ_INSTRUCTIONS);
                  if (instructions) {
                    await textarea.click();
                    await textarea.fill(instructions);
                    await page.waitForTimeout(randomDelay(200, 400));
                  }
                }
              } catch { /* instructions optional */ }
            }

            await page.waitForTimeout(randomDelay(300, 600));

            // Save
            await clickSaveButton(page, 'rfq-save-btn');
            await page.waitForTimeout(randomDelay(500, 1_000));
          } catch {
            await safeCloseDialog(page);
          }
        },
      },

      // -----------------------------------------------------------------
      // ofc-20  Purchasing/RFQ — browse RFQ list
      // -----------------------------------------------------------------
      {
        id: 'ofc-20',
        name: 'Browse RFQ list',
        execute: async (page: Page) => {
          try {
            await page.goto('/purchasing', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForSelector('app-data-table', { timeout: ELEMENT_TIMEOUT });
            await page.waitForTimeout(randomDelay(800, 1_500));

            await sortRandomColumn(page);
            await scrollTable(page);
          } catch {
            // Non-critical
          }
        },
      },

      // -----------------------------------------------------------------
      // ofc-21  Customer Returns — browse list
      // -----------------------------------------------------------------
      {
        id: 'ofc-21',
        name: 'Browse customer returns',
        execute: async (page: Page) => {
          try {
            await page.goto('/customer-returns', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForSelector('app-data-table, app-empty-state, .page-loading', { timeout: ELEMENT_TIMEOUT });
            await page.waitForTimeout(randomDelay(800, 1_500));

            await scrollTable(page);
          } catch {
            // Page may not exist or be empty — non-critical
          }
        },
      },

      // -----------------------------------------------------------------
      // ofc-22  Chat — send office update message
      // -----------------------------------------------------------------
      {
        id: 'ofc-22',
        name: 'Send office update in chat',
        execute: async (page: Page) => {
          try {
            await page.goto('/chat', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForTimeout(randomDelay(800, 1_500));

            // Select first visible chat room
            const rooms = page.locator('.chat-room, .room-item, [class*="room"]').first();
            if (await rooms.isVisible({ timeout: 5_000 }).catch(() => false)) {
              await rooms.click();
              await page.waitForTimeout(randomDelay(500, 1_000));
            }

            // Type and send a message
            const msgInput = page.locator(
              '[data-testid="chat-message-input"] input, [data-testid="chat-message-input"] textarea, textarea[placeholder*="message" i]',
            ).first();
            if (await msgInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
              await msgInput.click();
              await msgInput.fill(randomPick(CHAT_MESSAGES));
              await page.waitForTimeout(randomDelay(300, 600));

              const sendBtn = page.locator('[data-testid="chat-send-btn"]').first();
              if (await sendBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
                await sendBtn.click();
              } else {
                await page.keyboard.press('Enter');
              }
              await page.waitForTimeout(randomDelay(500, 1_000));
            }
          } catch {
            // Chat non-critical
          }
        },
      },

      // -----------------------------------------------------------------
      // ofc-23  Time tracking — create manual entry (Administrative)
      // -----------------------------------------------------------------
      {
        id: 'ofc-23',
        name: 'Create manual time entry',
        execute: async (page: Page) => {
          try {
            await page.goto('/time-tracking', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForTimeout(randomDelay(500, 1_000));

            const manualBtn = page.locator('[data-testid="manual-entry-btn"]').first();
            await manualBtn.waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });
            await manualBtn.click();
            await page.waitForTimeout(randomDelay(400, 800));

            await waitForDialog(page);

            // Fill date (today or recent)
            try {
              await fillDateByTestId(page, 'time-entry-date', randomDate(-3, 3));
            } catch { /* date may be pre-filled */ }

            // Select category
            try {
              await selectByTestId(page, 'time-entry-category', 'Administrative');
            } catch {
              // Try clicking first available option
              try {
                const catWrapper = page.locator('[data-testid="time-entry-category"]');
                const select = catWrapper.locator('mat-select').first();
                if (await select.isVisible({ timeout: 2_000 }).catch(() => false)) {
                  await select.click();
                  await page.waitForTimeout(300);
                  const option = page.locator('.cdk-overlay-container mat-option').first();
                  if (await option.isVisible({ timeout: 2_000 }).catch(() => false)) {
                    await option.click();
                  }
                }
              } catch { /* category selection failed */ }
            }

            // Fill hours and minutes
            try {
              await fillByTestId(page, 'time-entry-hours', String(randomInt(1, 4)));
            } catch { /* hours field may differ */ }

            try {
              await fillByTestId(page, 'time-entry-minutes', String(randomPick([0, 15, 30, 45])));
            } catch { /* minutes field may differ */ }

            // Fill notes
            try {
              const notesWrapper = page.locator('[data-testid="time-entry-notes"]');
              const textarea = notesWrapper.locator('textarea').first();
              if (await textarea.isVisible({ timeout: 2_000 }).catch(() => false)) {
                await textarea.click();
                await textarea.fill(randomPick(TIME_ENTRY_NOTES));
              } else {
                await fillByTestId(page, 'time-entry-notes', randomPick(TIME_ENTRY_NOTES));
              }
            } catch { /* notes optional */ }

            await page.waitForTimeout(randomDelay(300, 600));

            // Save
            await clickSaveButton(page, 'time-entry-save-btn');
            await page.waitForTimeout(randomDelay(500, 1_000));
          } catch {
            await safeCloseDialog(page);
          }
        },
      },

      // -----------------------------------------------------------------
      // ofc-24  Expenses — create expense (office supplies/postage)
      // -----------------------------------------------------------------
      {
        id: 'ofc-24',
        name: 'Create an office expense',
        execute: async (page: Page) => {
          try {
            await page.goto('/expenses', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForTimeout(randomDelay(500, 1_000));

            const newExpBtn = page.locator('[data-testid="new-expense-btn"]').first();
            await newExpBtn.waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });
            await newExpBtn.click();
            await page.waitForTimeout(randomDelay(400, 800));

            await waitForDialog(page);

            // Fill amount (office expenses are typically small)
            try {
              await fillByTestId(page, 'expense-amount', randomAmount(5, 200));
            } catch { /* amount field may differ */ }

            // Fill date
            try {
              await fillDateByTestId(page, 'expense-date', randomDate(-7, 7));
            } catch { /* date may be pre-filled */ }

            // Select category
            try {
              const category = randomPick(EXPENSE_CATEGORIES);
              const catWrapper = page.locator('[data-testid="expense-category"]');
              const hasSelect = await catWrapper.locator('mat-select').count();
              if (hasSelect > 0) {
                await catWrapper.locator('mat-select').first().click();
                await page.waitForTimeout(300);
                const option = page.locator('.cdk-overlay-container mat-option', { hasText: category }).first();
                if (await option.isVisible({ timeout: 3_000 }).catch(() => false)) {
                  await option.click();
                } else {
                  const firstOption = page.locator('.cdk-overlay-container mat-option').first();
                  if (await firstOption.isVisible({ timeout: 2_000 }).catch(() => false)) {
                    await firstOption.click();
                  }
                }
                await page.waitForTimeout(300);
              } else {
                await fillEntityPicker(page, 'expense-category', category);
              }
            } catch { /* category optional */ }

            // Fill description
            try {
              const description = randomPick(EXPENSE_DESCRIPTIONS);
              const descWrapper = page.locator('[data-testid="expense-description"]');
              const textarea = descWrapper.locator('textarea').first();
              if (await textarea.isVisible({ timeout: 2_000 }).catch(() => false)) {
                await textarea.click();
                await textarea.fill(description);
              } else {
                await fillByTestId(page, 'expense-description', description);
              }
              await page.waitForTimeout(randomDelay(200, 400));
            } catch { /* description optional */ }

            await page.waitForTimeout(randomDelay(300, 600));

            // Save
            await clickSaveButton(page, 'expense-save-btn');
            await page.waitForTimeout(randomDelay(500, 1_000));
          } catch {
            await safeCloseDialog(page);
          }
        },
      },

      // -----------------------------------------------------------------
      // ofc-25  Leads — browse lead list
      // -----------------------------------------------------------------
      {
        id: 'ofc-25',
        name: 'Browse lead list',
        execute: async (page: Page) => {
          try {
            await page.goto('/leads', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForSelector('app-data-table', { timeout: ELEMENT_TIMEOUT });
            await page.waitForTimeout(randomDelay(800, 1_500));

            try { await sortByColumn(page, 'Status'); } catch { /* non-critical */ }
            await page.waitForTimeout(randomDelay(400, 800));

            // Click a lead to view detail
            const opened = await clickFirstTableRow(page);
            if (opened) {
              await page.waitForTimeout(randomDelay(600, 1_200));
              await closeDetailOrDialog(page);
            }
          } catch {
            // Non-critical
          }
        },
      },

      // -----------------------------------------------------------------
      // ofc-26  Reports — view Revenue report, then AR Aging
      // -----------------------------------------------------------------
      {
        id: 'ofc-26',
        name: 'View Revenue and AR Aging reports',
        execute: async (page: Page) => {
          try {
            await page.goto('/reports', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForTimeout(randomDelay(800, 1_500));

            // Try to find and click Revenue report
            const revenueLink = page.locator('a, button, .report-card, [class*="report"]', { hasText: /revenue/i }).first();
            if (await revenueLink.isVisible({ timeout: 5_000 }).catch(() => false)) {
              await revenueLink.click();
              await page.waitForTimeout(randomDelay(1_500, 3_000));

              // Go back to reports
              await page.goto('/reports', { waitUntil: 'load', timeout: NAV_TIMEOUT });
              await page.waitForTimeout(randomDelay(500, 1_000));
            }

            // Try to find and click AR Aging report
            const arLink = page.locator('a, button, .report-card, [class*="report"]', { hasText: /aging|ar/i }).first();
            if (await arLink.isVisible({ timeout: 5_000 }).catch(() => false)) {
              await arLink.click();
              await page.waitForTimeout(randomDelay(1_500, 3_000));
            }
          } catch {
            // Reports page non-critical
          }
        },
      },

      // -----------------------------------------------------------------
      // ofc-27  Reports — view Quote-to-Close report
      // -----------------------------------------------------------------
      {
        id: 'ofc-27',
        name: 'View Quote-to-Close report',
        execute: async (page: Page) => {
          try {
            await page.goto('/reports', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForTimeout(randomDelay(800, 1_500));

            const quoteReport = page.locator('a, button, .report-card, [class*="report"]', { hasText: /quote.*close|conversion/i }).first();
            if (await quoteReport.isVisible({ timeout: 5_000 }).catch(() => false)) {
              await quoteReport.click();
              await page.waitForTimeout(randomDelay(1_500, 3_000));
            }
          } catch {
            // Non-critical
          }
        },
      },

      // -----------------------------------------------------------------
      // ofc-28  Parts — browse catalog (for quoting reference)
      // -----------------------------------------------------------------
      {
        id: 'ofc-28',
        name: 'Browse parts catalog',
        execute: async (page: Page) => {
          try {
            await page.goto('/parts', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForSelector('app-data-table', { timeout: ELEMENT_TIMEOUT });
            await page.waitForTimeout(randomDelay(800, 1_500));

            try { await sortByColumn(page, 'Part #'); } catch { /* non-critical */ }
            await page.waitForTimeout(randomDelay(400, 800));
            await scrollTable(page);

            // Click a part to check pricing/specs
            const opened = await clickFirstTableRow(page);
            if (opened) {
              await page.waitForTimeout(randomDelay(800, 1_500));
              await closeDetailOrDialog(page);
            }
          } catch {
            // Non-critical
          }
        },
      },

      // -----------------------------------------------------------------
      // ofc-29  Inventory — check stock (for order fulfillment)
      // -----------------------------------------------------------------
      {
        id: 'ofc-29',
        name: 'Check inventory stock levels',
        execute: async (page: Page) => {
          try {
            await page.goto('/inventory/stock', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForSelector('app-data-table, app-empty-state', { timeout: ELEMENT_TIMEOUT });
            await page.waitForTimeout(randomDelay(800, 1_500));

            await sortRandomColumn(page);
            await scrollTable(page);
          } catch {
            // Non-critical
          }
        },
      },

      // -----------------------------------------------------------------
      // ofc-30  Kanban — brief board review
      // -----------------------------------------------------------------
      {
        id: 'ofc-30',
        name: 'Review kanban board',
        execute: async (page: Page) => {
          try {
            await page.goto('/kanban', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForSelector('app-board-column, .board', { timeout: ELEMENT_TIMEOUT });
            await page.waitForTimeout(randomDelay(1_000, 2_000));

            // Scroll the board horizontally to see all columns
            const board = page.locator('.kanban-board, .board, .board__columns').first();
            if (await board.isVisible({ timeout: 2_000 }).catch(() => false)) {
              await board.evaluate((el) => el.scrollBy(600, 0));
              await page.waitForTimeout(randomDelay(500, 1_000));
              await board.evaluate((el) => el.scrollBy(-600, 0));
              await page.waitForTimeout(randomDelay(400, 800));
            }
          } catch {
            // Non-critical
          }
        },
      },

      // -----------------------------------------------------------------
      // ofc-31  Calendar — check schedule
      // -----------------------------------------------------------------
      {
        id: 'ofc-31',
        name: 'Check calendar schedule',
        execute: async (page: Page) => {
          try {
            await page.goto('/calendar', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForSelector('mat-calendar, .calendar, app-calendar', { timeout: ELEMENT_TIMEOUT });
            await page.waitForTimeout(randomDelay(1_000, 2_000));

            // Click next month
            const nextBtn = page.locator('button[aria-label*="next" i], .mat-calendar-next-button').first();
            if (await nextBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
              await nextBtn.click();
              await page.waitForTimeout(randomDelay(500, 1_000));
            }
          } catch {
            // Non-critical
          }
        },
      },

      // -----------------------------------------------------------------
      // ofc-32  Training — browse available modules
      // -----------------------------------------------------------------
      {
        id: 'ofc-32',
        name: 'Browse training modules',
        execute: async (page: Page) => {
          try {
            await page.goto('/training', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForTimeout(randomDelay(800, 1_500));

            // Scroll through modules
            const content = page.locator('.training, app-training, main').first();
            if (await content.isVisible({ timeout: 3_000 }).catch(() => false)) {
              await content.evaluate((el) => el.scrollBy(0, 400));
              await page.waitForTimeout(randomDelay(500, 1_000));
            }

            // Click a module to view details
            const moduleCard = page.locator('.module-card, .training-card, [class*="module"]').first();
            if (await moduleCard.isVisible({ timeout: 3_000 }).catch(() => false)) {
              await moduleCard.click();
              await page.waitForTimeout(randomDelay(800, 1_500));

              // Go back
              await page.goBack();
              await page.waitForTimeout(randomDelay(400, 800));
            }
          } catch {
            // Non-critical
          }
        },
      },

      // -----------------------------------------------------------------
      // ofc-33  Notifications — check and browse
      // -----------------------------------------------------------------
      {
        id: 'ofc-33',
        name: 'Check notifications',
        execute: async (page: Page) => {
          try {
            const bellBtn = page.locator('button[aria-label*="notification" i], button[aria-label*="Notification" i], .notification-bell').first();
            if (await bellBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
              await bellBtn.click();
              await page.waitForTimeout(randomDelay(800, 1_500));

              // Switch between notification tabs
              for (const tab of ['All', 'Alerts', 'Messages']) {
                try {
                  const tabEl = page.locator('[role="tab"], .tab', { hasText: tab }).first();
                  if (await tabEl.isVisible({ timeout: 1_500 }).catch(() => false)) {
                    await tabEl.click();
                    await page.waitForTimeout(randomDelay(400, 800));
                  }
                } catch { /* tab may not exist */ }
              }

              // Mark all read if button visible
              if (maybe(0.3)) {
                const markAllBtn = page.locator('button', { hasText: /mark.*read/i }).first();
                if (await markAllBtn.isVisible({ timeout: 1_500 }).catch(() => false)) {
                  await markAllBtn.click();
                  await page.waitForTimeout(randomDelay(300, 600));
                }
              }

              await page.keyboard.press('Escape');
              await page.waitForTimeout(randomDelay(300, 600));
            }
          } catch {
            // Non-critical
          }
        },
      },

      // -----------------------------------------------------------------
      // ofc-34  Account — review profile settings
      // -----------------------------------------------------------------
      {
        id: 'ofc-34',
        name: 'Review account profile',
        execute: async (page: Page) => {
          try {
            await page.goto('/account/profile', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForTimeout(randomDelay(1_000, 2_000));

            // Scroll through profile
            const content = page.locator('.account, app-account, main').first();
            if (await content.isVisible({ timeout: 3_000 }).catch(() => false)) {
              await content.evaluate((el) => el.scrollBy(0, 300));
              await page.waitForTimeout(randomDelay(500, 1_000));
            }

            // Maybe check customization tab
            if (maybe(0.4)) {
              try {
                await page.goto('/account/customization', { waitUntil: 'load', timeout: NAV_TIMEOUT });
                await page.waitForTimeout(randomDelay(800, 1_500));
              } catch { /* customization page optional */ }
            }
          } catch {
            // Non-critical
          }
        },
      },

      // -----------------------------------------------------------------
      // ofc-35  Return to dashboard — end of shift
      // -----------------------------------------------------------------
      {
        id: 'ofc-35',
        name: 'Return to dashboard',
        execute: async (page: Page) => {
          try {
            await page.goto('/dashboard', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForSelector('app-dashboard-widget, app-kpi-chip, .dashboard', { timeout: ELEMENT_TIMEOUT });
            await page.waitForTimeout(randomDelay(1_000, 2_000));
          } catch {
            // Dashboard may be slow — continue
          }
        },
      },
    ],
  };
}
