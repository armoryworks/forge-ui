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
} from '../data/scenario-data';
import {
  getOpenLeads, getCustomers, getDraftQuotes, getSentQuotes,
  getAcceptedQuotes, getActiveJobs, getDefaultTrackType,
  getUninvoicedJobs, getEngineers,
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
  const pmPage      = ctx.pages['pmorris@qbengineer.local'];
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
      eventType: 'ClockIn', reason: null, scanMethod: 'Manual', source: 'Simulation',
    });
  }, errors));

  inc(await tryAction('clock-out', async () => {
    await apiCall('POST', 'time-tracking/clock-events', worker, {
      eventType: 'ClockOut', reason: null, scanMethod: 'Manual', source: 'Simulation',
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
      await apiCall('POST', `jobs/${job.id}/holds`, manager, {
        holdType: 'WaitingOnMaterial',
        notes: `Waiting on raw stock — ${ctx.weekLabel}`,
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
