import type { Page } from 'playwright';
import type { Workflow } from '../orchestrator';
import { fillByTestId, selectByTestId, selectNthByTestId, fillDateByTestId, clickByTestId, dismissDraftRecoveryPrompt, clearAllDrafts, fillEntityPickerByTestId } from '../../lib/form.lib';
import { waitForAnySnackbar, dismissSnackbar } from '../../lib/snackbar.lib';
import { sortByColumn } from '../../lib/data-table.lib';
import { randomDelay, maybe, randomPick, randomInt, randomDate, randomAmount } from '../../lib/random.lib';

/**
 * Office/Sales worker workflow — the broadest role in the app.
 * Covers the full quote-to-cash pipeline: customers, quotes (create),
 * sales orders, purchase orders (create), vendors, invoices, payments,
 * shipments, RFQs (create), customer returns, expenses (create),
 * time tracking, chat, reports, parts catalog, inventory, kanban,
 * calendar, training, notifications, and account settings.
 *
 * 44 steps, with quote creation and PO creation as the star steps.
 */

const NAV_TIMEOUT = 15_000;
const ELEMENT_TIMEOUT = 15_000;

// ---------------------------------------------------------------------------
// Data pools
// ---------------------------------------------------------------------------

const CUSTOMERS = ['Acme Corp', 'Apex Manufacturing', 'Quantum Dynamics', 'Meridian Systems'];

const VENDORS = ['Acme Metals Supply', 'ColorCoat Services', 'National Fastener Corp', 'Pacific Tool Supply', 'Precision Polymers Inc'];

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

const SO_NOTES = [
  'Standard order — ship complete, no partials',
  'Customer PO attached — reference on all shipments',
  'Rush order — expedite through production',
  'Blanket release — monthly shipments per schedule',
  'Hold for customer approval before production start',
  'Drop ship to end customer — address on PO',
];

const INVOICE_LINE_DESCRIPTIONS = [
  'Machining services', 'Assembly labor', 'Material — aluminum plate',
  'Engineering consultation', 'Tooling setup charge', 'Quality inspection',
  'Surface treatment — anodize', 'Packaging and crating',
];

const PAYMENT_NOTES = [
  'Payment received — deposited same day',
  'Partial payment — balance due next month',
  'Final payment on account — balance cleared',
  'Payment per terms — Net 30',
  'Early payment — 2% discount applied',
  'Wire transfer confirmed by bank',
];

const RETURN_REASONS = [
  'Dimensional out of spec', 'Surface finish defect',
  'Wrong material delivered', 'Quantity shortage',
  'Cosmetic damage in transit', 'Failed incoming QC inspection',
];

const RETURN_NOTES = [
  'Customer reported issue on receipt — photos attached',
  'Material cert mismatch — need replacement ASAP',
  'Partial lot rejection — 15 of 100 units affected',
  'Repackage and reship requested by customer',
  'Credit memo to be issued after inspection',
];

const SHIPMENT_CARRIERS = ['UPS', 'FedEx', 'USPS', 'DHL', 'Freight'];

const SHIPMENT_NOTES = [
  'Packed per customer spec — double-boxed',
  'Fragile items — handle with care labels applied',
  'Signature required on delivery',
  'LTL freight — dock delivery only',
  'Same-day pickup scheduled with carrier',
];

const VENDOR_COMPANIES = [
  'Superior Metal Works', 'Allied Industrial Supply', 'Titan Fabrication Co',
  'Keystone Components LLC', 'Summit Precision Parts', 'ProSource Materials',
];

const VENDOR_CONTACTS = [
  'Mike Reynolds', 'Sarah Chen', 'James Peterson', 'Lisa Martinez',
  'Tom Anderson', 'Rachel Kim',
];

const RECURRING_DESCRIPTIONS = ['Cloud hosting', 'Software license', 'Cleaning service', 'Equipment lease', 'Internet service'];

