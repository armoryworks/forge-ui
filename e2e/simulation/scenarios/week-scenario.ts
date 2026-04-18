/**
 * Full lead-to-cash week simulation — UI-driven via Playwright.
 *
 * ARCHITECTURE:
 *   - Entity state queries (getOpenLeads, etc.) use the API via tokens (read-only, decision-making)
 *   - ALL create / update / advance actions go through the Angular UI via authenticated pages
 *   - Clock control (setSimulatedClock) stays as an API call — no UI equivalent
 *   - Clock in / out are API-only — shop floor kiosk UI is a separate flow
 *   - Invoice generation and payments remain API — accounting-boundary module
 *
 * Every action is wrapped in tryAction — failures are logged, never thrown.
 */

import type { WeekContext, WeekResult } from '../types/simulation.types';
import { tryAction, type SimError } from '../helpers/sim-context.helper';
import { apiCall } from '../helpers/api.helper';
import {
  pick, seededInt,
  COMPANIES, CONTACT_FIRST, CONTACT_LAST,
  LEAD_SOURCES, LEAD_NOTES,
  JOB_TITLES, QUOTE_LINE_DESCRIPTIONS,
  EXPENSE_CATEGORIES, EXPENSE_DESCRIPTIONS,
  JOB_COMMENTS, CHAT_MESSAGES_GENERAL,
  PART_NAMES, VENDOR_NAMES, ASSET_NAMES,
  STORAGE_LOCATION_NAMES, LOCATION_TYPES,
  EVENT_TITLES, EVENT_LOCATIONS,
  TRAINING_MODULE_TITLES, TRAINING_MODULE_SUMMARIES,
  PART_NUMBERS_PREFIX,
} from '../data/scenario-data';
import {
  getOpenLeads, getCustomers, getDraftQuotes, getSentQuotes,
  getAcceptedQuotes, getActiveJobs, getDefaultTrackType, getNextStage,
  getUninvoicedJobs, getEngineers, getTrackTypes,
  getParts, getVendors, getAssets, getStorageLocations,
} from '../helpers/entity-query.helper';
import {
  navigateTo, fillInput, fillTextarea, fillMatSelect, fillDatepicker,
  fillAutocomplete, fillRichText, clickButton,
  waitForDialog, waitForDialogClosed,
  clickRowContaining, toDisplayDate,
} from '../helpers/ui-actions.helper';

// ── helpers ──────────────────────────────────────────────────────────────────

/** ISO date string for a given day offset from weekStart */
function weekDay(ctx: WeekContext, offsetDays = 0): string {
  const d = new Date(ctx.weekStart);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10) + 'T00:00:00Z';
}

/** Display date (MM/DD/YYYY) for a given day offset from weekStart */
function weekDayDisplay(ctx: WeekContext, offsetDays = 0): string {
  const d = new Date(ctx.weekStart);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return toDisplayDate(d);
}

/** true with probability p/100 seeded by weekIndex + salt */
function pct(weekIndex: number, salt: number, p: number): boolean {
  return ((weekIndex * 31 + salt * 17) % 100) < p;
}

// ── main ──────────────────────────────────────────────────────────────────────