// Must match seed data in SeedData.Essential.cs (expense_category group)
const EXPENSE_CATEGORIES = ['Office Supplies', 'Shipping', 'Travel', 'Fuel', 'Other', 'Materials'];

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
        category: 'browse',
        tags: ['dashboard'],
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
        category: 'browse',
        tags: ['customers'],
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
        category: 'browse',
        tags: ['customers'],
        execute: async (page: Page) => {
          try {
            // Navigate to customers list first (self-contained)
            await page.goto('/customers', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForSelector('app-data-table', { timeout: ELEMENT_TIMEOUT }).catch(() => {});
            await page.waitForTimeout(randomDelay(500, 1_000));

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
        category: 'create',
        tags: ['quotes'],
        execute: async (page: Page) => {
          try {
            await page.goto('/quotes', { waitUntil: 'load', timeout: NAV_TIMEOUT });

            // Wait for New Quote button to appear
            const newQuoteBtn = page.locator('[data-testid="new-quote-btn"]').first();
            await newQuoteBtn.waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });
            await page.waitForTimeout(randomDelay(500, 1_000));
            await newQuoteBtn.click();
            await page.waitForTimeout(1000);

            // Wait for dialog form fields (may be inline or CDK overlay)
            await page.locator('[data-testid="quote-customer"]')
              .waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });

            // Select customer via mat-select (app-select component)
            const customer = randomPick(CUSTOMERS);
            await selectByTestId(page, 'quote-customer', customer);

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

            // Add a quote line: fill part + qty + price, THEN click Add
            try {
              // Fill part via autocomplete — type part prefix to trigger options
              const partInput = page.locator('[data-testid="quote-line-part"] input').first();
              if (await partInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
                await partInput.click({ force: true });
                await partInput.pressSequentially('P-100', { delay: 50 });
                await page.waitForTimeout(800);
                const firstOpt = page.locator('mat-option').first();
                if (await firstOpt.isVisible({ timeout: 3_000 }).catch(() => false)) {
                  await firstOpt.click();
                  await page.waitForTimeout(300);
                }
              }

              // Fill quantity and price
              await fillByTestId(page, 'quote-line-qty', String(randomInt(5, 100)));
              await fillByTestId(page, 'quote-line-price', randomAmount(25, 2500));
              await page.waitForTimeout(300);

              // Click Add Line button (submits the line form row)
              const addLineBtn = page.locator('[data-testid="quote-add-line-btn"]').first();
              if (await addLineBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
                if (!await addLineBtn.isDisabled()) {
                  await addLineBtn.click();
                  await page.waitForTimeout(500);
                }
              }
            } catch {
              // Line items may fail — quote still saveable if other lines exist
            }

            // Save the quote
            await clickSaveButton(page, 'quote-save-btn');
            return 'quote';
          } catch (err) {
            const url = page.url();
            console.log(`[office] ofc-04 FAILED (url=${url}): ${err instanceof Error ? err.message.slice(0, 120) : err}`);
            await page.screenshot({ path: 'e2e/stress/errors/ofc-04-fail.png' }).catch(() => {});
            await safeCloseDialog(page);
          }
        },
      },

      // -----------------------------------------------------------------
      // ofc-23  Time tracking — create manual entry (Administrative)
      // -----------------------------------------------------------------
      {
        id: 'ofc-05',  // originally ofc-23
        name: 'Create manual time entry',
        category: 'create',
        tags: ['time-tracking'],
        execute: async (page: Page) => {
          try {
            await page.goto('/time-tracking', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForTimeout(randomDelay(500, 1_000));

            const manualBtn = page.locator('[data-testid="manual-entry-btn"]').first();
            await manualBtn.waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });
            await manualBtn.click();
            await page.waitForTimeout(randomDelay(400, 800));

            // Wait for dialog form fields
            await page.locator('[data-testid="time-entry-date"], [data-testid="time-entry-category"]').first()
              .waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });

            // Fill date (today or recent)
            try {
              await fillDateByTestId(page, 'time-entry-date', randomDate(-3, 3));
            } catch { /* date may be pre-filled */ }

            // Select category
            try {
              await selectByTestId(page, 'time-entry-category', 'Admin');
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
            return 'time-entry';
          } catch {
            await safeCloseDialog(page);
          }
        },
      },

      // -----------------------------------------------------------------
      // ofc-24  Expenses — create expense (office supplies/postage)
      // -----------------------------------------------------------------
      {
        id: 'ofc-06',  // originally ofc-24
        name: 'Create an office expense',
        category: 'create',
        tags: ['expenses'],
        execute: async (page: Page) => {
          try {
            await page.goto('/expenses', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForTimeout(randomDelay(500, 1_000));

            const newExpBtn = page.locator('[data-testid="new-expense-btn"]').first();
            await newExpBtn.waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });
            await newExpBtn.click();
            await page.waitForTimeout(randomDelay(400, 800));

            // Wait for dialog form fields
            await page.locator('[data-testid="expense-amount"]')
              .waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });

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
            return 'expense';
          } catch {
            await safeCloseDialog(page);
          }
        },
      },

      // -----------------------------------------------------------------
      // ofc-09  CREATE PURCHASE ORDER  (star step)
      // -----------------------------------------------------------------
      {
        id: 'ofc-07',  // originally ofc-09
        name: 'Create a new purchase order',
        category: 'create',
        tags: ['purchase-orders'],
        execute: async (page: Page) => {
          try {
            await page.goto('/purchase-orders', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForTimeout(randomDelay(1_000, 2_000));

            // Clear drafts from IndexedDB + dismiss any recovery prompt that blocks clicks
            await clearAllDrafts(page);
            await dismissDraftRecoveryPrompt(page);
            // Extra wait for any dialog animation to finish
            await page.waitForTimeout(500);
            // Press Escape as final fallback in case a dialog is still open
            await page.keyboard.press('Escape');
            await page.waitForTimeout(300);

            // Wait for loading overlay to clear before clicking
            await page.locator('.loading-overlay').waitFor({ state: 'hidden', timeout: ELEMENT_TIMEOUT }).catch(() => {});

            // Click New PO — use DOM click to bypass CDK overlay/inert blocking
            const newPoBtn = page.locator('[data-testid="new-po-btn"]').first();
            await newPoBtn.waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });
            await page.evaluate(() => {
              const btn = document.querySelector('[data-testid="new-po-btn"]') as HTMLElement;
              if (btn) btn.click();
            });
            await page.waitForTimeout(randomDelay(600, 1_200));

            // Wait for dialog form fields to appear
            await page.locator('[data-testid="po-vendor"]')
              .waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });

            // Select vendor via mat-select (app-select component)
            await selectByTestId(page, 'po-vendor', randomPick(VENDORS));

            await page.waitForTimeout(randomDelay(300, 600));

            // Optionally link to a job
            if (maybe(0.3)) {
              try {
                await fillByTestId(page, 'po-job-id', String(randomInt(1, 50)));
              } catch { /* job ID field may not exist */ }
            }

            // Add a PO line: fill part + qty + price, THEN click Add
            try {
              const poPartInput = page.locator('[data-testid="po-line-part"] input').first();
              if (await poPartInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
                await poPartInput.click({ force: true });
                await poPartInput.pressSequentially('M-00', { delay: 50 });
                await page.waitForTimeout(800);
                const firstPart = page.locator('mat-option').first();
                if (await firstPart.isVisible({ timeout: 3_000 }).catch(() => false)) {
                  await firstPart.click();
                  await page.waitForTimeout(300);
                }
              }

              await fillByTestId(page, 'po-line-qty', String(randomInt(10, 500)));
              await fillByTestId(page, 'po-line-price', randomAmount(5, 500));
              await page.waitForTimeout(300);

              const addLineBtn = page.locator('[data-testid="po-add-line-btn"]').first();
              if (await addLineBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
                if (!await addLineBtn.isDisabled()) {
                  await addLineBtn.click();
                  await page.waitForTimeout(500);
                }
              }
            } catch {
              // Line items may fail
            }

            // Save
            await clickSaveButton(page, 'po-save-btn');
            return 'purchase-order';
          } catch (err) {
            const url = page.url();
            const msg = err instanceof Error ? err.message.split('\n')[0].slice(0, 150) : String(err);
            console.log(`[office] ofc-07 FAILED (url=${url}): ${msg}`);
            try { await page.screenshot({ path: 'e2e/stress/errors/ofc-07-fail.png' }); } catch {}
            await safeCloseDialog(page);
          }
        },
      },

      // -----------------------------------------------------------------
      // ofc-05  Quotes — browse list, sort by status
      // -----------------------------------------------------------------
      {
        id: 'ofc-08',  // originally ofc-05
        name: 'Browse quote list',
        category: 'browse',
        tags: ['quotes'],
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
        id: 'ofc-09',  // originally ofc-06
        name: 'View quote detail',
        category: 'browse',
        tags: ['quotes'],
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
      // ofc-10  Sales Orders — CREATE a sales order
      // -----------------------------------------------------------------
      {
        id: 'ofc-10',
        name: 'Create a sales order',
        category: 'create',
        tags: ['sales-orders'],
        execute: async (page: Page) => {
          try {
            await page.goto('/sales-orders', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForTimeout(randomDelay(500, 1_000));

            const newSoBtn = page.locator('[data-testid="new-so-btn"]').first();
            await newSoBtn.waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });
            await newSoBtn.click();
            await page.waitForTimeout(randomDelay(600, 1_200));

            // Wait for dialog
            await page.locator('[data-testid="so-customer"]')
              .waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });

            // Select first available customer
            await selectNthByTestId(page, 'so-customer', 0);
            await page.waitForTimeout(randomDelay(300, 600));

            // Fill tax rate
            try {
              await fillByTestId(page, 'so-tax-rate', randomPick(['6.25', '7.0', '7.5', '8.0']));
            } catch { /* optional */ }
            await page.waitForTimeout(randomDelay(200, 400));

            // Fill notes
            try {
              const notesWrapper = page.locator('[data-testid="so-notes"]');
              const textarea = notesWrapper.locator('textarea').first();
              if (await textarea.isVisible({ timeout: 2_000 }).catch(() => false)) {
                await textarea.click();
                await textarea.fill(randomPick(SO_NOTES));
                await page.waitForTimeout(randomDelay(200, 400));
              }
            } catch { /* optional */ }

            // Add a line item
            try {
              await clickByTestId(page, 'so-add-line-btn');
              await page.waitForTimeout(randomDelay(300, 600));
              await fillByTestId(page, 'so-line-qty', String(randomInt(5, 50)));
              await page.waitForTimeout(randomDelay(200, 400));
              await fillByTestId(page, 'so-line-price', randomPick(['25.00', '50.00', '75.00', '100.00']));
              await page.waitForTimeout(randomDelay(200, 400));
            } catch { /* line items may fail */ }

            // Save
            await clickSaveButton(page, 'so-save-btn');
            return 'sales-order';
          } catch (err) {
            const url = page.url();
            console.log(`[office] ofc-10 FAILED (url=${url}): ${err instanceof Error ? err.message.slice(0, 120) : err}`);
            await page.screenshot({ path: 'e2e/stress/errors/ofc-10-fail.png' }).catch(() => {});
            await safeCloseDialog(page);
          }
        },
      },

      // -----------------------------------------------------------------
      // ofc-08  Sales Order detail — click row, browse tabs, close
      // -----------------------------------------------------------------
      {
        id: 'ofc-11',  // originally ofc-08
        name: 'View sales order detail',
        category: 'browse',
        tags: ['sales-orders'],
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
      // ofc-10  Purchase Orders — browse list, sort by status
      // -----------------------------------------------------------------
      {
        id: 'ofc-12',  // originally ofc-10
        name: 'Browse purchase order list',
        category: 'browse',
        tags: ['purchase-orders'],
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
        id: 'ofc-13',  // originally ofc-11
        name: 'View purchase order detail',
        category: 'browse',
        tags: ['purchase-orders'],
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
        id: 'ofc-14',  // originally ofc-12
        name: 'Browse vendor list',
        category: 'browse',
        tags: ['vendors'],
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
        id: 'ofc-15',  // originally ofc-13
        name: 'View vendor detail',
        category: 'browse',
        tags: ['vendors'],
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
      // ofc-16  Invoices — CREATE an invoice
      // -----------------------------------------------------------------
      {
        id: 'ofc-16',
        name: 'Create an invoice',
        category: 'create',
        tags: ['invoices'],
        execute: async (page: Page) => {
          try {
            await page.goto('/invoices', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForTimeout(randomDelay(500, 1_000));

            const newInvBtn = page.locator('[data-testid="new-invoice-btn"]').first();
            await newInvBtn.waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });
            await newInvBtn.click();
            await page.waitForTimeout(randomDelay(600, 1_200));

            // Wait for dialog
            await page.locator('[data-testid="invoice-customer"]')
              .waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });

            // Select first available customer
            await selectNthByTestId(page, 'invoice-customer', 0);
            await page.waitForTimeout(randomDelay(300, 600));

            // Fill invoice date (today)
            const today = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
            try {
              await fillDateByTestId(page, 'invoice-date', today);
            } catch { /* may be pre-filled */ }
            await page.waitForTimeout(randomDelay(200, 400));

            // Fill due date (30 days out)
            const dueDate = new Date(Date.now() + 30 * 86400000).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
            try {
              await fillDateByTestId(page, 'invoice-due-date', dueDate);
            } catch { /* optional */ }
            await page.waitForTimeout(randomDelay(200, 400));

            // Fill tax rate
            try {
              await fillByTestId(page, 'invoice-tax-rate', randomPick(['6.25', '7.0', '7.5', '8.0']));
            } catch { /* optional */ }
            await page.waitForTimeout(randomDelay(200, 400));

            // Add a line item
            try {
              await clickByTestId(page, 'invoice-add-line-btn');
              await page.waitForTimeout(randomDelay(300, 600));

              // Fill line description
              try {
                const descWrapper = page.locator('[data-testid="invoice-line-desc"]');
                const input = descWrapper.locator('input, textarea').first();
                if (await input.isVisible({ timeout: 2_000 }).catch(() => false)) {
                  await input.click();
                  await input.fill(randomPick(INVOICE_LINE_DESCRIPTIONS));
                }
              } catch { /* optional */ }
              await page.waitForTimeout(randomDelay(200, 400));

              await fillByTestId(page, 'invoice-line-qty', String(randomInt(1, 20)));
              await page.waitForTimeout(randomDelay(200, 400));
              await fillByTestId(page, 'invoice-line-price', randomPick(['50.00', '75.00', '125.00', '200.00']));
              await page.waitForTimeout(randomDelay(200, 400));
            } catch { /* line items may fail */ }

            // Save
            await clickSaveButton(page, 'invoice-save-btn');
            return 'invoice';
          } catch (err) {
            const url = page.url();
            console.log(`[office] ofc-16 FAILED (url=${url}): ${err instanceof Error ? err.message.slice(0, 120) : err}`);
            await page.screenshot({ path: 'e2e/stress/errors/ofc-16-fail.png' }).catch(() => {});
            await safeCloseDialog(page);
          }
        },
      },

      // -----------------------------------------------------------------
      // ofc-15  Invoice detail — click row, view, close
      // -----------------------------------------------------------------
      {
        id: 'ofc-17',  // originally ofc-15
        name: 'View invoice detail',
        category: 'browse',
        tags: ['invoices'],
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
      // ofc-18  Payments — RECORD a payment
      // -----------------------------------------------------------------
      {
        id: 'ofc-18',
        name: 'Record a payment',
        category: 'create',
        tags: ['payments'],
        execute: async (page: Page) => {
          try {
            await page.goto('/payments', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForTimeout(randomDelay(500, 1_000));

            const newPayBtn = page.locator('[data-testid="new-payment-btn"]').first();
            await newPayBtn.waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });
            await newPayBtn.click();
            await page.waitForTimeout(randomDelay(600, 1_200));

            // Wait for dialog
            await page.locator('[data-testid="payment-customer"]')
              .waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });

            // Select first available customer
            await selectNthByTestId(page, 'payment-customer', 0);
            await page.waitForTimeout(randomDelay(300, 600));

            // Select payment method
            try {
              await selectByTestId(page, 'payment-method', randomPick(['Check', 'ACH', 'Wire', 'Credit Card']));
            } catch { /* optional */ }
            await page.waitForTimeout(randomDelay(200, 400));

            // Fill amount
            try {
              await fillByTestId(page, 'payment-amount', randomPick(['500.00', '1000.00', '2500.00', '5000.00']));
            } catch { /* optional */ }
            await page.waitForTimeout(randomDelay(200, 400));

            // Fill payment date (today)
            const today = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
            try {
              await fillDateByTestId(page, 'payment-date', today);
            } catch { /* may be pre-filled */ }
            await page.waitForTimeout(randomDelay(200, 400));

            // Fill reference number
            try {
              await fillByTestId(page, 'payment-ref', `CHK-${randomInt(10000, 99999)}`);
            } catch { /* optional */ }
            await page.waitForTimeout(randomDelay(200, 400));

            // Fill notes
            try {
              const notesWrapper = page.locator('[data-testid="payment-notes"]');
              const textarea = notesWrapper.locator('textarea').first();
              if (await textarea.isVisible({ timeout: 2_000 }).catch(() => false)) {
                await textarea.click();
                await textarea.fill(randomPick(PAYMENT_NOTES));
              } else {
                await fillByTestId(page, 'payment-notes', randomPick(PAYMENT_NOTES));
              }
            } catch { /* optional */ }
            await page.waitForTimeout(randomDelay(200, 400));

            // Save
            await clickSaveButton(page, 'payment-save-btn');
            return 'payment';
          } catch (err) {
            const url = page.url();
            console.log(`[office] ofc-18 FAILED (url=${url}): ${err instanceof Error ? err.message.slice(0, 120) : err}`);
            await page.screenshot({ path: 'e2e/stress/errors/ofc-18-fail.png' }).catch(() => {});
            await safeCloseDialog(page);
          }
        },
      },

      // -----------------------------------------------------------------
      // ofc-17  Shipments — browse list, sort by status
      // -----------------------------------------------------------------
      {
        id: 'ofc-19',  // originally ofc-17
        name: 'Browse shipment list',
        category: 'browse',
        tags: ['shipments'],
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
        id: 'ofc-20',  // originally ofc-18
        name: 'View shipment detail',
        category: 'browse',
        tags: ['shipments'],
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
        id: 'ofc-21',  // originally ofc-19
        name: 'Create a new RFQ',
        category: 'create',
        tags: ['rfq'],
        execute: async (page: Page) => {
          try {
            await page.goto('/purchasing', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForTimeout(randomDelay(500, 1_000));

            const newRfqBtn = page.locator('[data-testid="new-rfq-btn"]').first();
            await newRfqBtn.waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });
            await newRfqBtn.click();
            await page.waitForTimeout(randomDelay(400, 800));

            // Wait for dialog form fields
            await page.locator('[data-testid="rfq-part"]')
              .waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });

            // Select part via mat-select — use part number prefix
            const partPrefixes = ['M-001', 'M-002', 'P-1001', 'P-1002', 'P-1003', 'P-1004', 'P-1005'];
            await selectByTestId(page, 'rfq-part', randomPick(partPrefixes));

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
            return 'rfq';
          } catch {
            await safeCloseDialog(page);
          }
        },
      },

      // -----------------------------------------------------------------
      // ofc-20  Purchasing/RFQ — browse RFQ list
      // -----------------------------------------------------------------
      {
        id: 'ofc-22',  // originally ofc-20
        name: 'Browse RFQ list',
        category: 'browse',
        tags: ['rfq'],
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
      // ofc-23  Customer Returns — CREATE a return
      // -----------------------------------------------------------------
      {
        id: 'ofc-23',
        name: 'Create customer return',
        category: 'create',
        tags: ['customer-returns'],
        execute: async (page: Page) => {
          try {
            await page.goto('/customer-returns', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForTimeout(randomDelay(500, 1_000));

            const newReturnBtn = page.locator('[data-testid="new-return-btn"]').first();
            await newReturnBtn.waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });
            await newReturnBtn.click();
            await page.waitForTimeout(randomDelay(600, 1_200));

            // Wait for dialog — look for any visible field
            await page.locator('[data-testid="return-customer"], [data-testid="return-reason"], [data-testid="return-date"], [data-testid="return-notes"]').first()
              .waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });

            // Fill required entity-pickers: customer and job
            let foundCustomer = await fillEntityPickerByTestId(page, 'return-customer', 'Acme');
            if (!foundCustomer) foundCustomer = await fillEntityPickerByTestId(page, 'return-customer', 'Apex');
            if (!foundCustomer) foundCustomer = await fillEntityPickerByTestId(page, 'return-customer', 'Quantum');
            if (!foundCustomer) {
              console.log('[office] ofc-23 no customers found for entity-picker — skipping return creation');
              await safeCloseDialog(page);
              return;
            }
            await page.waitForTimeout(randomDelay(200, 400));

            let foundJob = await fillEntityPickerByTestId(page, 'return-job', 'JOB');
            if (!foundJob) foundJob = await fillEntityPickerByTestId(page, 'return-job', '10');
            if (!foundJob) {
              console.log('[office] ofc-23 no jobs found for entity-picker — skipping return creation');
              await safeCloseDialog(page);
              return;
            }
            await page.waitForTimeout(randomDelay(200, 400));

            // Fill reason
            try {
              const reasonWrapper = page.locator('[data-testid="return-reason"]');
              const hasSelect = await reasonWrapper.locator('mat-select').count();
              if (hasSelect > 0) {
                await reasonWrapper.locator('mat-select').first().click();
                await page.waitForTimeout(300);
                const option = page.locator('.cdk-overlay-container mat-option').first();
                if (await option.isVisible({ timeout: 2_000 }).catch(() => false)) {
                  await option.click();
                }
                await page.waitForTimeout(300);
              } else {
                await fillByTestId(page, 'return-reason', randomPick(RETURN_REASONS));
              }
            } catch { /* optional */ }
            await page.waitForTimeout(randomDelay(200, 400));

            // Fill return date (today)
            const today = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
            try {
              await fillDateByTestId(page, 'return-date', today);
            } catch { /* may be pre-filled */ }
            await page.waitForTimeout(randomDelay(200, 400));

            // Fill notes
            try {
              const notesWrapper = page.locator('[data-testid="return-notes"]');
              const textarea = notesWrapper.locator('textarea').first();
              if (await textarea.isVisible({ timeout: 2_000 }).catch(() => false)) {
                await textarea.click();
                await textarea.fill(randomPick(RETURN_NOTES));
              } else {
                await fillByTestId(page, 'return-notes', randomPick(RETURN_NOTES));
              }
            } catch { /* optional */ }
            await page.waitForTimeout(randomDelay(200, 400));

            // Save
            await clickSaveButton(page, 'return-save-btn');
            return 'customer-return';
          } catch (err) {
            const url = page.url();
            console.log(`[office] ofc-23 FAILED (url=${url}): ${err instanceof Error ? err.message.slice(0, 120) : err}`);
            await page.screenshot({ path: 'e2e/stress/errors/ofc-23-fail.png' }).catch(() => {});
            await safeCloseDialog(page);
          }
        },
      },

      // -----------------------------------------------------------------
      // ofc-22  Chat — send office update message
      // -----------------------------------------------------------------
      {
        id: 'ofc-24',  // originally ofc-22
        name: 'Send office update in chat',
        category: 'chat',
        tags: ['chat'],
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
      // ofc-25  Leads — browse lead list
      // -----------------------------------------------------------------
      {
        id: 'ofc-25',
        name: 'Browse lead list',
        category: 'browse',
        tags: ['leads'],
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
        category: 'report',
        tags: ['reports'],
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
        category: 'report',
        tags: ['reports'],
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
        category: 'browse',
        tags: ['parts'],
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
        category: 'browse',
        tags: ['inventory'],
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
        category: 'browse',
        tags: ['kanban'],
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
        category: 'browse',
        tags: ['calendar'],
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
        category: 'browse',
        tags: ['training'],
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
        category: 'browse',
        tags: ['notifications'],
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
        category: 'browse',
        tags: ['account'],
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
      // ofc-36  Browse account pay stubs
      // -----------------------------------------------------------------
      {
        id: 'ofc-36',
        name: 'Browse account pay stubs',
        category: 'browse',
        tags: ['account', 'payroll'],
        execute: async (page: Page) => {
          try {
            await page.goto('/account/pay-stubs', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.locator('app-data-table, app-empty-state').first().waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT }).catch(() => {});
            await page.waitForTimeout(randomDelay(800, 1500));
            await page.mouse.wheel(0, Math.floor(Math.random() * 400) + 100);
            await page.waitForTimeout(randomDelay(500, 1000));
          } catch {
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // -----------------------------------------------------------------
      // ofc-37  Browse account tax documents
      // -----------------------------------------------------------------
      {
        id: 'ofc-37',
        name: 'Browse account tax documents',
        category: 'browse',
        tags: ['account', 'payroll'],
        execute: async (page: Page) => {
          try {
            await page.goto('/account/tax-documents', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.locator('app-data-table, app-empty-state').first().waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT }).catch(() => {});
            await page.waitForTimeout(randomDelay(800, 1500));
            await page.mouse.wheel(0, Math.floor(Math.random() * 400) + 100);
            await page.waitForTimeout(randomDelay(500, 1000));
          } catch {
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // -----------------------------------------------------------------
      // ofc-38  Browse account tax forms
      // -----------------------------------------------------------------
      {
        id: 'ofc-38',
        name: 'Browse account tax forms',
        category: 'browse',
        tags: ['account', 'compliance'],
        execute: async (page: Page) => {
          try {
            await page.goto('/account/tax-forms', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForTimeout(randomDelay(800, 1500));
            await page.mouse.wheel(0, Math.floor(Math.random() * 400) + 100);
            await page.waitForTimeout(randomDelay(500, 1000));
          } catch {
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // -----------------------------------------------------------------
      // ofc-39  Browse account security / MFA
      // -----------------------------------------------------------------
      {
        id: 'ofc-39',
        name: 'Browse account security / MFA',
        category: 'browse',
        tags: ['account', 'security'],
        execute: async (page: Page) => {
          try {
            await page.goto('/account/security', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForTimeout(randomDelay(800, 1500));
            await page.mouse.wheel(0, Math.floor(Math.random() * 400) + 100);
            await page.waitForTimeout(randomDelay(500, 1000));
          } catch {
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // -----------------------------------------------------------------
      // ofc-40  Browse recurring expenses
      // -----------------------------------------------------------------
      {
        id: 'ofc-40',
        name: 'Browse recurring expenses',
        category: 'browse',
        tags: ['expenses', 'recurring'],
        execute: async (page: Page) => {
          try {
            await page.goto('/expenses/upcoming', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.locator('app-data-table, app-empty-state').first().waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT }).catch(() => {});
            await page.waitForTimeout(randomDelay(800, 1500));
            await page.mouse.wheel(0, Math.floor(Math.random() * 400) + 100);
            await page.waitForTimeout(randomDelay(500, 1000));
          } catch {
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // -----------------------------------------------------------------
      // ofc-41  Use global search
      // -----------------------------------------------------------------
      {
        id: 'ofc-41',
        name: 'Use global search',
        category: 'search',
        tags: ['search', 'header'],
        execute: async (page: Page) => {
          try {
            await page.keyboard.press('Control+k');
            await page.waitForTimeout(randomDelay(500, 1000));
            const searchInput = page.locator('input[type="search"], .search-input, [placeholder*="Search"]').first();
            if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
              const terms = ['bracket', 'motor', 'seal', 'valve', 'flange', 'bolt'];
              await searchInput.fill(randomPick(terms));
              await page.waitForTimeout(randomDelay(1000, 2000));
            }
            await page.keyboard.press('Escape');
            await page.waitForTimeout(randomDelay(300, 600));
          } catch {
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // -----------------------------------------------------------------
      // ofc-42  Use report builder
      // -----------------------------------------------------------------
      {
        id: 'ofc-42',
        name: 'Use report builder',
        category: 'report',
        tags: ['reports', 'builder'],
        execute: async (page: Page) => {
          try {
            await page.goto('/reports/builder', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForTimeout(randomDelay(800, 1500));
            await page.mouse.wheel(0, Math.floor(Math.random() * 400) + 100);
            await page.waitForTimeout(randomDelay(500, 1000));
          } catch {
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // -----------------------------------------------------------------
      // ofc-43  Browse lot records
      // -----------------------------------------------------------------
      {
        id: 'ofc-43',
        name: 'Browse lot records',
        category: 'browse',
        tags: ['lots', 'quality'],
        execute: async (page: Page) => {
          try {
            await page.goto('/lots', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.locator('app-data-table, app-empty-state').first().waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT }).catch(() => {});
            await page.waitForTimeout(randomDelay(800, 1500));
            await page.mouse.wheel(0, Math.floor(Math.random() * 400) + 100);
            await page.waitForTimeout(randomDelay(500, 1000));
            if (maybe(0.4)) {
              await page.locator('app-data-table tbody tr').first().click({ timeout: ELEMENT_TIMEOUT }).catch(() => {});
              await page.waitForTimeout(randomDelay(800, 1500));
            }
          } catch {
            await page.waitForTimeout(randomDelay(300, 600));
          }
        },
      },

      // -----------------------------------------------------------------
      // ofc-45  Shipments — CREATE a shipment
      // -----------------------------------------------------------------
      {
        id: 'ofc-45',
        name: 'Create a shipment',
        category: 'create',
        tags: ['shipments'],
        execute: async (page: Page) => {
          try {
            await page.goto('/shipments', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForTimeout(randomDelay(500, 1_000));

            const newShipBtn = page.locator('[data-testid="new-shipment-btn"]').first();
            await newShipBtn.waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });
            await newShipBtn.click();
            await page.waitForTimeout(randomDelay(600, 1_200));

            // Wait for dialog
            await page.locator('[data-testid="shipment-so"], [data-testid="shipment-carrier"], [data-testid="shipment-tracking"], [data-testid="shipment-notes"]').first()
              .waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });

            // Fill required autocomplete: sales order
            let foundSO = await fillEntityPickerByTestId(page, 'shipment-so', 'SO-');
            if (!foundSO) foundSO = await fillEntityPickerByTestId(page, 'shipment-so', '1');
            if (!foundSO) {
              console.log('[office] ofc-45 no sales orders found for autocomplete — skipping shipment creation');
              await safeCloseDialog(page);
              return;
            }
            await page.waitForTimeout(randomDelay(200, 400));

            // Fill carrier
            try {
              const carrierWrapper = page.locator('[data-testid="shipment-carrier"]');
              const hasSelect = await carrierWrapper.locator('mat-select').count();
              if (hasSelect > 0) {
                await carrierWrapper.locator('mat-select').first().click();
                await page.waitForTimeout(300);
                const carrier = randomPick(SHIPMENT_CARRIERS);
                const option = page.locator('.cdk-overlay-container mat-option', { hasText: carrier }).first();
                if (await option.isVisible({ timeout: 2_000 }).catch(() => false)) {
                  await option.click();
                } else {
                  const firstOpt = page.locator('.cdk-overlay-container mat-option').first();
                  if (await firstOpt.isVisible({ timeout: 2_000 }).catch(() => false)) {
                    await firstOpt.click();
                  }
                }
                await page.waitForTimeout(300);
              } else {
                await fillByTestId(page, 'shipment-carrier', randomPick(SHIPMENT_CARRIERS));
              }
            } catch { /* optional */ }
            await page.waitForTimeout(randomDelay(200, 400));

            // Fill tracking number
            try {
              await fillByTestId(page, 'shipment-tracking', `1Z${randomInt(100000, 999999)}${randomInt(100000, 999999)}`);
            } catch { /* optional */ }
            await page.waitForTimeout(randomDelay(200, 400));

            // Fill weight
            try {
              await fillByTestId(page, 'shipment-weight', randomPick(['5.5', '12.0', '25.0', '50.0']));
            } catch { /* optional */ }
            await page.waitForTimeout(randomDelay(200, 400));

            // Fill shipping cost
            try {
              await fillByTestId(page, 'shipment-cost', randomPick(['15.00', '25.00', '50.00', '100.00']));
            } catch { /* optional */ }
            await page.waitForTimeout(randomDelay(200, 400));

            // Fill notes
            try {
              const notesWrapper = page.locator('[data-testid="shipment-notes"]');
              const textarea = notesWrapper.locator('textarea').first();
              if (await textarea.isVisible({ timeout: 2_000 }).catch(() => false)) {
                await textarea.click();
                await textarea.fill(randomPick(SHIPMENT_NOTES));
              } else {
                await fillByTestId(page, 'shipment-notes', randomPick(SHIPMENT_NOTES));
              }
            } catch { /* optional */ }
            await page.waitForTimeout(randomDelay(200, 400));

            // Save
            await clickSaveButton(page, 'shipment-save-btn');
            return 'shipment';
          } catch (err) {
            const url = page.url();
            console.log(`[office] ofc-45 FAILED (url=${url}): ${err instanceof Error ? err.message.slice(0, 120) : err}`);
            await page.screenshot({ path: 'e2e/stress/errors/ofc-45-fail.png' }).catch(() => {});
            await safeCloseDialog(page);
          }
        },
      },

      // -----------------------------------------------------------------
      // ofc-46  Vendors — CREATE a vendor
      // -----------------------------------------------------------------
      {
        id: 'ofc-46',
        name: 'Create a vendor',
        category: 'create',
        tags: ['vendors'],
        execute: async (page: Page) => {
          try {
            await page.goto('/vendors', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForTimeout(randomDelay(500, 1_000));

            const newVendorBtn = page.locator('[data-testid="new-vendor-btn"]').first();
            await newVendorBtn.waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });
            await newVendorBtn.click();
            await page.waitForTimeout(randomDelay(600, 1_200));

            // Wait for dialog
            await page.locator('[data-testid="vendor-company"], [data-testid="vendor-contact"]').first()
              .waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });

            // Fill company name
            try {
              await fillByTestId(page, 'vendor-company', randomPick(VENDOR_COMPANIES));
            } catch { /* required field */ }
            await page.waitForTimeout(randomDelay(200, 400));

            // Fill contact name
            try {
              await fillByTestId(page, 'vendor-contact', randomPick(VENDOR_CONTACTS));
            } catch { /* optional */ }
            await page.waitForTimeout(randomDelay(200, 400));

            // Fill email
            try {
              const company = randomPick(VENDOR_COMPANIES).toLowerCase().replace(/[^a-z]/g, '').slice(0, 10);
              await fillByTestId(page, 'vendor-email', `sales@${company}.com`);
            } catch { /* optional */ }
            await page.waitForTimeout(randomDelay(200, 400));

            // Fill phone
            try {
              await fillByTestId(page, 'vendor-phone', `(${randomInt(200, 999)}) ${randomInt(200, 999)}-${randomInt(1000, 9999)}`);
            } catch { /* optional */ }
            await page.waitForTimeout(randomDelay(200, 400));

            // Save
            await clickSaveButton(page, 'vendor-save-btn');
            return 'vendor';
          } catch (err) {
            const url = page.url();
            console.log(`[office] ofc-46 FAILED (url=${url}): ${err instanceof Error ? err.message.slice(0, 120) : err}`);
            await page.screenshot({ path: 'e2e/stress/errors/ofc-46-fail.png' }).catch(() => {});
            await safeCloseDialog(page);
          }
        },
      },

      // -----------------------------------------------------------------
      // ofc-47  Expenses — CREATE recurring expense
      // -----------------------------------------------------------------
      {
        id: 'ofc-47',
        name: 'Create recurring expense',
        category: 'create',
        tags: ['expenses', 'recurring'],
        execute: async (page: Page) => {
          try {
            await page.goto('/expenses/upcoming', { waitUntil: 'load', timeout: NAV_TIMEOUT });
            await page.waitForTimeout(randomDelay(500, 1_000));

            const newRecurringBtn = page.locator('[data-testid="new-recurring-btn"]').first();
            await newRecurringBtn.waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });
            await newRecurringBtn.click();
            await page.waitForTimeout(randomDelay(600, 1_200));

            // Wait for dialog
            await page.locator('[data-testid="recurring-amount"], [data-testid="recurring-description"], [data-testid="recurring-frequency"]').first()
              .waitFor({ state: 'visible', timeout: ELEMENT_TIMEOUT });

            // Fill amount
            try {
              await fillByTestId(page, 'recurring-amount', randomPick(['99.00', '249.00', '499.00']));
            } catch { /* required */ }
            await page.waitForTimeout(randomDelay(200, 400));

            // Select frequency
            try {
              await selectByTestId(page, 'recurring-frequency', 'Monthly');
            } catch { /* optional */ }
            await page.waitForTimeout(randomDelay(200, 400));

            // Select first available category
            try {
              await selectNthByTestId(page, 'recurring-category', 0);
            } catch { /* optional */ }
            await page.waitForTimeout(randomDelay(200, 400));

            // Fill description
            try {
              const descWrapper = page.locator('[data-testid="recurring-description"]');
              const textarea = descWrapper.locator('textarea').first();
              if (await textarea.isVisible({ timeout: 2_000 }).catch(() => false)) {
                await textarea.click();
                await textarea.fill(randomPick(RECURRING_DESCRIPTIONS));
              } else {
                await fillByTestId(page, 'recurring-description', randomPick(RECURRING_DESCRIPTIONS));
              }
            } catch { /* optional */ }
            await page.waitForTimeout(randomDelay(200, 400));

            // Fill start date (today)
            const today = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
            try {
              await fillDateByTestId(page, 'recurring-start', today);
            } catch { /* may be pre-filled */ }
            await page.waitForTimeout(randomDelay(200, 400));

            // Save
            await clickSaveButton(page, 'recurring-save-btn');
            return 'recurring-expense';
          } catch (err) {
            const url = page.url();
            console.log(`[office] ofc-47 FAILED (url=${url}): ${err instanceof Error ? err.message.slice(0, 120) : err}`);
            await page.screenshot({ path: 'e2e/stress/errors/ofc-47-fail.png' }).catch(() => {});
            await safeCloseDialog(page);
          }
        },
      },

      // -----------------------------------------------------------------
      // ofc-44  Return to dashboard — end of shift
      // -----------------------------------------------------------------
      {
        id: 'ofc-44',
        name: 'Return to dashboard',
        category: 'browse',
        tags: ['dashboard'],
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