export async function runWeek(ctx: WeekContext): Promise<WeekResult> {
  const errors: SimError[] = [];
  let attempted = 0;
  let succeeded = 0;

  const inc = (ok: boolean) => { attempted++; if (ok) succeeded++; };

  // ── Role pages ─────────────────────────────────────────────────────────────
  const adminPage    = ctx.pages['admin@qbengineer.local'];
  const pmPage       = ctx.pages['pmorris@qbengineer.local'];
  const engineerPage = ctx.pages['akim@qbengineer.local'];
  const managerPage  = ctx.pages['lwilson@qbengineer.local'];
  const officePage   = ctx.pages['cthompson@qbengineer.local'];
  const workerPage   = ctx.pages['bkelly@qbengineer.local'];

  // ── Role tokens (API read-only queries) ────────────────────────────────────
  const admin    = ctx.tokens['admin@qbengineer.local'];
  const engineer = ctx.tokens['akim@qbengineer.local'];
  const pm       = ctx.tokens['pmorris@qbengineer.local'];
  const manager  = ctx.tokens['lwilson@qbengineer.local'];
  const office   = ctx.tokens['cthompson@qbengineer.local'];
  const worker   = ctx.tokens['bkelly@qbengineer.local'];

  const w = ctx.weekIndex;

  // ── 1. Create 1–3 new leads via UI (PM) ──────────────────────────────────
  const newLeadCount = seededInt(1, 3, w, 0);
  for (let i = 0; i < newLeadCount; i++) {
    const company   = pick(COMPANIES, w, i);
    const first     = pick(CONTACT_FIRST, w, i + 1);
    const last      = pick(CONTACT_LAST, w, i + 2);
    const source    = pick(LEAD_SOURCES, w, i);
    const notes     = pick(LEAD_NOTES, w, i + 3);
    const followUp  = weekDayDisplay(ctx, 5 + i);
    const email     = `${first.toLowerCase()}.${last.toLowerCase()}@${company.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`;
    const phone     = `(555) ${String(100 + (w % 900)).padStart(3, '0')}-${String(1000 + (i * 111 + w) % 9000).padStart(4, '0')}`;

    inc(await tryAction(`create-lead-${i}`, async () => {
      await navigateTo(pmPage, '/leads');
      await clickButton(pmPage, 'new-lead-btn');
      await waitForDialog(pmPage);
      await fillInput(pmPage, 'lead-company-name', company);
      await fillInput(pmPage, 'lead-contact-name', `${first} ${last}`);
      await fillInput(pmPage, 'lead-email', email);
      await fillInput(pmPage, 'lead-phone', phone);
      await fillMatSelect(pmPage, 'lead-source', source);
      await fillDatepicker(pmPage, 'lead-follow-up', followUp);
      await fillTextarea(pmPage, 'lead-notes', notes);
      // Diagnostic: capture state before clicking save
      const diag = await pmPage.evaluate(() => {
        const btn = document.querySelector('[data-testid="lead-save-btn"]') as HTMLButtonElement;
        const compInput = document.querySelector('[data-testid="lead-company-name"] input') as HTMLInputElement;
        const ng = (window as any).ng;
        let formValid: boolean | null = null;
        try {
          const appSelect = document.querySelector('[data-testid="lead-company-name"]');
          const comp = appSelect && ng?.getOwningComponent?.(appSelect);
          if (comp?.leadForm) formValid = comp.leadForm.valid;
        } catch { /* ignore */ }
        return { btnDisabled: btn?.disabled, compValue: compInput?.value, btnExists: !!btn, formValid };
      });
      console.log(`[create-lead-${i} diag] btn disabled=${diag.btnDisabled} compValue="${diag.compValue}" formValid=${diag.formValid}`);
      await clickButton(pmPage, 'lead-save-btn');
      await waitForDialogClosed(pmPage);
    }, errors));
  }

  // ── 2. Advance open leads → Contacted / Qualified via UI (PM) ───────────
  const openLeads = await getOpenLeads(pm);
  const leadsToAdvance = openLeads.filter((_, idx) => pct(w, idx + 10, 40)).slice(0, 2);

  if (leadsToAdvance.length > 0) {
    inc(await tryAction('advance-leads', async () => {
      await navigateTo(pmPage, '/leads');
      for (const lead of leadsToAdvance) {
        await clickRowContaining(pmPage, lead.companyName ?? String(lead.id));
        const newStatus = lead.status === 'New' ? 'contacted' : 'qualified';
        await pmPage.locator(`[data-testid="lead-status-btn-${newStatus}"]`).click();
        // Small pause for status update to register
        await pmPage.waitForTimeout(500);
      }
    }, errors));
  }

  // ── 3. Convert qualified leads → customers via UI (PM, ~30%) ─────────────
  const qualifiedLeads = openLeads.filter(l => l.status === 'Qualified');
  const leadsToConvert = qualifiedLeads.filter((_, idx) => pct(w, idx + 20, 30)).slice(0, 1);

  for (const lead of leadsToConvert) {
    inc(await tryAction(`convert-lead-${lead.id}`, async () => {
      await navigateTo(pmPage, '/leads');
      await clickRowContaining(pmPage, lead.companyName ?? String(lead.id));
      await pmPage.locator('[data-testid="lead-convert-btn"]').waitFor({ state: 'visible', timeout: 5000 });
      await clickButton(pmPage, 'lead-convert-btn');
      // Conversion may show a confirm dialog — accept it
      await pmPage.locator('.mat-mdc-dialog-container, app-dialog').first()
        .waitFor({ state: 'visible', timeout: 3000 })
        .then(async () => {
          // Click any primary confirm button
          await pmPage.locator('button.action-btn--primary').last().click();
        })
        .catch(() => { /* no confirm dialog — conversion happened directly */ });
      await pmPage.waitForTimeout(1000);
    }, errors));
  }

  // ── 4. Create quotes via UI (PM) ─────────────────────────────────────────
  const customers = await getCustomers(pm);
  const quotesToCreate = seededInt(1, 2, w, 4);

  for (let i = 0; i < quotesToCreate && customers.length > 0; i++) {
    const customer   = customers[(w + i) % customers.length];
    const expiry     = weekDayDisplay(ctx, 30);
    const lineDesc   = pick(QUOTE_LINE_DESCRIPTIONS, w, i + 30);
    const qty        = seededInt(10, 200, w, i + 40);
    const unitPrice  = seededInt(5, 85, w, i + 50);

    inc(await tryAction(`create-quote-${i}`, async () => {
      await navigateTo(pmPage, '/quotes');
      await clickButton(pmPage, 'new-quote-btn');
      await waitForDialog(pmPage);

      // Sidebar: customer + expiry
      await fillMatSelect(pmPage, 'quote-customer', customer.name);
      await fillDatepicker(pmPage, 'quote-expiry', expiry);

      // Line item: use autocomplete to pick a part or type description directly
      // Since autocomplete needs an existing part, we open it and pick the first option
      await fillAutocomplete(pmPage, 'quote-line-part', '');  // minChars=0, picks first part
      await fillInput(pmPage, 'quote-line-qty', String(qty));
      await fillInput(pmPage, 'quote-line-price', String(unitPrice));
      await clickButton(pmPage, 'quote-add-line-btn');

      // Wait for line to appear in table before saving
      await pmPage.waitForTimeout(300);
      await clickButton(pmPage, 'quote-save-btn');
      await waitForDialogClosed(pmPage);
    }, errors));
  }

  // ── 5. Send draft quotes via UI (PM) ─────────────────────────────────────
  const draftQuotes = await getDraftQuotes(pm);
  const quotesToSend = draftQuotes.filter((_, idx) => pct(w, idx + 60, 70)).slice(0, 2);

  if (quotesToSend.length > 0) {
    inc(await tryAction('send-quotes', async () => {
      await navigateTo(pmPage, '/quotes');
      for (const quote of quotesToSend) {
        await clickRowContaining(pmPage, quote.quoteNumber ?? quote.customerName ?? String(quote.id));
        await pmPage.locator('[data-testid="quote-send-btn"]').waitFor({ state: 'visible', timeout: 5000 });
        await clickButton(pmPage, 'quote-send-btn');
        await pmPage.waitForTimeout(500);
      }
    }, errors));
  }

  // ── 6. Accept sent quotes via UI (Manager) ────────────────────────────────
  const sentQuotes = await getSentQuotes(manager);
  const quotesToAccept = sentQuotes.filter((_, idx) => pct(w, idx + 70, 50)).slice(0, 2);

  if (quotesToAccept.length > 0) {
    inc(await tryAction('accept-quotes', async () => {
      await navigateTo(managerPage, '/quotes');
      for (const quote of quotesToAccept) {
        await clickRowContaining(managerPage, quote.quoteNumber ?? quote.customerName ?? String(quote.id));
        await managerPage.locator('[data-testid="quote-accept-btn"]').waitFor({ state: 'visible', timeout: 5000 });
        await clickButton(managerPage, 'quote-accept-btn');
        await managerPage.waitForTimeout(500);
      }
    }, errors));
  }

  // ── 7. Convert accepted quotes → sales orders via UI (Office) ────────────
  const acceptedQuotes = await getAcceptedQuotes(office);
  const quotesToConvert = acceptedQuotes.slice(0, 2);

  if (quotesToConvert.length > 0) {
    inc(await tryAction('convert-quotes', async () => {
      await navigateTo(officePage, '/quotes');
      for (const quote of quotesToConvert) {
        await clickRowContaining(officePage, quote.quoteNumber ?? quote.customerName ?? String(quote.id));
        await officePage.locator('[data-testid="quote-convert-btn"]').waitFor({ state: 'visible', timeout: 5000 });
        await clickButton(officePage, 'quote-convert-btn');
        await officePage.waitForTimeout(800);
      }
    }, errors));
  }

  // ── 8. Create new jobs via UI (Manager) ───────────────────────────────────
  const trackType = await getDefaultTrackType(manager);
  const engineers = await getEngineers(admin);

  if (trackType && engineers.length > 0) {
    const jobsToCreate = seededInt(1, 2, w, 5);
    for (let i = 0; i < jobsToCreate; i++) {
      const customer  = customers.length > 0 ? customers[(w + i) % customers.length] : null;
      const title     = pick(JOB_TITLES, w, i + 10).replace('{customer}', customer?.name ?? 'Internal');
      const assignee  = engineers[(w + i) % engineers.length];
      const assigneeName = `${assignee.firstName} ${assignee.lastName}`;
      const priorities = ['Low', 'Medium', 'High'];
      const priority  = pick(priorities, w, i + 15);
      const dueDate   = weekDayDisplay(ctx, 14 + seededInt(0, 14, w, i + 20));

      inc(await tryAction(`create-job-${i}`, async () => {
        await navigateTo(managerPage, '/kanban');
        await clickButton(managerPage, 'new-job-btn');
        await waitForDialog(managerPage);

        await fillInput(managerPage, 'job-title', title);
        await fillTextarea(managerPage, 'job-description', `Production run for ${ctx.weekLabel}`);
        // Track type (only visible on create mode)
        await fillMatSelect(managerPage, 'job-track-type', trackType.name);
        if (customer) {
          await fillMatSelect(managerPage, 'job-customer', customer.name);
        }
        await fillMatSelect(managerPage, 'job-assignee', assigneeName);
        await fillMatSelect(managerPage, 'job-priority', priority);
        await fillDatepicker(managerPage, 'job-due-date', dueDate);

        await clickButton(managerPage, 'job-save-btn');
        await waitForDialogClosed(managerPage);
      }, errors));
    }
  }

  // ── 9. Add job comments via UI (Engineer) ────────────────────────────────
  const activeJobs = await getActiveJobs(engineer);
  const jobsToComment = activeJobs.filter((_, idx) => pct(w, idx + 90, 50)).slice(0, 2);

  if (jobsToComment.length > 0) {
    inc(await tryAction('job-comments', async () => {
      await navigateTo(engineerPage, '/kanban');
      for (const job of jobsToComment) {
        const comment = pick(JOB_COMMENTS, w, job.id % JOB_COMMENTS.length);
        // Click the job number button to open the detail panel
        const cardSelector = job.jobNumber
          ? `[data-testid="job-card-number-${job.jobNumber}"]`
          : `.card__job-number`;
        await engineerPage.locator(cardSelector).first().waitFor({ state: 'visible', timeout: 5000 });
        await engineerPage.locator(cardSelector).first().click();
        // Switch to Conversation tab
        await engineerPage.locator('[data-testid="job-filter-comments"]').waitFor({ state: 'visible', timeout: 5000 });
        await clickButton(engineerPage, 'job-filter-comments');
        // Type comment into rich-text editor
        await fillRichText(engineerPage, 'job-comment-input', comment);
        await clickButton(engineerPage, 'job-comment-send');
        await engineerPage.waitForTimeout(500);
      }
    }, errors));
  }

  // ── 10. Log time entries via UI (Engineer + Worker) ───────────────────────
  const jobsForTime = activeJobs.slice(0, 4);
  for (let i = 0; i < jobsForTime.length; i++) {
    const entryPage = i % 2 === 0 ? engineerPage : workerPage;
    const dayOffset = i % 5;
    const hours     = seededInt(1, 7, w, i + 100);
    const minutes   = pick([0, 15, 30, 45], w, i + 105);
    const dateDisp  = weekDayDisplay(ctx, dayOffset);

    inc(await tryAction(`time-entry-${i}`, async () => {
      await navigateTo(entryPage, '/time-tracking');
      await clickButton(entryPage, 'manual-entry-btn');
      await waitForDialog(entryPage);

      await fillDatepicker(entryPage, 'time-entry-date', dateDisp);
      await fillMatSelect(entryPage, 'time-entry-category', 'Production');
      await fillInput(entryPage, 'time-entry-hours', String(hours));
      await fillInput(entryPage, 'time-entry-minutes', String(minutes));
      await fillTextarea(entryPage, 'time-entry-notes', `Week ${ctx.weekLabel}`);

      await clickButton(entryPage, 'time-entry-save-btn');
      await waitForDialogClosed(entryPage);
    }, errors));
  }

  // ── 11. Clock in / clock out via API (Worker — no UI equivalent) ──────────
  inc(await tryAction('clock-in', async () => {
    await apiCall('POST', 'time-tracking/clock-events', worker, {
      eventTypeCode: 'ClockIn', reason: null, scanMethod: 'Manual', source: 'Simulation',
    });
  }, errors));

  inc(await tryAction('clock-out', async () => {
    await apiCall('POST', 'time-tracking/clock-events', worker, {
      eventTypeCode: 'ClockOut', reason: null, scanMethod: 'Manual', source: 'Simulation',
    });
  }, errors));

  // ── 12. Submit expenses via UI (Engineer + Worker) ────────────────────────
  const expenseCount = seededInt(1, 3, w, 6);
  for (let i = 0; i < expenseCount; i++) {
    const expPage   = i === 0 ? engineerPage : workerPage;
    const category  = pick(EXPENSE_CATEGORIES, w, i + 50);
    const desc      = pick(EXPENSE_DESCRIPTIONS, w, i + 55).replace('{q}', `${Math.ceil((ctx.weekStart.getMonth() + 1) / 3)}`);
    const amount    = seededInt(15, 350, w, i + 60);
    const dateDisp  = weekDayDisplay(ctx, i + 1);

    inc(await tryAction(`expense-${i}`, async () => {
      await navigateTo(expPage, '/expenses');
      await clickButton(expPage, 'new-expense-btn');
      await waitForDialog(expPage);

      await fillInput(expPage, 'expense-amount', String(amount));
      await fillDatepicker(expPage, 'expense-date', dateDisp);
      await fillMatSelect(expPage, 'expense-category', category);
      await fillTextarea(expPage, 'expense-description', desc);

      await clickButton(expPage, 'expense-save-btn');
      await waitForDialogClosed(expPage);
    }, errors));
  }

  // ── 13. Approve pending expenses via UI (Manager) ─────────────────────────
  if (pct(w, 200, 60)) {
    inc(await tryAction('approve-expenses', async () => {
      await navigateTo(managerPage, '/expenses');
      // Filter to Pending status
      await fillMatSelect(managerPage, 'status-filter', 'Pending');
      await managerPage.waitForTimeout(500);
      // Click approve (check icon) buttons — up to 3
      const approveBtns = managerPage.locator('.icon-btn--success');
      const count = Math.min(await approveBtns.count(), 3);
      for (let i = 0; i < count; i++) {
        await approveBtns.first().click();
        await managerPage.waitForTimeout(300);
      }
    }, errors));
  }

  // ── 14. Create purchase order via UI (Office Manager) ─────────────────────
  if (pct(w, 300, 50)) {
    const vendors = await apiCall<{ data: Array<{ id: number; name: string }> }>('GET', 'vendors?pageSize=20', office);
    const vendorList = vendors?.data ?? [];
    if (vendorList.length > 0) {
      const vendor = vendorList[w % vendorList.length];

      inc(await tryAction('create-po', async () => {
        await navigateTo(officePage, '/purchase-orders');
        await clickButton(officePage, 'new-po-btn');
        await waitForDialog(officePage);

        await fillMatSelect(officePage, 'po-vendor', vendor.name);
        // Add one line
        await fillAutocomplete(officePage, 'po-line-part', ''); // picks first part
        await fillInput(officePage, 'po-line-qty', String(seededInt(5, 50, w, 70)));
        await fillInput(officePage, 'po-line-price', String(seededInt(10, 100, w, 75)));
        await clickButton(officePage, 'po-add-line-btn');
        await officePage.waitForTimeout(300);

        await clickButton(officePage, 'po-save-btn');
        await waitForDialogClosed(officePage);
      }, errors));
    }
  }

  // ── 15. Receive a submitted PO via UI (Office Manager) ────────────────────
  if (pct(w, 400, 40)) {
    const pendingPos = await apiCall<{ data: Array<{ id: number; poNumber: string; status: string }> }>(
      'GET', 'purchase-orders?status=Submitted&pageSize=10', office,
    );
    const po = (pendingPos?.data ?? [])[0];
    if (po) {
      inc(await tryAction(`receive-po-${po.id}`, async () => {
        await navigateTo(officePage, '/purchase-orders');
        await clickRowContaining(officePage, po.poNumber);
        await officePage.locator('[data-testid="po-receive-btn"]').waitFor({ state: 'visible', timeout: 5000 });
        await clickButton(officePage, 'po-receive-btn');
        await waitForDialog(officePage);
        // Click "Receive All" for simplicity
        await officePage.locator('[data-testid="receive-all-btn"]').waitFor({ state: 'visible', timeout: 5000 });
        await clickButton(officePage, 'receive-all-btn');
        await clickButton(officePage, 'receive-save-btn');
        await waitForDialogClosed(officePage);
      }, errors));
    }
  }

  // ── 16. Invoice completed jobs via API (accounting boundary) ──────────────
  const uninvoicedJobs = await getUninvoicedJobs(office);
  for (const job of uninvoicedJobs.slice(0, 2)) {
    inc(await tryAction(`invoice-job-${job.id}`, async () => {
      const invoice = await apiCall<{ id: number }>('POST', `invoices/from-job/${job.id}`, office, {});
      if (invoice?.id && pct(w, job.id + 500, 80)) {
        await apiCall('POST', `invoices/${invoice.id}/send`, office, {});
      }
    }, errors));
  }

  // ── 17. Record payment via API (accounting boundary) ──────────────────────
  if (pct(w, 600, 45)) {
    const sentInvoices = await apiCall<{ data: Array<{ id: number; totalAmount: number }> }>(
      'GET', 'invoices?status=Sent&pageSize=10', office,
    );
    const inv = (sentInvoices?.data ?? [])[0];
    if (inv) {
      inc(await tryAction(`payment-${inv.id}`, async () => {
        await apiCall('POST', 'payments', office, {
          invoiceId: inv.id,
          amount: inv.totalAmount,
          paymentDate: weekDay(ctx, 4),
          method: ['Check', 'ACH', 'CreditCard', 'Wire'][w % 4],
          reference: `REF-${w}-${inv.id}`,
        });
      }, errors));
    }
  }

  // ── 18. Send chat message via UI (Engineer) ───────────────────────────────
  if (pct(w, 700, 60)) {
    inc(await tryAction('chat-message', async () => {
      await navigateTo(engineerPage, '/chat');
      await engineerPage.waitForTimeout(500);

      // Open first conversation in the chat panel
      const convBtns = engineerPage.locator('.conversation');
      if (await convBtns.count() > 0) {
        await convBtns.first().click();
        await engineerPage.waitForTimeout(300);
        const msg = pick(CHAT_MESSAGES_GENERAL, w, 0);
        await engineerPage.locator('[data-testid="chat-message-input"]').fill(msg);
        await clickButton(engineerPage, 'chat-send-btn');
        await engineerPage.waitForTimeout(300);
      }
    }, errors));
  }

  // ── 19. Job hold via API (status-timeline interaction is too complex for sim) ─
  if (pct(w, 900, 25) && activeJobs.length > 0) {
    const job = activeJobs[w % activeJobs.length];
    inc(await tryAction(`hold-job-${job.id}`, async () => {
      await apiCall('POST', `status-tracking/job/${job.id}/holds`, manager, {
        holdType: 'WaitingOnMaterial',
        notes: `Waiting on raw stock — ${ctx.weekLabel}`,
      });
    }, errors));
  }

  // ── 20. Advance jobs through stages via UI (Engineer) ────────────────────
  const trackTypes = await getTrackTypes(engineer);
  const jobsToAdvance = activeJobs.filter((_, idx) => pct(w, idx + 150, 35)).slice(0, 3);

  for (const job of jobsToAdvance) {
    const tt = trackTypes.find(t => t.id === job.trackTypeId);
    if (!tt) continue;
    const nextStage = getNextStage(tt, job.currentStageId);
    if (!nextStage) continue;

    inc(await tryAction(`advance-job-${job.id}`, async () => {
      await apiCall('PATCH', `jobs/${job.id}/stage`, engineer, {
        stageId: nextStage.id,
      });
    }, errors));
  }

  // ── 21. Create parts via UI (Engineer) ───────────────────────────────────
  const existingParts = await getParts(engineer);
  if (pct(w, 1000, 40) || existingParts.length < 5) {
    const partCount = seededInt(1, 2, w, 20);
    for (let i = 0; i < partCount; i++) {
      const partName = pick(PART_NAMES, w, i + 200);
      const prefix = pick(PART_NUMBERS_PREFIX, w, i + 201);
      const partNumber = `${prefix}-${1000 + ((w * 7 + i) % 9000)}`;

      inc(await tryAction(`create-part-${i}`, async () => {
        await navigateTo(engineerPage, '/parts');
        await clickButton(engineerPage, 'new-part-btn');
        await waitForDialog(engineerPage);

        // Part number is auto-generated, fill other fields
        await fillMatSelect(engineerPage, 'part-type', 'Manufactured');
        await fillInput(engineerPage, 'part-description', partName);
        await fillInput(engineerPage, 'part-revision', 'A');
        await fillInput(engineerPage, 'part-material', pick(['6061-T6 Al', '4140 Steel', '303 SS', '7075-T6 Al', '1018 CRS', '316 SS', 'Delrin', 'PEEK'], w, i));

        await clickButton(engineerPage, 'part-save-btn');
        await waitForDialogClosed(engineerPage);
      }, errors));
    }
  }

  // ── 22. Create vendors via UI (Office Manager) ───────────────────────────
  const existingVendors = await getVendors(office);
  if (pct(w, 1100, 25) || existingVendors.length < 5) {
    const vendorName = pick(VENDOR_NAMES, w, 210);
    const vendorContact = `${pick(CONTACT_FIRST, w, 211)} ${pick(CONTACT_LAST, w, 212)}`;
    const vendorEmail = `sales@${vendorName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`;
    const vendorPhone = `(555) ${String(200 + (w % 800)).padStart(3, '0')}-${String(1000 + (w * 3) % 9000).padStart(4, '0')}`;

    inc(await tryAction('create-vendor', async () => {
      await navigateTo(officePage, '/vendors');
      await clickButton(officePage, 'new-vendor-btn');
      await waitForDialog(officePage);

      await fillInput(officePage, 'vendor-company', vendorName);
      await fillInput(officePage, 'vendor-contact', vendorContact);
      await fillInput(officePage, 'vendor-email', vendorEmail);
      await fillInput(officePage, 'vendor-phone', vendorPhone);
      await fillMatSelect(officePage, 'vendor-terms', 'Net 30');
      await fillTextarea(officePage, 'vendor-notes', `Supplier for ${pick(['raw materials', 'tooling', 'cutting tools', 'fasteners', 'abrasives'], w, 213)}`);

      await clickButton(officePage, 'vendor-save-btn');
      await waitForDialogClosed(officePage);
    }, errors));
  }

  // ── 23. Create assets via UI (Manager) ───────────────────────────────────
  const existingAssets = await getAssets(manager);
  if (pct(w, 1200, 15) || existingAssets.length < 3) {
    const assetData = pick(ASSET_NAMES, w, 220);

    inc(await tryAction('create-asset', async () => {
      await navigateTo(managerPage, '/assets');
      await clickButton(managerPage, 'new-asset-btn');
      await waitForDialog(managerPage);

      await fillInput(managerPage, 'asset-name', assetData.name);
      await fillMatSelect(managerPage, 'asset-type', assetData.type);
      await fillInput(managerPage, 'asset-manufacturer', assetData.manufacturer);
      await fillInput(managerPage, 'asset-model', assetData.model);
      await fillInput(managerPage, 'asset-serial', `SN-${w}-${seededInt(10000, 99999, w, 221)}`);
      await fillInput(managerPage, 'asset-location', 'Shop Floor');
      await fillTextarea(managerPage, 'asset-notes', `Commissioned ${ctx.weekLabel}`);

      await clickButton(managerPage, 'asset-save-btn');
      await waitForDialogClosed(managerPage);
    }, errors));
  }

  // ── 24. Create customers directly via UI (Office Manager) ────────────────
  if (pct(w, 1300, 20)) {
    const custCompany = pick(COMPANIES, w, 230);
    const custFirst = pick(CONTACT_FIRST, w, 231);
    const custLast = pick(CONTACT_LAST, w, 232);
    const custEmail = `${custFirst.toLowerCase()}.${custLast.toLowerCase()}@${custCompany.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`;
    const custPhone = `(555) ${String(300 + (w % 700)).padStart(3, '0')}-${String(2000 + (w * 5) % 8000).padStart(4, '0')}`;

    inc(await tryAction('create-customer', async () => {
      await navigateTo(officePage, '/customers');
      await clickButton(officePage, 'new-customer-btn');
      await waitForDialog(officePage);

      await fillInput(officePage, 'customer-name', `${custLast}, ${custFirst}`);
      await fillInput(officePage, 'customer-company', custCompany);
      await fillInput(officePage, 'customer-email', custEmail);
      await fillInput(officePage, 'customer-phone', custPhone);

      await clickButton(officePage, 'customer-save-btn');
      await waitForDialogClosed(officePage);
    }, errors));
  }

  // ── 25. Create inventory locations via UI (Manager) ──────────────────────
  const existingLocations = await getStorageLocations(manager);
  if (pct(w, 1400, 20) || existingLocations.length < 5) {
    const locName = pick(STORAGE_LOCATION_NAMES, w, 240);
    const locType = pick(LOCATION_TYPES, w, 241);

    inc(await tryAction('create-location', async () => {
      await navigateTo(managerPage, '/inventory/locations');
      await clickButton(managerPage, 'add-location-btn');
      await waitForDialog(managerPage);

      await fillInput(managerPage, 'location-name', locName);
      await fillMatSelect(managerPage, 'location-type', locType);
      await fillInput(managerPage, 'location-description', `${locType} location for ${pick(['raw materials', 'finished goods', 'WIP', 'tooling', 'inspection'], w, 242)}`);

      await clickButton(managerPage, 'location-save-btn');
      await waitForDialogClosed(managerPage);
    }, errors));
  }

  // ── 26. Create events via UI (Admin — events are in admin panel) ─────────
  if (pct(w, 1500, 30)) {
    const eventTitle = pick(EVENT_TITLES, w, 250);
    const eventLocation = pick(EVENT_LOCATIONS, w, 251);
    const eventType = pick(['Meeting', 'Training', 'Safety', 'Other'], w, 252);
    const startDate = weekDayDisplay(ctx, seededInt(1, 4, w, 253));
    const endDate = startDate; // Same-day events

    inc(await tryAction('create-event', async () => {
      await navigateTo(adminPage, '/admin/events');
      await clickButton(adminPage, 'new-event-btn');
      await waitForDialog(adminPage);

      await fillInput(adminPage, 'event-title', eventTitle);
      await fillMatSelect(adminPage, 'event-type', eventType);
      await fillInput(adminPage, 'event-location', eventLocation);
      await fillDatepicker(adminPage, 'event-start-date', startDate);
      await fillInput(adminPage, 'event-start-time', '09:00');
      await fillDatepicker(adminPage, 'event-end-date', endDate);
      await fillInput(adminPage, 'event-end-time', '10:00');
      await fillTextarea(adminPage, 'event-description', `${eventTitle} — scheduled for ${ctx.weekLabel}`);

      // Set up response listener before save
      const responsePromise = adminPage.waitForResponse(
        resp => resp.url().includes('/api/v1/events') && resp.request().method() === 'POST',
        { timeout: 10000 },
      ).catch(() => null);

      await clickButton(adminPage, 'event-save-btn');

      const response = await responsePromise;
      if (response && response.status() >= 400) {
        const body = await response.text().catch(() => '');
        console.log(`  [event] POST failed: ${response.status()} ${body.slice(0, 300)}`);
      }

      const dialogStillOpen = await adminPage.locator('.dialog-backdrop').first()
        .waitFor({ state: 'hidden', timeout: 10000 })
        .then(() => false)
        .catch(() => true);

      if (dialogStillOpen) {
        await adminPage.keyboard.press('Escape');
        await adminPage.waitForTimeout(500);
        // Try escape again in case there's a stacked dialog
        const stillOpen = await adminPage.locator('.dialog-backdrop').isVisible();
        if (stillOpen) {
          await adminPage.keyboard.press('Escape');
          await adminPage.waitForTimeout(500);
        }
        throw new Error('Event dialog did not close after save');
      }
    }, errors));
  }

  // ── 27. Set workflow status on jobs via API ──────────────────────────────
  if (pct(w, 1600, 30) && activeJobs.length > 0) {
    const job = activeJobs[(w + 3) % activeJobs.length];
    const statusCode = pick(['in_production', 'awaiting_material', 'quality_review', 'ready_to_ship'], w, 260);

    inc(await tryAction(`set-status-${job.id}`, async () => {
      await apiCall('POST', `status-tracking/job/${job.id}/workflow`, manager, {
        statusCode,
        notes: `Status update — ${ctx.weekLabel}`,
      });
    }, errors));
  }

  // ── 28. Assign jobs via UI (Manager) ─────────────────────────────────────
  if (engineers.length > 0) {
    const unassignedJobs = activeJobs.filter(j => !j.customerId).slice(0, 2);
    for (const job of unassignedJobs) {
      if (!pct(w, job.id + 1700, 40)) continue;
      const assignee = engineers[(w + job.id) % engineers.length];

      inc(await tryAction(`assign-job-${job.id}`, async () => {
        await apiCall('PATCH', `jobs/${job.id}`, manager, {
          assigneeId: assignee.id,
        });
      }, errors));
    }
  }

  // ── 29. Create subtasks on jobs via API (Engineer) ───────────────────────
  if (pct(w, 1800, 35) && activeJobs.length > 0) {
    const job = activeJobs[(w + 5) % activeJobs.length];
    const subtaskTexts = [
      'Setup fixture and verify alignment',
      'Run first article and inspect',
      'Complete production run',
      'Deburr and clean parts',
      'Final inspection and packaging',
    ];
    const subtaskText = pick(subtaskTexts, w, 270);

    inc(await tryAction(`add-subtask-${job.id}`, async () => {
      await apiCall('POST', `jobs/${job.id}/subtasks`, engineer, {
        text: subtaskText,
      });
    }, errors));
  }

  // ── 30. Complete subtasks on jobs via API (Worker) ───────────────────────
  if (pct(w, 1900, 30) && activeJobs.length > 0) {
    const job = activeJobs[(w + 7) % activeJobs.length];
    // Fetch subtasks for this job
    const subtasks = await apiCall<Array<{ id: number; isCompleted: boolean }>>('GET', `jobs/${job.id}/subtasks`, worker);
    const openSubtasks = (subtasks ?? []).filter(s => !s.isCompleted);
    if (openSubtasks.length > 0) {
      const subtask = openSubtasks[0];
      inc(await tryAction(`complete-subtask-${subtask.id}`, async () => {
        await apiCall('PATCH', `jobs/${job.id}/subtasks/${subtask.id}`, worker, {
          isCompleted: true,
        });
      }, errors));
    }
  }

  // ── 31. Create estimates via API (PM) ────────────────────────────────────
  if (pct(w, 2000, 25) && customers.length > 0) {
    const customer = customers[(w + 11) % customers.length];
    const amount = seededInt(500, 15000, w, 280);

    inc(await tryAction('create-estimate', async () => {
      await apiCall('POST', 'estimates', pm, {
        customerId: customer.id,
        title: `Estimate for ${customer.name}`,
        estimatedAmount: amount,
        notes: `Ballpark estimate for ${ctx.weekLabel}`,
        validUntil: weekDay(ctx, 60),
      });
    }, errors));
  }

  // ── 32. Sales order fulfillment tracking via API (Office) ────────────────
  if (pct(w, 2100, 30)) {
    const openSOs = await apiCall<{ data: Array<{ id: number; status: string }> }>('GET', 'orders?pageSize=20', office);
    const confirmedSO = (openSOs?.data ?? []).find(s => s.status === 'Confirmed');
    if (confirmedSO) {
      // Get SO lines to build shipment lines
      const soDetail = await apiCall<{ id: number; lines: Array<{ id: number; quantity: number; quantityShipped: number }> }>(
        'GET', `orders/${confirmedSO.id}`, office,
      );
      const unshippedLines = (soDetail?.lines ?? []).filter(l => l.quantityShipped < l.quantity);
      if (unshippedLines.length > 0) {
        inc(await tryAction(`fulfill-so-${confirmedSO.id}`, async () => {
          await apiCall('POST', 'shipments', office, {
            salesOrderId: confirmedSO.id,
            carrier: pick(['UPS', 'FedEx', 'USPS', 'Freight'], w, 290),
            trackingNumber: `TRK${w}${confirmedSO.id}`,
            notes: `Shipped via ${pick(['ground', 'express', '2-day', 'freight'], w, 291)}`,
            lines: unshippedLines.map(l => ({
              salesOrderLineId: l.id,
              quantityShipped: l.quantity - l.quantityShipped,
            })),
          });
        }, errors));
      }
    }
  }

  // ── 33. Create training module via UI (Admin) — every ~8 weeks ─────────
  if (w % 8 === 0) {
    const modTitle = `${pick(TRAINING_MODULE_TITLES, w, 300)} (Sim ${ctx.weekLabel})`;
    const modSummary = pick(TRAINING_MODULE_SUMMARIES, w, 301);
    const contentType = pick(['Article', 'Video', 'Walkthrough', 'QuickRef'], w, 302);

    inc(await tryAction('create-training-module', async () => {
      await navigateTo(adminPage, '/admin/training');
      await adminPage.waitForTimeout(500);
      await clickButton(adminPage, 'new-module-btn');
      await waitForDialog(adminPage);

      await fillInput(adminPage, 'module-title', modTitle);
      await fillTextarea(adminPage, 'module-summary', modSummary);
      await fillMatSelect(adminPage, 'module-content-type', contentType);
      await fillInput(adminPage, 'module-est-minutes', String(seededInt(10, 60, w, 303)));
      await fillInput(adminPage, 'module-tags', pick(['onboarding', 'safety', 'quality', 'machining', 'inspection'], w, 304));

      // Set up response listener BEFORE clicking save
      const responsePromise = adminPage.waitForResponse(
        resp => resp.url().includes('/api/v1/training/modules') && resp.request().method() === 'POST',
        { timeout: 10000 },
      ).catch(() => null);

      await clickButton(adminPage, 'module-save-btn');

      const response = await responsePromise;
      if (response) {
        const status = response.status();
        if (status >= 400) {
          const body = await response.text().catch(() => '');
          console.log(`  [training-module] POST failed: ${status} ${body.slice(0, 200)}`);
        }
      } else {
        console.log(`  [training-module] No POST request captured — save may not have fired`);
      }

      // Wait for dialog to close
      const dialogStillOpen = await adminPage.locator('.dialog-backdrop').first()
        .waitFor({ state: 'hidden', timeout: 8000 })
        .then(() => false)
        .catch(() => true);

      if (dialogStillOpen) {
        await adminPage.keyboard.press('Escape');
        await adminPage.waitForTimeout(500);
        throw new Error('Training module dialog did not close after save');
      }
    }, errors));
  }

  // ── 34. Update job fields via UI (Manager — title, priority, due date) ──
  if (pct(w, 2200, 25) && activeJobs.length > 0) {
    const job = activeJobs[(w + 9) % activeJobs.length];
    const newPriority = pick(['Low', 'Normal', 'High', 'Urgent'], w, 310);
    const newDueDate = weekDayDisplay(ctx, seededInt(7, 28, w, 311));

    inc(await tryAction(`update-job-${job.id}`, async () => {
      await apiCall('PATCH', `jobs/${job.id}`, manager, {
        priority: newPriority,
        dueDate: weekDay(ctx, seededInt(7, 28, w, 311)),
      });
    }, errors));
  }

  return {
    weekLabel: ctx.weekLabel,
    weekStart: ctx.weekStart.toISOString(),
    actionsAttempted: attempted,
    actionsSucceeded: succeeded,
    errors,
    durationMs: 0, // set by runner
  };
}
