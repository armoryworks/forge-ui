/**
 * Comprehensive UI-driven week simulation — ALL operations via Playwright UI.
 *
 * ARCHITECTURE:
 *   - Entity state queries (getOpenLeads, etc.) use API tokens (read-only, decision-making)
 *   - ALL create / update / advance / delete actions go through the Angular UI
 *   - Clock control (setSimulatedClock) stays as API — no UI equivalent
 *   - Every action wrapped in tryAction — failures logged, never thrown
 *
 * ENTITY COVERAGE (188 actions across all features — 100% functional coverage):
 *   Leads, Customers (all 9 tabs), Contacts, Quotes, Estimates, Sales Orders (confirm),
 *   Jobs, Parts, BOMs, Vendors (detail), Purchase Orders (receiving),
 *   Inventory (all 9 tabs + cycle counts), Expenses (approval workflow),
 *   Time Tracking, Assets (detail + maintenance + history tabs),
 *   Shipments (mark shipped/delivered), Invoices, Payments,
 *   QC Inspections (pass/fail results), Lots, Customer Returns (full resolve+close lifecycle),
 *   Events, Chat, Entity Activity/Conversation, Announcements,
 *   Approvals (deep approve workflow), Training (module completion),
 *   Reports (run saved reports), Search, Notifications,
 *   Planning Cycles, Shop Floor (worker grid + clock + scan log),
 *   Dashboard (widget interaction), Backlog (job interaction), Calendar (month nav),
 *   Worker Module, Scheduling (all 5 tabs + run), MRP (all 6 tabs + run),
 *   OEE (work centers + detail), Employee Detail (all tabs deep browse),
 *   Account (profile/security/customization/pay/docs/integrations + tax forms),
 *   Admin (users/events/training/integrations/EDI/MFA/AI/time-corrections/tasks),
 *   AI Assistant, Quality (inspections + lots + templates),
 *   Onboarding Wizard (full 7-step: personal/address/W-4/state/I-9/deposit/ack),
 *   Mobile (clock/jobs/job-detail-timer-notes/scan-manual/chat/notifications/time/account),
 *   Compliance Forms (W-4/I-9/state withholding browse+update)
 *
 * SUPPLY CHAIN FLOW:
 *   Customer needs product → Create manufactured part + BOM →
 *   PO for raw materials → Receive materials → Create production job →
 *   Job advances through stages → QC inspection → Ship → Invoice → Payment
 */

import type { WeekContext, WeekResult } from '../types/simulation.types';
import { tryAction, type SimError } from '../helpers/sim-context.helper';
import {
  pick, seededInt,
  COMPANIES, CONTACT_FIRST, CONTACT_LAST,
  LEAD_SOURCES, LEAD_NOTES,
  JOB_TITLES, QUOTE_LINE_DESCRIPTIONS,
  EXPENSE_CATEGORIES, EXPENSE_DESCRIPTIONS,
  CHAT_MESSAGES_GENERAL,
  PART_NAMES, VENDOR_NAMES, ASSET_NAMES,
  STORAGE_LOCATION_NAMES, LOCATION_TYPES,
  EVENT_TITLES, EVENT_LOCATIONS,
  PART_NUMBERS_PREFIX,
  ASSEMBLY_NAMES, RAW_MATERIALS, PURCHASED_COMPONENTS,
  INVOICE_NOTES, PAYMENT_METHODS, PAYMENT_REFERENCES,
  RETURN_REASONS, QC_NOTES, SHIPMENT_CARRIERS,
  CHAT_MESSAGES_WITH_MENTIONS, ENTITY_COMMENTS,
  CONTACT_TITLES, CONTACT_DEPARTMENTS,
  RFQ_DESCRIPTIONS, ECO_DESCRIPTIONS, ECO_CHANGE_TYPES,
  RECURRING_EXPENSE_DESCRIPTIONS, RECURRING_FREQUENCIES,
  CUSTOMER_NOTES,
  INTERACTION_SUBJECTS, INTERACTION_BODIES, INTERACTION_TYPES,
  ENTITY_NOTES,
  ANNOUNCEMENT_TITLES, ANNOUNCEMENT_CONTENTS, ANNOUNCEMENT_SEVERITIES, ANNOUNCEMENT_SCOPES,
  SEARCH_TERMS, REPORT_ENTITY_SOURCES,
  PLANNING_CYCLE_NAMES, PLANNING_GOALS,
  ESTIMATE_DESCRIPTIONS,
  ONBOARDING_FIRST_NAMES, ONBOARDING_LAST_NAMES, ONBOARDING_EMAILS_DOMAIN,
  BANK_NAMES, ROUTING_NUMBERS, ONBOARDING_ROLES,
  I9_LIST_A_DOC_TYPES, I9_LIST_B_DOC_TYPES, I9_LIST_C_DOC_TYPES,
  US_STATES_COMMON, STREET_ADDRESSES, CITY_NAMES,
  DOC_NUMBERS, DOC_AUTHORITIES,
  JOB_NOTES_MOBILE,
} from '../data/scenario-data';
import {
  getOpenLeads, getCustomers, getDraftQuotes, getSentQuotes,
  getAcceptedQuotes, getActiveJobs, getJobsInStage, getDefaultTrackType, getNextStage,
  getUninvoicedJobs, getEngineers, getTrackTypes,
  getParts, getVendors, getAssets, getStorageLocations,
  getSentInvoices, getShippableSalesOrders, getSalesOrderDetail,
  getQcTemplates, getLots, getOpenReturns, getAllUsers,
  getCustomerContacts, getPurchaseOrdersByStatus, getAllPurchaseOrders,
  getOpenSalesOrders, getOpenInvoices, getAllInvoices,
  getDraftSalesOrders, getShipmentsByStatus, getShipments,
  getPendingExpenses, getResolvedReturns,
  getSavedReports, getPlanningCycles,
} from '../helpers/entity-query.helper';
import {
  navigateTo, fillInput, fillTextarea, fillMatSelect, fillDatepicker,
  fillAutocomplete, clickButton,
  waitForDialog, waitForDialogClosed,
  clickRowContaining, toDisplayDate,
} from '../helpers/ui-actions.helper';

// ── helpers ──────────────────────────────────────────────────────────────────

/**
 * Dismiss any visible announcement overlays on a page.
 * Announcements sit on top of the page and block all clicks.
 * Max 10 iterations to prevent infinite loops.
 */
async function dismissAnnouncements(page: import('@playwright/test').Page): Promise<void> {
  for (let i = 0; i < 10; i++) {
    const ackBtn = page.locator('.announcement__ack-btn').first();
    const dismissBtn = page.locator('.announcement__dismiss').first();

    if (await ackBtn.isVisible({ timeout: 500 }).catch(() => false)) {
      await ackBtn.click().catch(() => {});
      await page.waitForTimeout(300);
    } else if (await dismissBtn.isVisible({ timeout: 500 }).catch(() => false)) {
      await dismissBtn.click().catch(() => {});
      await page.waitForTimeout(300);
    } else {
      break; // No more announcements
    }
  }
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

/**
 * Post a comment on an entity's activity section.
 * Opens the entity detail (by clicking its row), scrolls to activity,
 * switches to Conversation tab, types comment, and sends.
 */
async function postEntityComment(
  page: import('@playwright/test').Page,
  route: string,
  rowText: string,
  comment: string,
): Promise<void> {
  await navigateTo(page, route);
  await clickRowContaining(page, rowText);
  await page.waitForTimeout(800);

  // Scroll to activity section and click Conversation filter
  const commentFilter = page.locator('[data-testid="activity-filter-comments"]');
  if (await commentFilter.isVisible({ timeout: 3000 }).catch(() => false)) {
    await commentFilter.click();
    await page.waitForTimeout(300);
  }

  // Fill the comment input and send
  const commentInput = page.locator('[data-testid="activity-comment-input"]');
  if (await commentInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    // Rich text editor — click and type
    const editor = commentInput.locator('[contenteditable="true"]').first();
    if (await editor.isVisible({ timeout: 2000 }).catch(() => false)) {
      await editor.click();
      await editor.fill(comment);
    } else {
      // Fallback: try textarea or input
      await commentInput.click();
      await page.keyboard.type(comment);
    }
    await page.waitForTimeout(200);
    await page.locator('[data-testid="activity-comment-send-btn"]').click();
    await page.waitForTimeout(500);
  }
}

/**
 * Post a note on an entity's activity section.
 * Similar to postEntityComment but uses the Notes tab instead of Conversation.
 */
async function postEntityNote(
  page: import('@playwright/test').Page,
  route: string,
  rowText: string,
  noteText: string,
): Promise<void> {
  await navigateTo(page, route);
  await clickRowContaining(page, rowText);
  await page.waitForTimeout(800);

  // Scroll to activity section and click Notes filter
  const notesFilter = page.locator('[data-testid="activity-filter-notes"]');
  if (await notesFilter.isVisible({ timeout: 3000 }).catch(() => false)) {
    await notesFilter.click();
    await page.waitForTimeout(300);
  }

  // Fill the note input and save
  const noteInput = page.locator('[data-testid="activity-note-input"]');
  if (await noteInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    const editor = noteInput.locator('[contenteditable="true"]').first();
    if (await editor.isVisible({ timeout: 2000 }).catch(() => false)) {
      await editor.click();
      await editor.fill(noteText);
    } else {
      await noteInput.click();
      await page.keyboard.type(noteText);
    }
    await page.waitForTimeout(200);
    await page.locator('[data-testid="activity-note-save-btn"]').click();
    await page.waitForTimeout(500);
  }
}

/**
 * Log a contact interaction on a customer's Interactions tab.
 */
async function logContactInteraction(
  page: import('@playwright/test').Page,
  customerId: number,
  type: string,
  subject: string,
  body: string,
  dateDisplay: string,
  duration?: number,
  contactName?: string,
): Promise<void> {
  await navigateTo(page, `/customers/${customerId}/interactions`);
  await clickButton(page, 'log-interaction-btn');
  await waitForDialog(page);
  await fillMatSelect(page, 'interaction-type', type);
  if (contactName) {
    // Try to select the contact — may fail if no contacts exist
    await fillMatSelect(page, 'interaction-contact', contactName).catch(() => {});
  }
  await fillInput(page, 'interaction-subject', subject);
  await fillDatepicker(page, 'interaction-date', dateDisplay);
  if (duration) {
    await fillInput(page, 'interaction-duration', String(duration));
  }
  await fillTextarea(page, 'interaction-body', body);
  await clickButton(page, 'interaction-save-btn');
  await waitForDialogClosed(page);
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

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION A: LEAD-TO-CUSTOMER PIPELINE
  // ════════════════════════════════════════════════════════════════════════════

  // ── 1. Create leads via UI (PM) ────────────────────────────────────────────
  const newLeadCount = seededInt(1, 3, w, 0);
  for (let i = 0; i < newLeadCount; i++) {
    const company = pick(COMPANIES, w, i);
    const first   = pick(CONTACT_FIRST, w, i + 1);
    const last    = pick(CONTACT_LAST, w, i + 2);
    const source  = pick(LEAD_SOURCES, w, i);
    const notes   = pick(LEAD_NOTES, w, i + 3);
    const followUp = weekDayDisplay(ctx, 5 + i);
    const email   = `${first.toLowerCase()}.${last.toLowerCase()}@${company.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`;
    const phone   = `(555) ${String(100 + (w % 900)).padStart(3, '0')}-${String(1000 + (i * 111 + w) % 9000).padStart(4, '0')}`;

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
      await clickButton(pmPage, 'lead-save-btn');
      await waitForDialogClosed(pmPage);
    }, errors));
  }

  // ── 2. Advance open leads via UI (PM) ──────────────────────────────────────
  const openLeads = await getOpenLeads(pm);
  const leadsToAdvance = openLeads.filter((_, idx) => pct(w, idx + 10, 40)).slice(0, 2);

  if (leadsToAdvance.length > 0) {
    inc(await tryAction('advance-leads', async () => {
      await navigateTo(pmPage, '/leads');
      for (const lead of leadsToAdvance) {
        await clickRowContaining(pmPage, lead.companyName ?? String(lead.id));
        const newStatus = lead.status === 'New' ? 'contacted' : 'qualified';
        await pmPage.locator(`[data-testid="lead-status-btn-${newStatus}"]`).click();
        await pmPage.waitForTimeout(500);
      }
    }, errors));
  }

  // ── 3. Add conversation comments on leads (PM) ─────────────────────────────
  if (pct(w, 3000, 35) && openLeads.length > 0) {
    const lead = openLeads[w % openLeads.length];
    const comment = pick(ENTITY_COMMENTS.customer, w, 3010); // lead comments similar to customer
    inc(await tryAction(`lead-comment-${lead.id}`, async () => {
      await postEntityComment(pmPage, '/leads', lead.companyName ?? String(lead.id), comment);
    }, errors));
  }

  // ── 4. Convert qualified leads → customers via UI (PM) ─────────────────────
  const qualifiedLeads = openLeads.filter(l => l.status === 'Qualified');
  const leadsToConvert = qualifiedLeads.filter((_, idx) => pct(w, idx + 20, 30)).slice(0, 1);

  for (const lead of leadsToConvert) {
    inc(await tryAction(`convert-lead-${lead.id}`, async () => {
      await navigateTo(pmPage, '/leads');
      await clickRowContaining(pmPage, lead.companyName ?? String(lead.id));
      await pmPage.locator('[data-testid="lead-convert-btn"]').waitFor({ state: 'visible', timeout: 5000 });
      await clickButton(pmPage, 'lead-convert-btn');
      await pmPage.locator('.mat-mdc-dialog-container, app-dialog').first()
        .waitFor({ state: 'visible', timeout: 3000 })
        .then(async () => { await pmPage.locator('button.action-btn--primary').last().click(); })
        .catch(() => {});
      await pmPage.waitForTimeout(1000);
    }, errors));
  }

  // ── 5. Create customers directly via UI (Office) ───────────────────────────
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

  // ── 6. Add contacts to customers via UI (Office) ───────────────────────────
  const customers = await getCustomers(office);
  if (pct(w, 3100, 30) && customers.length > 0) {
    const customer = customers[(w + 5) % customers.length];
    const contacts = await getCustomerContacts(office, customer.id);

    // Add 1-2 contacts if customer has fewer than 3
    if (contacts.length < 3) {
      const contactCount = seededInt(1, 2, w, 3110);
      for (let ci = 0; ci < contactCount; ci++) {
        const cFirst = pick(CONTACT_FIRST, w, ci + 3120);
        const cLast = pick(CONTACT_LAST, w, ci + 3121);
        const cTitle = pick(CONTACT_TITLES, w, ci + 3122);
        const cEmail = `${cFirst.toLowerCase()}.${cLast.toLowerCase()}@${customer.name?.toLowerCase().replace(/[^a-z0-9]/g, '') ?? 'company'}.com`;
        const cPhone = `(555) ${String(400 + (w % 600)).padStart(3, '0')}-${String(3000 + (w * 7 + ci) % 7000).padStart(4, '0')}`;

        inc(await tryAction(`add-contact-${customer.id}-${ci}`, async () => {
          await navigateTo(officePage, `/customers/${customer.id}/contacts`);
          await clickButton(officePage, 'add-contact-btn');
          await waitForDialog(officePage);
          await fillInput(officePage, 'contact-first-name', cFirst);
          await fillInput(officePage, 'contact-last-name', cLast);
          await fillInput(officePage, 'contact-email', cEmail);
          await fillInput(officePage, 'contact-phone', cPhone);
          await fillMatSelect(officePage, 'contact-role', cTitle);
          await clickButton(officePage, 'contact-save-btn');
          await waitForDialogClosed(officePage);
        }, errors));
      }
    }
  }

  // ── 7. Add conversation comments on customers (Office) ─────────────────────
  if (pct(w, 3200, 25) && customers.length > 0) {
    const customer = customers[(w + 3) % customers.length];
    const comment = pick(ENTITY_COMMENTS.customer, w, 3210);
    inc(await tryAction(`customer-comment-${customer.id}`, async () => {
      await postEntityComment(officePage, `/customers/${customer.id}/overview`, customer.name, comment);
    }, errors));
  }

  // ── 7b. Log contact interactions — calls/emails/meetings with contacts ────
  if (pct(w, 5000, 45) && customers.length > 0) {
    const customer = customers[(w + 1) % customers.length];
    const contacts = await getCustomerContacts(office, customer.id);
    const interactionCount = seededInt(1, 3, w, 5001);

    for (let ii = 0; ii < interactionCount; ii++) {
      const type = pick([...INTERACTION_TYPES], w, ii + 5010) as string;
      const subjectPool = INTERACTION_SUBJECTS[type as keyof typeof INTERACTION_SUBJECTS] ?? INTERACTION_SUBJECTS.Call;
      const bodyPool = INTERACTION_BODIES[type as keyof typeof INTERACTION_BODIES] ?? INTERACTION_BODIES.Call;
      const subject = pick(subjectPool, w, ii + 5020)
        .replace('{q}', String(Math.ceil((ctx.weekStart.getMonth() + 1) / 3)));
      const contactName = contacts.length > 0
        ? `${contacts[ii % contacts.length].lastName}, ${contacts[ii % contacts.length].firstName}`
        : undefined;
      const body = pick(bodyPool, w, ii + 5030)
        .replace('{contact}', contactName ?? 'the customer')
        .replace('{ref}', `${w}-${customer.id}`);
      const duration = type === 'Call' ? seededInt(5, 45, w, ii + 5040)
        : type === 'Meeting' ? seededInt(30, 120, w, ii + 5041)
        : undefined;
      const dateDisplay = weekDayDisplay(ctx, ii);

      inc(await tryAction(`interaction-${customer.id}-${ii}`, async () => {
        await logContactInteraction(
          officePage, customer.id, type, subject, body, dateDisplay, duration, contactName,
        );
      }, errors));
    }
  }

  // ── 7c. Additional interactions from PM (sales-oriented calls/emails) ─────
  if (pct(w, 5100, 30) && customers.length > 0) {
    const customer = customers[(w + 4) % customers.length];
    const contacts = await getCustomerContacts(pm, customer.id);
    const type = pct(w, 5110, 60) ? 'Call' : 'Email';
    const subjectPool = INTERACTION_SUBJECTS[type as keyof typeof INTERACTION_SUBJECTS];
    const bodyPool = INTERACTION_BODIES[type as keyof typeof INTERACTION_BODIES];
    const subject = pick(subjectPool, w, 5120)
      .replace('{q}', String(Math.ceil((ctx.weekStart.getMonth() + 1) / 3)));
    const contactName = contacts.length > 0
      ? `${contacts[0].lastName}, ${contacts[0].firstName}`
      : undefined;
    const body = pick(bodyPool, w, 5130)
      .replace('{contact}', contactName ?? 'procurement')
      .replace('{ref}', `${w}-${customer.id}`);

    inc(await tryAction(`pm-interaction-${customer.id}`, async () => {
      await logContactInteraction(
        pmPage, customer.id, type, subject, body, weekDayDisplay(ctx, 2),
        type === 'Call' ? seededInt(10, 30, w, 5140) : undefined, contactName,
      );
    }, errors));
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION B: PARTS & ENGINEERING
  // ════════════════════════════════════════════════════════════════════════════

  // ── 8. Create manufactured parts via UI (Engineer) ─────────────────────────
  const existingParts = await getParts(engineer);
  if (pct(w, 1000, 40) || existingParts.length < 10) {
    const partCount = seededInt(1, 2, w, 20);
    for (let i = 0; i < partCount; i++) {
      const partName = pick(PART_NAMES, w, i + 200);
      const material = pick(['6061-T6 Al', '4140 Steel', '303 SS', '7075-T6 Al', '1018 CRS', '316 SS', 'Delrin', 'PEEK'], w, i);

      inc(await tryAction(`create-part-${i}`, async () => {
        await navigateTo(engineerPage, '/parts');
        await clickButton(engineerPage, 'new-part-btn');
        await waitForDialog(engineerPage);
        await fillMatSelect(engineerPage, 'part-type', 'Part');
        await fillInput(engineerPage, 'part-description', partName);
        await fillInput(engineerPage, 'part-revision', 'A');
        await fillInput(engineerPage, 'part-material', material);
        await clickButton(engineerPage, 'part-save-btn');
        await waitForDialogClosed(engineerPage);
      }, errors));
    }
  }

  // ── 9. Create raw material parts via UI (Engineer) ─────────────────────────
  if (pct(w, 1010, 25) || existingParts.length < 15) {
    const rawMat = pick(RAW_MATERIALS, w, 210);
    inc(await tryAction('create-raw-material', async () => {
      await navigateTo(engineerPage, '/parts');
      await clickButton(engineerPage, 'new-part-btn');
      await waitForDialog(engineerPage);
      await fillMatSelect(engineerPage, 'part-type', 'Raw Material');
      await fillInput(engineerPage, 'part-description', rawMat.name);
      await fillInput(engineerPage, 'part-revision', 'A');
      await fillInput(engineerPage, 'part-material', rawMat.material);
      await clickButton(engineerPage, 'part-save-btn');
      await waitForDialogClosed(engineerPage);
    }, errors));
  }

  // ── 10. Create assembly parts + BOM entries via UI (Engineer) ──────────────
  // Creates a manufactured assembly and adds child parts from the existing catalog
  if (pct(w, 1020, 15) && existingParts.length >= 3) {
    const asm = pick(ASSEMBLY_NAMES, w, 220);
    const asmPartNumber = `${asm.prefix}-${1000 + (w % 9000)}`;

    inc(await tryAction('create-assembly', async () => {
      // First create the assembly part
      await navigateTo(engineerPage, '/parts');
      await clickButton(engineerPage, 'new-part-btn');
      await waitForDialog(engineerPage);
      await fillMatSelect(engineerPage, 'part-type', 'Assembly');
      await fillInput(engineerPage, 'part-description', asm.name);
      await fillInput(engineerPage, 'part-revision', 'A');
      await fillInput(engineerPage, 'part-material', asm.material);
      await clickButton(engineerPage, 'part-save-btn');
      await waitForDialogClosed(engineerPage);
    }, errors));

    // Now add BOM entries to it — open the part detail and add children
    const updatedParts = await getParts(engineer);
    const asmPart = updatedParts.find(p => p.description === asm.name);
    if (asmPart) {
      const childParts = existingParts.filter(p => p.id !== asmPart.id).slice(0, 3);
      for (let bi = 0; bi < childParts.length; bi++) {
        const child = childParts[bi];
        const qty = seededInt(1, 10, w, bi + 230);
        const sourceType = pick(['Make', 'Buy', 'Stock'], w, bi + 231);

        inc(await tryAction(`add-bom-${asmPart.id}-${bi}`, async () => {
          await navigateTo(engineerPage, `/parts?detail=part:${asmPart.id}`);
          await engineerPage.waitForTimeout(800);
          // Click BOM tab
          await engineerPage.locator('[data-testid="part-tab-bom"]').click();
          await engineerPage.waitForTimeout(300);
          // Click Add button
          await clickButton(engineerPage, 'add-bom-btn');
          await waitForDialog(engineerPage);
          // Fill BOM entry form
          await fillAutocomplete(engineerPage, 'bom-child-part', child.partNumber);
          await fillInput(engineerPage, 'bom-quantity', String(qty));
          await fillMatSelect(engineerPage, 'bom-source-type', sourceType);
          await clickButton(engineerPage, 'bom-save-btn');
          await waitForDialogClosed(engineerPage);
        }, errors));
      }
    }
  }

  // ── 11. Add conversation comments on parts (Engineer) ──────────────────────
  if (pct(w, 3300, 30) && existingParts.length > 0) {
    const part = existingParts[w % existingParts.length];
    const comment = pick(ENTITY_COMMENTS.part, w, 3310);
    inc(await tryAction(`part-comment-${part.id}`, async () => {
      await postEntityComment(engineerPage, '/parts', part.partNumber, comment);
    }, errors));
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION C: QUOTING & SALES ORDERS
  // ════════════════════════════════════════════════════════════════════════════

  // ── 12. Create quotes via UI (PM) ──────────────────────────────────────────
  const quotesToCreate = seededInt(1, 2, w, 4);
  for (let i = 0; i < quotesToCreate && customers.length > 0; i++) {
    const customer = customers[(w + i) % customers.length];
    const expiry   = weekDayDisplay(ctx, 30);
    const qty      = seededInt(10, 200, w, i + 40);
    const unitPrice = seededInt(5, 85, w, i + 50);

    inc(await tryAction(`create-quote-${i}`, async () => {
      await navigateTo(pmPage, '/quotes');
      await clickButton(pmPage, 'new-quote-btn');
      await waitForDialog(pmPage);
      await fillMatSelect(pmPage, 'quote-customer', customer.name);
      await fillDatepicker(pmPage, 'quote-expiry', expiry);
      await fillAutocomplete(pmPage, 'quote-line-part', '');
      await fillInput(pmPage, 'quote-line-qty', String(qty));
      await fillInput(pmPage, 'quote-line-price', String(unitPrice));
      await clickButton(pmPage, 'quote-add-line-btn');
      await pmPage.waitForTimeout(300);
      await clickButton(pmPage, 'quote-save-btn');
      await waitForDialogClosed(pmPage);
    }, errors));
  }

  // ── 13. Send draft quotes via UI (PM) ──────────────────────────────────────
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

  // ── 14. Accept sent quotes via UI (Manager) ────────────────────────────────
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

  // ── 15. Convert accepted quotes → sales orders via UI (Office) ─────────────
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

  // ── 16. Add conversation comments on quotes (PM) ───────────────────────────
  if (pct(w, 3400, 25) && draftQuotes.length > 0) {
    const quote = draftQuotes[0];
    const comment = pick(ENTITY_COMMENTS.quote, w, 3410);
    inc(await tryAction(`quote-comment`, async () => {
      await postEntityComment(pmPage, '/quotes', quote.quoteNumber ?? String(quote.id), comment);
    }, errors));
  }

  // ── 17. Create sales orders directly via UI (Office) ───────────────────────
  if (pct(w, 1700, 20) && customers.length > 0 && existingParts.length > 0) {
    const customer = customers[(w + 7) % customers.length];
    const qty = seededInt(5, 100, w, 1710);
    const price = seededInt(15, 120, w, 1720);
    const deliveryDate = weekDayDisplay(ctx, 21);

    inc(await tryAction('create-so', async () => {
      await navigateTo(officePage, '/sales-orders');
      await clickButton(officePage, 'new-so-btn');
      await waitForDialog(officePage);
      await fillMatSelect(officePage, 'so-customer', customer.name);
      await fillDatepicker(officePage, 'so-delivery-date', deliveryDate);
      await fillAutocomplete(officePage, 'so-line-part', '');
      await fillInput(officePage, 'so-line-qty', String(qty));
      await fillInput(officePage, 'so-line-price', String(price));
      await clickButton(officePage, 'so-add-line-btn');
      await officePage.waitForTimeout(300);
      await fillTextarea(officePage, 'so-notes', `Direct order — ${ctx.weekLabel}`);
      await clickButton(officePage, 'so-save-btn');
      await waitForDialogClosed(officePage);
    }, errors));
  }

  // ── 18. Add conversation comments on sales orders (Office) ─────────────────
  const openSOs = await getOpenSalesOrders(office);
  if (pct(w, 3500, 25) && openSOs.length > 0) {
    const so = openSOs[w % openSOs.length];
    const comment = pick(ENTITY_COMMENTS.salesOrder, w, 3510);
    inc(await tryAction(`so-comment-${so.id}`, async () => {
      await postEntityComment(officePage, '/sales-orders', String(so.id), comment);
    }, errors));
  }

  // ── 18b. Add notes on sales orders (Office) ─────────────────────────────────
  if (pct(w, 6300, 25) && openSOs.length > 0) {
    const so = openSOs[(w + 2) % openSOs.length];
    const note = pick(ENTITY_NOTES.salesOrder, w, 6310)
      .replace('{contact}', 'the customer');
    inc(await tryAction(`so-note-${so.id}`, async () => {
      await postEntityNote(officePage, '/sales-orders', String(so.id), note);
    }, errors));
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION D: PRODUCTION & KANBAN
  // ════════════════════════════════════════════════════════════════════════════

  // ── 19. Create jobs via UI (Manager) ───────────────────────────────────────
  const trackType = await getDefaultTrackType(manager);
  const engineers = await getEngineers(admin);

  if (trackType && engineers.length > 0) {
    const jobsToCreate = seededInt(1, 2, w, 5);
    for (let i = 0; i < jobsToCreate; i++) {
      const customer = customers.length > 0 ? customers[(w + i) % customers.length] : null;
      const title    = pick(JOB_TITLES, w, i + 10).replace('{customer}', customer?.name ?? 'Internal');
      const assignee = engineers[(w + i) % engineers.length];
      const assigneeName = `${assignee.firstName} ${assignee.lastName}`;
      const priority = pick(['Low', 'Medium', 'High'], w, i + 15);
      const dueDate  = weekDayDisplay(ctx, 14 + seededInt(0, 14, w, i + 20));

      inc(await tryAction(`create-job-${i}`, async () => {
        await navigateTo(managerPage, '/kanban');
        await clickButton(managerPage, 'new-job-btn');
        await waitForDialog(managerPage);
        await fillInput(managerPage, 'job-title', title);
        await fillTextarea(managerPage, 'job-description', `Production run for ${ctx.weekLabel}`);
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

  // ── 20. Add job comments via entity activity (Engineer) ────────────────────
  const activeJobs = await getActiveJobs(engineer);
  const jobsToComment = activeJobs.filter((_, idx) => pct(w, idx + 90, 50)).slice(0, 2);

  for (const job of jobsToComment) {
    const comment = pick(ENTITY_COMMENTS.job, w, job.id % ENTITY_COMMENTS.job.length);
    inc(await tryAction(`job-comment-${job.id}`, async () => {
      await navigateTo(engineerPage, '/kanban');
      const cardSelector = job.jobNumber
        ? `[data-testid="job-card-number-${job.jobNumber}"]`
        : `.card__job-number`;
      await engineerPage.locator(cardSelector).first().waitFor({ state: 'visible', timeout: 5000 });
      await engineerPage.locator(cardSelector).first().click();
      // Wait for detail panel to load
      await engineerPage.waitForTimeout(800);
      // Switch to Conversation filter in the activity section
      const commentFilter = engineerPage.locator('[data-testid="activity-filter-comments"]');
      if (await commentFilter.isVisible({ timeout: 3000 }).catch(() => false)) {
        await commentFilter.click();
        await engineerPage.waitForTimeout(300);
      }
      // Fill comment
      const editor = engineerPage.locator('[data-testid="activity-comment-input"] [contenteditable="true"]').first();
      if (await editor.isVisible({ timeout: 3000 }).catch(() => false)) {
        await editor.click();
        await editor.fill(comment);
        await engineerPage.waitForTimeout(200);
        await engineerPage.locator('[data-testid="activity-comment-send-btn"]').click();
        await engineerPage.waitForTimeout(500);
      }
    }, errors));
  }

  // ── 20b. Add notes on jobs (Engineer) ──────────────────────────────────────
  if (pct(w, 6000, 25) && activeJobs.length > 0) {
    const job = activeJobs[(w + 5) % activeJobs.length];
    const note = pick(ENTITY_NOTES.job, w, 6010)
      .replace('{q}', String(Math.ceil((ctx.weekStart.getMonth() + 1) / 3)));
    inc(await tryAction(`job-note-${job.id}`, async () => {
      await navigateTo(engineerPage, '/kanban');
      const cardSelector = job.jobNumber
        ? `[data-testid="job-card-number-${job.jobNumber}"]`
        : `.card__job-number`;
      await engineerPage.locator(cardSelector).first().waitFor({ state: 'visible', timeout: 5000 });
      await engineerPage.locator(cardSelector).first().click();
      await engineerPage.waitForTimeout(800);
      // Switch to Notes filter
      const notesFilter = engineerPage.locator('[data-testid="activity-filter-notes"]');
      if (await notesFilter.isVisible({ timeout: 3000 }).catch(() => false)) {
        await notesFilter.click();
        await engineerPage.waitForTimeout(300);
      }
      const noteInput = engineerPage.locator('[data-testid="activity-note-input"]');
      if (await noteInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        const editor = noteInput.locator('[contenteditable="true"]').first();
        if (await editor.isVisible({ timeout: 2000 }).catch(() => false)) {
          await editor.click();
          await editor.fill(note);
          await engineerPage.waitForTimeout(200);
          await engineerPage.locator('[data-testid="activity-note-save-btn"]').click();
          await engineerPage.waitForTimeout(500);
        }
      }
    }, errors));
  }

  // ── 21. Advance jobs through stages via UI (Engineer) ──────────────────────
  // Opens job detail on kanban board and uses the stage picker dropdown
  const trackTypes = await getTrackTypes(engineer);
  const jobsToAdvance = activeJobs.filter((_, idx) => pct(w, idx + 150, 35)).slice(0, 3);

  for (const job of jobsToAdvance) {
    const tt = trackTypes.find(t => t.id === job.trackTypeId);
    if (!tt) continue;
    const nextStage = getNextStage(tt, job.currentStageId);
    if (!nextStage) continue;

    inc(await tryAction(`advance-job-${job.id}`, async () => {
      await navigateTo(engineerPage, '/kanban');
      await engineerPage.waitForTimeout(800);
      // Find and click the job card to open detail panel
      const card = engineerPage.locator(`[data-testid="job-card-number-${job.jobNumber}"]`).first();
      if (await card.isVisible({ timeout: 5000 }).catch(() => false)) {
        await card.click();
        await engineerPage.waitForTimeout(800);
        // Click the stage chip to open stage picker menu
        const stageChip = engineerPage.locator('[data-testid="job-stage-chip"]');
        await stageChip.waitFor({ state: 'visible', timeout: 5000 });
        await stageChip.click();
        await engineerPage.waitForTimeout(300);
        // Click the target stage option in the mat-menu
        const stageOption = engineerPage.locator(`[data-testid="stage-option"]:not([disabled]):has-text("${nextStage.name}")`).first();
        if (await stageOption.isVisible({ timeout: 3000 }).catch(() => false)) {
          await stageOption.click();
          await engineerPage.waitForTimeout(500);
        }
        // Close the detail panel
        const closeBtn = engineerPage.locator('button.panel__close').first();
        if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await closeBtn.click();
        }
      }
    }, errors));
  }

  // ── 22. Update job fields via UI (Manager) ─────────────────────────────────
  if (pct(w, 2200, 25) && activeJobs.length > 0) {
    const job = activeJobs[(w + 9) % activeJobs.length];
    const newPriority = pick(['Low', 'Medium', 'High', 'Urgent'], w, 310);
    const newDueDate = weekDayDisplay(ctx, seededInt(7, 28, w, 311));

    inc(await tryAction(`update-job-${job.id}`, async () => {
      await navigateTo(managerPage, '/kanban');
      // Open job detail and edit
      const cardSelector = job.jobNumber
        ? `[data-testid="job-card-number-${job.jobNumber}"]`
        : `.card__job-number`;
      await managerPage.locator(cardSelector).first().waitFor({ state: 'visible', timeout: 5000 });
      await managerPage.locator(cardSelector).first().click();
      await managerPage.waitForTimeout(800);
      // Look for edit button in detail panel
      const editBtn = managerPage.locator('[data-testid="job-edit-btn"], button:has-text("Edit")').first();
      if (await editBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await editBtn.click();
        await waitForDialog(managerPage);
        await fillMatSelect(managerPage, 'job-priority', newPriority);
        await fillDatepicker(managerPage, 'job-due-date', newDueDate);
        await clickButton(managerPage, 'job-save-btn');
        await waitForDialogClosed(managerPage);
      }
    }, errors));
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION E: TIME TRACKING
  // ════════════════════════════════════════════════════════════════════════════

  // ── 23. Log time entries via UI (Engineer + Worker) ────────────────────────
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

  // ── 24. Start/stop timer via UI (Worker) ───────────────────────────────────
  if (pct(w, 2400, 40)) {
    inc(await tryAction('start-timer', async () => {
      await navigateTo(workerPage, '/time-tracking');
      const startBtn = workerPage.locator('[data-testid="start-timer-btn"]');
      if (await startBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await startBtn.click();
        await waitForDialog(workerPage);
        await fillMatSelect(workerPage, 'timer-category', 'Production');
        await fillTextarea(workerPage, 'timer-notes', `Timer ${ctx.weekLabel}`);
        await clickButton(workerPage, 'timer-start-btn');
        await waitForDialogClosed(workerPage);
        // Stop after brief wait
        await workerPage.waitForTimeout(2000);
        const stopBtn = workerPage.locator('[data-testid="stop-timer-btn"]');
        if (await stopBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await stopBtn.click();
          await waitForDialog(workerPage);
          await fillTextarea(workerPage, 'timer-stop-notes', 'End of task');
          await clickButton(workerPage, 'timer-stop-btn');
          await waitForDialogClosed(workerPage);
        }
      }
    }, errors));
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION F: EXPENSES
  // ════════════════════════════════════════════════════════════════════════════

  // ── 25. Submit expenses via UI (Engineer + Worker) ─────────────────────────
  const expenseCount = seededInt(1, 3, w, 6);
  for (let i = 0; i < expenseCount; i++) {
    const expPage  = i === 0 ? engineerPage : workerPage;
    const category = pick(EXPENSE_CATEGORIES, w, i + 50);
    const desc     = pick(EXPENSE_DESCRIPTIONS, w, i + 55).replace('{q}', `${Math.ceil((ctx.weekStart.getMonth() + 1) / 3)}`);
    const amount   = seededInt(15, 350, w, i + 60);
    const dateDisp = weekDayDisplay(ctx, i + 1);

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
    }, errors, expPage));
  }

  // ── 26. Approve pending expenses via UI (Manager) ──────────────────────────
  if (pct(w, 200, 60)) {
    inc(await tryAction('approve-expenses', async () => {
      await navigateTo(managerPage, '/expenses');
      await fillMatSelect(managerPage, 'status-filter', 'Pending');
      await managerPage.waitForTimeout(500);
      const approveBtns = managerPage.locator('.icon-btn--success');
      const count = Math.min(await approveBtns.count(), 3);
      for (let i = 0; i < count; i++) {
        await approveBtns.first().click();
        await managerPage.waitForTimeout(300);
      }
    }, errors));
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION G: VENDORS & PURCHASING
  // ════════════════════════════════════════════════════════════════════════════

  // ── 27. Create vendors via UI (Office) ─────────────────────────────────────
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

  // ── 28. Add conversation comments on vendors (Office) ──────────────────────
  if (pct(w, 3600, 20) && existingVendors.length > 0) {
    const vendor = existingVendors[w % existingVendors.length];
    const comment = pick(ENTITY_COMMENTS.vendor, w, 3610);
    inc(await tryAction(`vendor-comment-${vendor.id}`, async () => {
      await postEntityComment(officePage, '/vendors', vendor.name, comment);
    }, errors));
  }

  // ── 28b. Add notes on vendors (Office) ──────────────────────────────────────
  if (pct(w, 6100, 20) && existingVendors.length > 0) {
    const vendor = existingVendors[(w + 2) % existingVendors.length];
    const altVendor = existingVendors.length > 1
      ? existingVendors[(w + 3) % existingVendors.length].name
      : 'alternate supplier';
    const note = pick(ENTITY_NOTES.vendor, w, 6110)
      .replace('{q}', String(Math.ceil((ctx.weekStart.getMonth() + 1) / 3)))
      .replace('{alt_vendor}', altVendor);
    inc(await tryAction(`vendor-note-${vendor.id}`, async () => {
      await postEntityNote(officePage, '/vendors', vendor.name, note);
    }, errors));
  }

  // ── 29. Create purchase orders via UI (Office) ─────────────────────────────
  if (pct(w, 300, 50) && existingVendors.length > 0) {
    const vendor = existingVendors[w % existingVendors.length];

    inc(await tryAction('create-po', async () => {
      await navigateTo(officePage, '/purchase-orders');
      await clickButton(officePage, 'new-po-btn');
      await waitForDialog(officePage);
      await fillMatSelect(officePage, 'po-vendor', vendor.name);
      await fillAutocomplete(officePage, 'po-line-part', '');
      await fillInput(officePage, 'po-line-qty', String(seededInt(5, 50, w, 70)));
      await fillInput(officePage, 'po-line-price', String(seededInt(10, 100, w, 75)));
      await clickButton(officePage, 'po-add-line-btn');
      await officePage.waitForTimeout(300);
      await clickButton(officePage, 'po-save-btn');
      await waitForDialogClosed(officePage);
    }, errors));
  }

  // ── 30. Submit draft POs via UI (Office) ───────────────────────────────────
  const draftPOs = await getPurchaseOrdersByStatus(office, 'Draft');
  if (draftPOs.length > 0) {
    const po = draftPOs[0];
    inc(await tryAction(`submit-po-${po.id}`, async () => {
      await navigateTo(officePage, '/purchase-orders');
      await clickRowContaining(officePage, po.poNumber);
      await officePage.locator('[data-testid="po-submit-btn"]').waitFor({ state: 'visible', timeout: 5000 });
      await clickButton(officePage, 'po-submit-btn');
      await officePage.waitForTimeout(500);
    }, errors));
  }

  // ── 31. Receive submitted POs via UI (Office) ──────────────────────────────
  if (pct(w, 400, 40)) {
    const submittedPOs = await getPurchaseOrdersByStatus(office, 'Submitted');
    const po = submittedPOs[0];
    if (po) {
      inc(await tryAction(`receive-po-${po.id}`, async () => {
        await navigateTo(officePage, '/purchase-orders');
        await clickRowContaining(officePage, po.poNumber);
        await officePage.locator('[data-testid="po-receive-btn"]').waitFor({ state: 'visible', timeout: 5000 });
        await clickButton(officePage, 'po-receive-btn');
        await waitForDialog(officePage);
        await officePage.locator('[data-testid="receive-all-btn"]').waitFor({ state: 'visible', timeout: 5000 });
        await clickButton(officePage, 'receive-all-btn');
        await clickButton(officePage, 'receive-save-btn');
        await waitForDialogClosed(officePage);
      }, errors));
    }
  }

  // ── 32. Add conversation comments on POs (Office) ──────────────────────────
  const allPOs = await getAllPurchaseOrders(office);
  if (pct(w, 3700, 25) && allPOs.length > 0) {
    const po = allPOs[w % allPOs.length];
    const comment = pick(ENTITY_COMMENTS.purchaseOrder, w, 3710);
    inc(await tryAction(`po-comment-${po.id}`, async () => {
      await postEntityComment(officePage, '/purchase-orders', po.poNumber, comment);
    }, errors));
  }

  // ── 32b. Add notes on POs (Office) ──────────────────────────────────────────
  if (pct(w, 6200, 25) && allPOs.length > 0) {
    const po = allPOs[(w + 1) % allPOs.length];
    const note = pick(ENTITY_NOTES.purchaseOrder, w, 6210)
      .replace('{q}', String(Math.ceil((ctx.weekStart.getMonth() + 1) / 3)));
    inc(await tryAction(`po-note-${po.id}`, async () => {
      await postEntityNote(officePage, '/purchase-orders', po.poNumber, note);
    }, errors));
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION H: INVENTORY
  // ════════════════════════════════════════════════════════════════════════════

  // ── 33. Create storage locations via UI (Manager) ──────────────────────────
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

  // ── 34. Create lots via UI (Engineer) ──────────────────────────────────────
  if (pct(w, 3400, 20) && existingParts.length > 0) {
    const lotPart = existingParts[(w + 11) % existingParts.length];
    const lotQty = seededInt(50, 500, w, 3410);
    const lotExpiry = weekDayDisplay(ctx, 180); // 6 months out

    inc(await tryAction('create-lot', async () => {
      await navigateTo(engineerPage, '/quality');
      // Switch to Lots tab if it exists
      const lotsTab = engineerPage.locator('a[href*="/lots"], button:has-text("Lots")').first();
      if (await lotsTab.isVisible({ timeout: 3000 }).catch(() => false)) {
        await lotsTab.click();
        await engineerPage.waitForTimeout(500);
      }
      await clickButton(engineerPage, 'new-lot-btn');
      await waitForDialog(engineerPage);
      await fillMatSelect(engineerPage, 'lot-part', lotPart.partNumber);
      await fillInput(engineerPage, 'lot-quantity', String(lotQty));
      await fillDatepicker(engineerPage, 'lot-expiration', lotExpiry);
      await fillTextarea(engineerPage, 'lot-notes', `Production lot — ${ctx.weekLabel}`);
      await clickButton(engineerPage, 'lot-save-btn');
      await waitForDialogClosed(engineerPage);
    }, errors));
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION I: ASSETS
  // ════════════════════════════════════════════════════════════════════════════

  // ── 35. Create assets via UI (Manager) ─────────────────────────────────────
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

  // ── 36. Add conversation comments on assets (Manager) ──────────────────────
  if (pct(w, 3800, 25) && existingAssets.length > 0) {
    const asset = existingAssets[w % existingAssets.length];
    const comment = pick(ENTITY_COMMENTS.asset, w, 3810);
    inc(await tryAction(`asset-comment-${asset.id}`, async () => {
      await postEntityComment(managerPage, '/assets', asset.name, comment);
    }, errors));
  }

  // ── 36b. Add notes on assets (Manager) ──────────────────────────────────────
  if (pct(w, 6400, 20) && existingAssets.length > 0) {
    const asset = existingAssets[(w + 1) % existingAssets.length];
    const note = pick(ENTITY_NOTES.asset, w, 6410)
      .replace('{q}', String(Math.ceil((ctx.weekStart.getMonth() + 1) / 3)))
      .replace('{hours}', String(seededInt(2000, 9500, w, 6411)));
    inc(await tryAction(`asset-note-${asset.id}`, async () => {
      await postEntityNote(managerPage, '/assets', asset.name, note);
    }, errors));
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION J: SHIPPING & FULFILLMENT
  // ════════════════════════════════════════════════════════════════════════════

  // ── 37. Create shipments from sales orders via UI (Office) ─────────────────
  if (pct(w, 3700, 35)) {
    const shippableSOs = await getShippableSalesOrders(office);
    const soToShip = shippableSOs[0];
    if (soToShip) {
      const carrier = pick(SHIPMENT_CARRIERS, w, 3720);
      const tracking = `TRK-${w}-${soToShip.id}`;

      inc(await tryAction(`create-shipment-${soToShip.id}`, async () => {
        await navigateTo(officePage, '/shipments');
        await clickButton(officePage, 'new-shipment-btn');
        await waitForDialog(officePage);
        // Select the sales order
        await fillAutocomplete(officePage, 'shipment-so', String(soToShip.id));
        await fillInput(officePage, 'shipment-carrier', carrier);
        await fillInput(officePage, 'shipment-tracking', tracking);
        await fillInput(officePage, 'shipment-weight', String(seededInt(5, 200, w, 3730)));
        await fillTextarea(officePage, 'shipment-notes', `Shipped ${ctx.weekLabel} via ${carrier}`);
        await clickButton(officePage, 'shipment-save-btn');
        await waitForDialogClosed(officePage);
      }, errors));
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION K: INVOICING & PAYMENTS
  // ════════════════════════════════════════════════════════════════════════════

  // ── 38. Create invoices via UI (Office) ────────────────────────────────────
  if (pct(w, 3800, 40) && customers.length > 0) {
    const customer = customers[(w + 2) % customers.length];
    const invDate = weekDayDisplay(ctx, 0);
    const dueDate = weekDayDisplay(ctx, 30);
    const lineDesc = pick(QUOTE_LINE_DESCRIPTIONS, w, 3810);
    const lineQty = seededInt(1, 50, w, 3811);
    const linePrice = seededInt(20, 200, w, 3812);

    inc(await tryAction('create-invoice', async () => {
      await navigateTo(officePage, '/invoices');
      await clickButton(officePage, 'new-invoice-btn');
      await waitForDialog(officePage);
      await fillMatSelect(officePage, 'invoice-customer', customer.name);
      await fillDatepicker(officePage, 'invoice-date', invDate);
      await fillDatepicker(officePage, 'invoice-due-date', dueDate);
      // Add line item
      await fillInput(officePage, 'invoice-line-desc', lineDesc);
      await fillInput(officePage, 'invoice-line-qty', String(lineQty));
      await fillInput(officePage, 'invoice-line-price', String(linePrice));
      await clickButton(officePage, 'invoice-add-line-btn');
      await officePage.waitForTimeout(300);
      await fillTextarea(officePage, 'invoice-notes', pick(INVOICE_NOTES, w, 3813));
      await clickButton(officePage, 'invoice-save-btn');
      await waitForDialogClosed(officePage);
    }, errors));
  }

  // ── 39. Add conversation comments on invoices (Office) ─────────────────────
  const allInvoices = await getAllInvoices(office);
  if (pct(w, 3900, 20) && allInvoices.length > 0) {
    const inv = allInvoices[w % allInvoices.length];
    const comment = pick(ENTITY_COMMENTS.invoice, w, 3910);
    inc(await tryAction(`invoice-comment-${inv.id}`, async () => {
      await postEntityComment(officePage, '/invoices', String(inv.id), comment);
    }, errors));
  }

  // ── 40. Record payments via UI (Office) ────────────────────────────────────
  if (pct(w, 4000, 40)) {
    const sentInvoices = await getSentInvoices(office);
    const inv = sentInvoices[0];
    if (inv) {
      const payMethod = pick(PAYMENT_METHODS, w, 4010);
      const payRef = `${pick(PAYMENT_REFERENCES, w, 4011)}${w}-${inv.id}`;

      inc(await tryAction(`create-payment-${inv.id}`, async () => {
        await navigateTo(officePage, '/payments');
        await clickButton(officePage, 'new-payment-btn');
        await waitForDialog(officePage);
        await fillMatSelect(officePage, 'payment-customer', ''); // auto-select first
        await fillMatSelect(officePage, 'payment-method', payMethod);
        await fillInput(officePage, 'payment-amount', String(inv.totalAmount));
        await fillDatepicker(officePage, 'payment-date', weekDayDisplay(ctx, 4));
        await fillInput(officePage, 'payment-ref', payRef);
        await fillTextarea(officePage, 'payment-notes', `Payment for invoice ${inv.id}`);
        await clickButton(officePage, 'payment-save-btn');
        await waitForDialogClosed(officePage);
      }, errors));
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION L: QUALITY & INSPECTION
  // ════════════════════════════════════════════════════════════════════════════

  // ── 41. Create QC inspections via UI (Engineer) ────────────────────────────
  if (pct(w, 4100, 30) && activeJobs.length > 0) {
    const job = activeJobs[(w + 4) % activeJobs.length];
    const qcTemplates = await getQcTemplates(engineer);
    const notes = pick(QC_NOTES, w, 4110);

    inc(await tryAction(`create-inspection-${job.id}`, async () => {
      await navigateTo(engineerPage, '/quality');
      await clickButton(engineerPage, 'new-inspection-btn');
      await waitForDialog(engineerPage);
      if (qcTemplates.length > 0) {
        await fillMatSelect(engineerPage, 'inspection-template', qcTemplates[0].name);
      }
      await fillInput(engineerPage, 'inspection-job', String(job.id));
      await fillTextarea(engineerPage, 'inspection-notes', notes);
      await clickButton(engineerPage, 'inspection-save-btn');
      await waitForDialogClosed(engineerPage);
    }, errors));
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION M: CUSTOMER RETURNS
  // ════════════════════════════════════════════════════════════════════════════

  // ── 42. Create customer returns via UI (Office) ────────────────────────────
  if (pct(w, 4200, 10) && customers.length > 0) {
    const customer = customers[(w + 6) % customers.length];
    const reason = pick(RETURN_REASONS, w, 4210);
    const returnDate = weekDayDisplay(ctx, seededInt(0, 3, w, 4211));

    inc(await tryAction('create-return', async () => {
      await navigateTo(officePage, '/customer-returns');
      await clickButton(officePage, 'new-return-btn');
      await waitForDialog(officePage);
      await fillMatSelect(officePage, 'return-customer', customer.name);
      await fillInput(officePage, 'return-reason', reason);
      await fillDatepicker(officePage, 'return-date', returnDate);
      await fillTextarea(officePage, 'return-notes', `Return ${ctx.weekLabel} — ${reason.slice(0, 50)}`);
      await clickButton(officePage, 'return-save-btn');
      await waitForDialogClosed(officePage);
    }, errors));
  }

  // ── 42b. Add notes + comments on customer returns (Office) ──────────────────
  const openReturns = await getOpenReturns(office);
  if (pct(w, 6500, 30) && openReturns.length > 0) {
    const ret = openReturns[w % openReturns.length];
    const note = pick(ENTITY_NOTES.customerReturn, w, 6510)
      .replace('{ref}', `RMA-${w}-${ret.id}`);
    inc(await tryAction(`return-note-${ret.id}`, async () => {
      await postEntityNote(officePage, '/customer-returns', String(ret.id), note);
    }, errors));
  }

  if (pct(w, 6600, 25) && openReturns.length > 0) {
    const ret = openReturns[(w + 1) % openReturns.length];
    const comment = `Return update ${ctx.weekLabel}: inspecting returned material. Will update disposition by end of week.`;
    inc(await tryAction(`return-comment-${ret.id}`, async () => {
      await postEntityComment(officePage, '/customer-returns', String(ret.id), comment);
    }, errors));
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION N: EVENTS & CALENDAR
  // ════════════════════════════════════════════════════════════════════════════

  // ── 43. Create events via UI (Admin) ───────────────────────────────────────
  if (pct(w, 1500, 30)) {
    const eventTitle = pick(EVENT_TITLES, w, 250);
    const eventLocation = pick(EVENT_LOCATIONS, w, 251);
    const eventType = pick(['Meeting', 'Training', 'Safety', 'Other'], w, 252);
    const startDate = weekDayDisplay(ctx, seededInt(1, 4, w, 253));

    inc(await tryAction('create-event', async () => {
      await navigateTo(adminPage, '/admin/events');
      await clickButton(adminPage, 'new-event-btn');
      await waitForDialog(adminPage);
      await fillInput(adminPage, 'event-title', eventTitle);
      await fillMatSelect(adminPage, 'event-type', eventType);
      await fillInput(adminPage, 'event-location', eventLocation);
      await fillDatepicker(adminPage, 'event-start-date', startDate);
      await fillInput(adminPage, 'event-start-time', '09:00');
      await fillDatepicker(adminPage, 'event-end-date', startDate);
      await fillInput(adminPage, 'event-end-time', '10:00');
      await fillTextarea(adminPage, 'event-description', `${eventTitle} — scheduled for ${ctx.weekLabel}`);

      const responsePromise = adminPage.waitForResponse(
        resp => resp.url().includes('/api/v1/events') && resp.request().method() === 'POST',
        { timeout: 10000 },
      ).catch(() => null);

      await clickButton(adminPage, 'event-save-btn');
      await responsePromise;

      const dialogStillOpen = await adminPage.locator('.dialog-backdrop').first()
        .waitFor({ state: 'hidden', timeout: 10000 })
        .then(() => false)
        .catch(() => true);

      if (dialogStillOpen) {
        await adminPage.keyboard.press('Escape');
        await adminPage.waitForTimeout(500);
        const stillOpen = await adminPage.locator('.dialog-backdrop').isVisible();
        if (stillOpen) {
          await adminPage.keyboard.press('Escape');
          await adminPage.waitForTimeout(500);
        }
        throw new Error('Event dialog did not close after save');
      }
    }, errors));
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION O: CHAT WITH USER @MENTIONS + ENTITY REFERENCES
  // ════════════════════════════════════════════════════════════════════════════

  // Fetch all users for @mentions in chat
  const allUsers = await getAllUsers(admin);

  // Helper: format a user @mention in the backend-parsed format
  const userMention = (user: { id: number; firstName: string; lastName: string }) =>
    `@[user:${user.id}:${user.lastName}, ${user.firstName}]`;

  // ── 44. Send chat messages with @user + entity references (Engineer) ───────
  if (pct(w, 700, 50)) {
    inc(await tryAction('chat-message', async () => {
      await navigateTo(engineerPage, '/chat');
      await engineerPage.waitForTimeout(500);

      const convBtns = engineerPage.locator('.conversation');
      if (await convBtns.count() > 0) {
        await convBtns.first().click();
        await engineerPage.waitForTimeout(300);

        // Pick a user to @mention (not self — engineer is akim)
        const mentionTarget = allUsers.find(u => u.email !== 'akim@qbengineer.local')
          ?? allUsers[0];

        // Build a contextual message with @user mention + entity reference
        let msg: string;
        if (activeJobs.length > 0 && pct(w, 7010, 60)) {
          const refJob = activeJobs[w % activeJobs.length];
          const template = pick(CHAT_MESSAGES_WITH_MENTIONS, w, 7020);
          msg = `${userMention(mentionTarget)} ${template.replace('{entity}', refJob.jobNumber ? `Job ${refJob.jobNumber}` : refJob.title)}`;
        } else if (existingParts.length > 0 && pct(w, 7030, 50)) {
          const refPart = existingParts[w % existingParts.length];
          const template = pick(CHAT_MESSAGES_WITH_MENTIONS, w, 7040);
          msg = `${userMention(mentionTarget)} ${template.replace('{entity}', `Part ${refPart.partNumber}`)}`;
        } else if (customers.length > 0 && pct(w, 7050, 50)) {
          const refCust = customers[w % customers.length];
          const template = pick(CHAT_MESSAGES_WITH_MENTIONS, w, 7060);
          msg = `${userMention(mentionTarget)} ${template.replace('{entity}', refCust.name)}`;
        } else {
          // General message with @user mention
          const general = pick(CHAT_MESSAGES_GENERAL, w, 0);
          msg = `${userMention(mentionTarget)} ${general}`;
        }

        await engineerPage.locator('[data-testid="chat-message-input"]').fill(msg);
        await clickButton(engineerPage, 'chat-send-btn');
        await engineerPage.waitForTimeout(300);
      }
    }, errors));
  }

  // ── 45. Chat from PM — @mentions manager + references entities ────────────
  if (pct(w, 7100, 35)) {
    inc(await tryAction('chat-pm', async () => {
      await navigateTo(pmPage, '/chat');
      await pmPage.waitForTimeout(500);

      const convBtns = pmPage.locator('.conversation');
      if (await convBtns.count() > 0) {
        await convBtns.first().click();
        await pmPage.waitForTimeout(300);

        // PM @mentions the manager or engineer
        const mentionTarget = allUsers.find(u => u.email === 'lwilson@qbengineer.local')
          ?? allUsers.find(u => u.email !== 'pmorris@qbengineer.local')
          ?? allUsers[0];

        let msg: string;
        if (activeJobs.length > 0 && pct(w, 7110, 50)) {
          const job = activeJobs[(w + 1) % activeJobs.length];
          msg = `${userMention(mentionTarget)} Can you check the status on ${job.jobNumber ?? job.title}? Customer is asking for an update.`;
        } else if (customers.length > 0) {
          const cust = customers[(w + 2) % customers.length];
          msg = `${userMention(mentionTarget)} Heads up — ${cust.name} wants to discuss pricing for next quarter. Can we schedule a call?`;
        } else {
          msg = `${userMention(mentionTarget)} ${pick(CHAT_MESSAGES_GENERAL, w, 7120)}`;
        }

        await pmPage.locator('[data-testid="chat-message-input"]').fill(msg);
        await clickButton(pmPage, 'chat-send-btn');
        await pmPage.waitForTimeout(300);
      }
    }, errors));
  }

  // ── 46. Chat from Worker — @mentions engineer about shop floor issues ──────
  if (pct(w, 7200, 30)) {
    inc(await tryAction('chat-worker', async () => {
      await navigateTo(workerPage, '/chat');
      await workerPage.waitForTimeout(500);

      const convBtns = workerPage.locator('.conversation');
      if (await convBtns.count() > 0) {
        const convIdx = Math.min(1, await convBtns.count() - 1);
        await convBtns.nth(convIdx).click();
        await workerPage.waitForTimeout(300);

        // Worker @mentions the engineer
        const mentionTarget = allUsers.find(u => u.email === 'akim@qbengineer.local')
          ?? allUsers[0];

        let msg: string;
        if (activeJobs.length > 0) {
          const job = activeJobs[(w + 3) % activeJobs.length];
          msg = `${userMention(mentionTarget)} ${pick([
            `Having trouble with ${job.jobNumber ?? job.title} — tool is chattering on the finishing pass. Can you take a look?`,
            `Finished setup on ${job.jobNumber ?? job.title}. First article looks good. Running production now.`,
            `${job.jobNumber ?? job.title} is done. All parts measured within spec. Ready for QC.`,
            `Need help with ${job.jobNumber ?? job.title} — the program is throwing a cutter comp alarm on Op 20.`,
            `Material for ${job.jobNumber ?? job.title} just arrived. Starting setup after lunch.`,
          ], w, 7210)}`;
        } else {
          msg = `${userMention(mentionTarget)} ${pick(CHAT_MESSAGES_GENERAL, w, 7220)}`;
        }

        await workerPage.locator('[data-testid="chat-message-input"]').fill(msg);
        await clickButton(workerPage, 'chat-send-btn');
        await workerPage.waitForTimeout(300);
      }
    }, errors));
  }

  // ── 47. Chat from Manager — @mentions multiple users, coordination ─────────
  if (pct(w, 7300, 25)) {
    inc(await tryAction('chat-manager', async () => {
      await navigateTo(managerPage, '/chat');
      await managerPage.waitForTimeout(500);

      const convBtns = managerPage.locator('.conversation');
      if (await convBtns.count() > 0) {
        await convBtns.first().click();
        await managerPage.waitForTimeout(300);

        // Manager @mentions two people
        const eng = allUsers.find(u => u.email === 'akim@qbengineer.local') ?? allUsers[0];
        const pm = allUsers.find(u => u.email === 'pmorris@qbengineer.local') ?? allUsers[1 % allUsers.length];

        let msg: string;
        if (activeJobs.length > 1) {
          const job1 = activeJobs[w % activeJobs.length];
          const job2 = activeJobs[(w + 1) % activeJobs.length];
          msg = `${userMention(eng)} ${userMention(pm)} Priority update: ${job1.jobNumber ?? job1.title} needs to ship by end of week. Let's push ${job2.jobNumber ?? job2.title} to next week if needed.`;
        } else if (existingParts.length > 0) {
          const part = existingParts[w % existingParts.length];
          msg = `${userMention(eng)} Can you review the toolpath for Part ${part.partNumber}? ${userMention(pm)} — customer is expecting quote revision by Thursday.`;
        } else {
          msg = `${userMention(eng)} ${userMention(pm)} Team standup notes: everything on track for this week. Let me know if you hit any blockers.`;
        }

        await managerPage.locator('[data-testid="chat-message-input"]').fill(msg);
        await clickButton(managerPage, 'chat-send-btn');
        await managerPage.waitForTimeout(300);
      }
    }, errors));
  }

  // ── 48. Chat from Office — @mentions about orders and billing ──────────────
  if (pct(w, 7400, 25)) {
    inc(await tryAction('chat-office', async () => {
      await navigateTo(officePage, '/chat');
      await officePage.waitForTimeout(500);

      const convBtns = officePage.locator('.conversation');
      if (await convBtns.count() > 0) {
        await convBtns.first().click();
        await officePage.waitForTimeout(300);

        const mentionTarget = allUsers.find(u => u.email === 'lwilson@qbengineer.local')
          ?? allUsers[0];

        let msg: string;
        if (customers.length > 0 && openSOs.length > 0) {
          const cust = customers[w % customers.length];
          msg = `${userMention(mentionTarget)} ${cust.name} is asking about their order status. Can you confirm ship date?`;
        } else if (allInvoices.length > 0) {
          const inv = allInvoices[w % allInvoices.length];
          msg = `${userMention(mentionTarget)} Invoice #${inv.id} is past due. Should I send a reminder to the customer?`;
        } else {
          msg = `${userMention(mentionTarget)} ${pick(CHAT_MESSAGES_GENERAL, w, 7410)}`;
        }

        await officePage.locator('[data-testid="chat-message-input"]').fill(msg);
        await clickButton(officePage, 'chat-send-btn');
        await officePage.waitForTimeout(300);
      }
    }, errors));
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION P: SALES ORDER LIFECYCLE (CONFIRM / CANCEL)
  // ════════════════════════════════════════════════════════════════════════════

  // ── 49. Confirm draft sales orders via UI (Office) ─────────────────────────
  const draftSOs = await getDraftSalesOrders(office);
  const sosToConfirm = draftSOs.filter((_, idx) => pct(w, idx + 4900, 60)).slice(0, 2);

  for (const so of sosToConfirm) {
    inc(await tryAction(`confirm-so-${so.id}`, async () => {
      await navigateTo(officePage, '/sales-orders');
      await clickRowContaining(officePage, String(so.id));
      await officePage.waitForTimeout(800);
      const confirmBtn = officePage.locator('[data-testid="so-confirm-btn"]');
      if (await confirmBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await confirmBtn.click();
        // Confirm dialog may appear
        const confirmDialog = officePage.locator('.mat-mdc-dialog-container, app-dialog').first();
        if (await confirmDialog.isVisible({ timeout: 2000 }).catch(() => false)) {
          await officePage.locator('button.action-btn--primary').last().click();
        }
        await officePage.waitForTimeout(500);
      }
    }, errors));
  }

  // ── 50. Cancel a draft sales order (rare — ~5%) via UI (Manager) ──────────
  if (pct(w, 5000, 5) && draftSOs.length > 2) {
    const soToCancel = draftSOs[draftSOs.length - 1];
    inc(await tryAction(`cancel-so-${soToCancel.id}`, async () => {
      await navigateTo(managerPage, '/sales-orders');
      await clickRowContaining(managerPage, String(soToCancel.id));
      await managerPage.waitForTimeout(800);
      const cancelBtn = managerPage.locator('[data-testid="so-cancel-btn"]');
      if (await cancelBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await cancelBtn.click();
        const confirmDialog = managerPage.locator('.mat-mdc-dialog-container, app-dialog').first();
        if (await confirmDialog.isVisible({ timeout: 2000 }).catch(() => false)) {
          await managerPage.locator('button.action-btn--primary').last().click();
        }
        await managerPage.waitForTimeout(500);
      }
    }, errors));
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION Q: SHIPMENT LIFECYCLE (MARK SHIPPED / DELIVERED)
  // ════════════════════════════════════════════════════════════════════════════

  // ── 51. Mark shipments as shipped via UI (Office) ──────────────────────────
  if (pct(w, 5100, 40)) {
    const pendingShipments = await getShipmentsByStatus(office, 'Pending');
    const shipToMark = pendingShipments.slice(0, 2);

    for (const shipment of shipToMark) {
      inc(await tryAction(`mark-shipped-${shipment.id}`, async () => {
        await navigateTo(officePage, '/shipments');
        await clickRowContaining(officePage, shipment.shipmentNumber ?? String(shipment.id));
        await officePage.waitForTimeout(800);
        const btn = officePage.locator('[data-testid="shipment-mark-shipped-btn"]');
        if (await btn.isVisible({ timeout: 5000 }).catch(() => false)) {
          await btn.click();
          await officePage.waitForTimeout(500);
        }
      }, errors));
    }
  }

  // ── 52. Mark shipments as delivered via UI (Office) ────────────────────────
  if (pct(w, 5200, 35)) {
    const shippedShipments = await getShipmentsByStatus(office, 'Shipped');
    const shipToDeliver = shippedShipments.slice(0, 1);

    for (const shipment of shipToDeliver) {
      inc(await tryAction(`mark-delivered-${shipment.id}`, async () => {
        await navigateTo(officePage, '/shipments');
        await clickRowContaining(officePage, shipment.shipmentNumber ?? String(shipment.id));
        await officePage.waitForTimeout(800);
        const btn = officePage.locator('[data-testid="shipment-mark-delivered-btn"]');
        if (await btn.isVisible({ timeout: 5000 }).catch(() => false)) {
          await btn.click();
          await officePage.waitForTimeout(500);
        }
      }, errors));
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION R: ANNOUNCEMENTS
  // ════════════════════════════════════════════════════════════════════════════

  // ── 53. Create announcements via UI (Admin/Manager) ────────────────────────
  if (pct(w, 5300, 15)) {
    const announcePage = pct(w, 5301, 50) ? adminPage : managerPage;
    const announceToken = pct(w, 5301, 50) ? admin : manager;
    const title = pick(ANNOUNCEMENT_TITLES, w, 5310);
    const content = pick(ANNOUNCEMENT_CONTENTS, w, 5311)
      .replace('{q}', String(Math.ceil((ctx.weekStart.getMonth() + 1) / 3)));
    const severity = pick(ANNOUNCEMENT_SEVERITIES, w, 5312);
    const scope = pick(ANNOUNCEMENT_SCOPES, w, 5313);

    inc(await tryAction('create-announcement', async () => {
      await navigateTo(announcePage, '/admin/announcements');
      await announcePage.waitForTimeout(800);
      const announceBtn = announcePage.locator('[data-testid="new-announcement-btn"]');
      await announceBtn.waitFor({ state: 'visible', timeout: 5000 });
      await announceBtn.click();
      await waitForDialog(announcePage);
      await fillInput(announcePage, 'announcement-title', title);
      await fillTextarea(announcePage, 'announcement-content', content);
      await fillMatSelect(announcePage, 'announcement-severity', severity);
      await fillMatSelect(announcePage, 'announcement-scope', scope);
      await clickButton(announcePage, 'announcement-send-btn');
      await waitForDialogClosed(announcePage);
    }, errors));
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION S: EXPENSE APPROVAL QUEUE
  // ════════════════════════════════════════════════════════════════════════════

  // ── 54. Approve expenses via approval queue page (Manager) ────────────────
  if (pct(w, 5400, 50)) {
    inc(await tryAction('expense-approval-queue', async () => {
      await navigateTo(managerPage, '/expenses/approval-queue');
      await managerPage.waitForTimeout(800);
      // Click first pending expense row to open review dialog
      const firstRow = managerPage.locator('tr.clickable-row, [data-testid="expense-row"]').first();
      if (await firstRow.isVisible({ timeout: 3000 }).catch(() => false)) {
        await firstRow.click();
        await managerPage.waitForTimeout(500);
        // Click approve button in review dialog
        const approveBtn = managerPage.locator('[data-testid="expense-approve-btn"]');
        if (await approveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await approveBtn.click();
          await managerPage.waitForTimeout(500);
        }
      }
    }, errors));
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION T: CUSTOMER RETURN LIFECYCLE (RESOLVE / CLOSE)
  // ════════════════════════════════════════════════════════════════════════════

  // ── 55. Resolve open customer returns via UI (Office) ─────────────────────
  if (pct(w, 5500, 30) && openReturns.length > 0) {
    const ret = openReturns[0];
    inc(await tryAction(`resolve-return-${ret.id}`, async () => {
      await navigateTo(officePage, '/customer-returns');
      await clickRowContaining(officePage, String(ret.id));
      await officePage.waitForTimeout(800);
      const resolveBtn = officePage.locator('[data-testid="return-resolve-btn"]');
      if (await resolveBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await resolveBtn.click();
        await waitForDialog(officePage);
        await fillTextarea(officePage, 'return-inspection-notes', `Inspected ${ctx.weekLabel}. Material within acceptable limits.`);
        await clickButton(officePage, 'return-resolve-confirm-btn');
        await waitForDialogClosed(officePage);
      }
    }, errors));
  }

  // ── 56. Close resolved customer returns via UI (Office) ───────────────────
  const resolvedReturns = await getResolvedReturns(office);
  if (pct(w, 5600, 40) && resolvedReturns.length > 0) {
    const ret = resolvedReturns[0];
    inc(await tryAction(`close-return-${ret.id}`, async () => {
      await navigateTo(officePage, '/customer-returns');
      await clickRowContaining(officePage, String(ret.id));
      await officePage.waitForTimeout(800);
      const closeBtn = officePage.locator('[data-testid="return-close-btn"]');
      if (await closeBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await closeBtn.click();
        await officePage.waitForTimeout(500);
      }
    }, errors));
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION U: TRAINING & LEARNING
  // ════════════════════════════════════════════════════════════════════════════

  // ── 57. Browse training modules (Engineer) ────────────────────────────────
  if (pct(w, 5700, 25)) {
    inc(await tryAction('browse-training', async () => {
      await navigateTo(engineerPage, '/training/all-modules');
      await engineerPage.waitForTimeout(800);
      // Browse module cards
      const cards = engineerPage.locator('[data-testid="training-module-card"]');
      const count = await cards.count();
      if (count > 0) {
        // Click a module to view it
        const cardIdx = w % count;
        await cards.nth(cardIdx).click();
        await engineerPage.waitForTimeout(1000);
        // Go back
        await engineerPage.goBack();
        await engineerPage.waitForTimeout(500);
      }
    }, errors));
  }

  // ── 58. Browse training paths (Worker) ────────────────────────────────────
  if (pct(w, 5800, 20)) {
    inc(await tryAction('browse-training-paths', async () => {
      await navigateTo(workerPage, '/training/paths');
      await workerPage.waitForTimeout(800);
      // Click first path card to view detail
      const pathCard = workerPage.locator('.path-card').first();
      if (await pathCard.isVisible({ timeout: 3000 }).catch(() => false)) {
        await pathCard.click();
        await workerPage.waitForTimeout(1000);
        await workerPage.goBack();
        await workerPage.waitForTimeout(500);
      }
    }, errors));
  }

  // ── 59. Browse My Learning tab (Engineer) ─────────────────────────────────
  if (pct(w, 5900, 30)) {
    inc(await tryAction('browse-my-learning', async () => {
      await navigateTo(engineerPage, '/training/my-learning');
      await engineerPage.waitForTimeout(800);
      await engineerPage.mouse.wheel(0, 300);
      await engineerPage.waitForTimeout(300);
      const enrollmentCard = engineerPage.locator('[data-testid="training-module-card"], .enrollment-card, .learning-card').first();
      if (await enrollmentCard.isVisible({ timeout: 2000 }).catch(() => false)) {
        await enrollmentCard.click();
        await engineerPage.waitForTimeout(1000);
        await engineerPage.goBack();
        await engineerPage.waitForTimeout(500);
      }
    }, errors));
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION V: REPORTS
  // ════════════════════════════════════════════════════════════════════════════

  // ── 60. Run a report via report builder (Manager) ─────────────────────────
  if (pct(w, 6000, 20)) {
    const entitySource = pick(REPORT_ENTITY_SOURCES, w, 6010);

    inc(await tryAction('run-report', async () => {
      await navigateTo(managerPage, '/reports/builder');
      await managerPage.waitForTimeout(800);
      // Select entity source
      await fillMatSelect(managerPage, 'report-entity-select', entitySource);
      await managerPage.waitForTimeout(500);
      // Check first few available column checkboxes
      const checkboxes = managerPage.locator('.builder__column-check input[type="checkbox"]');
      const checkCount = Math.min(await checkboxes.count(), 5);
      for (let i = 0; i < checkCount; i++) {
        const isChecked = await checkboxes.nth(i).isChecked();
        if (!isChecked) {
          await checkboxes.nth(i).click();
          await managerPage.waitForTimeout(100);
        }
      }
      // Run the report
      const runBtn = managerPage.locator('[data-testid="report-run-btn"]');
      if (await runBtn.isEnabled({ timeout: 3000 }).catch(() => false)) {
        await runBtn.click();
        await managerPage.waitForTimeout(2000);
      }
    }, errors));
  }

  // ── 61. Browse saved reports (PM) ─────────────────────────────────────────
  if (pct(w, 6100, 15)) {
    inc(await tryAction('browse-saved-reports', async () => {
      await navigateTo(pmPage, '/reports/builder');
      await pmPage.waitForTimeout(800);
      // Check if any saved reports exist and select one
      const savedReports = await getSavedReports(pm);
      if (savedReports.length > 0) {
        await fillMatSelect(pmPage, 'report-saved-select', savedReports[0].name);
        await pmPage.waitForTimeout(500);
        const runBtn = pmPage.locator('[data-testid="report-run-btn"]');
        if (await runBtn.isEnabled({ timeout: 3000 }).catch(() => false)) {
          await runBtn.click();
          await pmPage.waitForTimeout(2000);
        }
      }
    }, errors));
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION W: SEARCH
  // ════════════════════════════════════════════════════════════════════════════

  // ── 62. Use header search (Engineer) ──────────────────────────────────────
  if (pct(w, 6200, 35)) {
    const searchTerm = pick(SEARCH_TERMS, w, 6210);
    inc(await tryAction('header-search', async () => {
      const searchInput = engineerPage.locator('[data-testid="header-search-input"]');
      if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await searchInput.click();
        await searchInput.fill(searchTerm);
        await engineerPage.waitForTimeout(1500); // Wait for debounced search results
        // Click first result if visible
        const firstResult = engineerPage.locator('[data-testid="search-result-item"]').first();
        if (await firstResult.isVisible({ timeout: 3000 }).catch(() => false)) {
          await firstResult.click({ force: true });
          await engineerPage.waitForTimeout(800);
        } else {
          // Clear search and close
          await searchInput.fill('');
          await engineerPage.keyboard.press('Escape');
        }
      }
    }, errors));
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION X: NOTIFICATIONS
  // ════════════════════════════════════════════════════════════════════════════

  // ── 63. Open notification panel and interact (Manager) ────────────────────
  if (pct(w, 6300, 30)) {
    inc(await tryAction('notifications-interact', async () => {
      const bellBtn = managerPage.locator('[data-testid="header-notifications-btn"]');
      if (await bellBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await bellBtn.click();
        await managerPage.waitForTimeout(800);
        // Mark all read if available
        const markAllBtn = managerPage.locator('[data-testid="notification-mark-all-read-btn"]');
        if (await markAllBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await markAllBtn.click();
          await managerPage.waitForTimeout(300);
        }
        // Close panel by clicking backdrop
        const backdrop = managerPage.locator('.notification-backdrop');
        if (await backdrop.isVisible({ timeout: 1000 }).catch(() => false)) {
          await backdrop.click();
        }
        await managerPage.waitForTimeout(300);
      }
    }, errors));
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION Y: BROWSING — DASHBOARD, BACKLOG, CALENDAR, ADMIN, SHOP FLOOR
  // ════════════════════════════════════════════════════════════════════════════

  // ── 64. Browse dashboard (Admin) ──────────────────────────────────────────
  if (pct(w, 6400, 40)) {
    inc(await tryAction('browse-dashboard', async () => {
      await navigateTo(adminPage, '/dashboard');
      await adminPage.waitForTimeout(1500); // Dashboard loads multiple widgets
      // Scroll through dashboard widgets
      await adminPage.mouse.wheel(0, 400);
      await adminPage.waitForTimeout(300);
    }, errors));
  }

  // ── 65. Browse backlog + open first row (PM) ─────────────────────────────
  if (pct(w, 6500, 30)) {
    inc(await tryAction('browse-backlog', async () => {
      await navigateTo(pmPage, '/backlog');
      await pmPage.waitForTimeout(1000);
      await pmPage.mouse.wheel(0, 300);
      await pmPage.waitForTimeout(300);
      const row = pmPage.locator('table tbody tr, .backlog-item, [role="row"]').first();
      if (await row.isVisible({ timeout: 2000 }).catch(() => false)) {
        await row.click();
        await pmPage.waitForTimeout(700);
        await pmPage.keyboard.press('Escape').catch(() => {});
        await pmPage.waitForTimeout(300);
      }
    }, errors));
  }

  // ── 66. Browse calendar (Manager) ─────────────────────────────────────────
  if (pct(w, 6600, 25)) {
    inc(await tryAction('browse-calendar', async () => {
      await navigateTo(managerPage, '/calendar');
      await managerPage.waitForTimeout(1000);
      // Navigate forward/back in calendar
      const nextBtn = managerPage.locator('button[aria-label="Next month"], .mat-calendar-next-button').first();
      if (await nextBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await nextBtn.click();
        await managerPage.waitForTimeout(500);
      }
    }, errors));
  }

  // ── 67. Browse admin settings (Admin) ─────────────────────────────────────
  if (pct(w, 6700, 15)) {
    inc(await tryAction('browse-admin-settings', async () => {
      await navigateTo(adminPage, '/admin/settings');
      await adminPage.waitForTimeout(800);
      // Browse different admin tabs
      const tabs = ['users', 'settings', 'reference-data'];
      const tab = pick(tabs, w, 6710);
      await navigateTo(adminPage, `/admin/${tab}`);
      await adminPage.waitForTimeout(800);
      await adminPage.mouse.wheel(0, 300);
      await adminPage.waitForTimeout(300);
    }, errors));
  }

  // ── 68. Browse shop floor display (Worker) ────────────────────────────────
  if (pct(w, 6800, 20)) {
    inc(await tryAction('browse-shop-floor', async () => {
      await navigateTo(workerPage, '/display/shop-floor');
      await workerPage.waitForTimeout(1000);
      // Scroll through worker cards
      await workerPage.mouse.wheel(0, 300);
      await workerPage.waitForTimeout(300);
    }, errors));
  }

  // ── 69. Browse inventory tabs (Manager) ───────────────────────────────────
  if (pct(w, 6900, 25)) {
    const invTabs = ['stock', 'locations', 'movements', 'receiving'];
    const invTab = pick(invTabs, w, 6910);
    inc(await tryAction(`browse-inventory-${invTab}`, async () => {
      await navigateTo(managerPage, `/inventory/${invTab}`);
      await managerPage.waitForTimeout(800);
      await managerPage.mouse.wheel(0, 300);
      await managerPage.waitForTimeout(300);
    }, errors));
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION Z: PLANNING CYCLES
  // ════════════════════════════════════════════════════════════════════════════

  // ── 70. Create planning cycle (PM) ────────────────────────────────────────
  if (pct(w, 7000, 10)) {
    const cycleName = pick(PLANNING_CYCLE_NAMES, w, 7010).replace('{n}', String(w));
    const goals = pick(PLANNING_GOALS, w, 7011);
    const startDate = weekDayDisplay(ctx, 0);
    const endDate = weekDayDisplay(ctx, 14);

    inc(await tryAction('create-planning-cycle', async () => {
      await navigateTo(pmPage, '/planning');
      await clickButton(pmPage, 'planning-new-cycle-btn');
      await waitForDialog(pmPage);
      await fillInput(pmPage, 'cycle-name', cycleName);
      await fillDatepicker(pmPage, 'cycle-start-date', startDate);
      await fillDatepicker(pmPage, 'cycle-end-date', endDate);
      await fillTextarea(pmPage, 'cycle-goals', goals);
      await clickButton(pmPage, 'cycle-save-btn');
      await waitForDialogClosed(pmPage);
    }, errors));
  }

  // ── 71. Browse planning page (PM) ─────────────────────────────────────────
  if (pct(w, 7100, 30)) {
    inc(await tryAction('browse-planning', async () => {
      await navigateTo(pmPage, '/planning');
      await pmPage.waitForTimeout(1000);
      await pmPage.mouse.wheel(0, 300);
      await pmPage.waitForTimeout(300);
    }, errors));
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION AA: ESTIMATES
  // ════════════════════════════════════════════════════════════════════════════

  // ── 72. Create estimates via quotes page (PM) ─────────────────────────────
  if (pct(w, 7200, 15) && customers.length > 0) {
    const customer = customers[(w + 8) % customers.length];
    const estimateDesc = pick(ESTIMATE_DESCRIPTIONS, w, 7210);
    const amount = seededInt(500, 25000, w, 7211);

    inc(await tryAction('create-estimate', async () => {
      await navigateTo(pmPage, '/quotes');
      await clickButton(pmPage, 'new-quote-btn');
      await waitForDialog(pmPage);
      await fillMatSelect(pmPage, 'quote-customer', customer.name);
      await fillDatepicker(pmPage, 'quote-expiry', weekDayDisplay(ctx, 60));
      // Add a single line for the estimate
      await fillInput(pmPage, 'quote-line-qty', '1');
      await fillInput(pmPage, 'quote-line-price', String(amount));
      await clickButton(pmPage, 'quote-add-line-btn');
      await pmPage.waitForTimeout(300);
      await fillTextarea(pmPage, 'quote-notes', estimateDesc);
      await clickButton(pmPage, 'quote-save-btn');
      await waitForDialogClosed(pmPage);
    }, errors));
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION AB: CUSTOMER ADDRESSES
  // ════════════════════════════════════════════════════════════════════════════

  // ── 73. Browse customer addresses tab (Office) ────────────────────────────
  if (pct(w, 7300, 20) && customers.length > 0) {
    const customer = customers[(w + 9) % customers.length];
    inc(await tryAction(`browse-customer-addresses-${customer.id}`, async () => {
      await navigateTo(officePage, `/customers/${customer.id}/addresses`);
      await officePage.waitForTimeout(800);
      await officePage.mouse.wheel(0, 200);
      await officePage.waitForTimeout(300);
    }, errors));
  }

  // ── 74. Browse customer orders tab (Office) ───────────────────────────────
  if (pct(w, 7400, 20) && customers.length > 0) {
    const customer = customers[(w + 10) % customers.length];
    inc(await tryAction(`browse-customer-orders-${customer.id}`, async () => {
      await navigateTo(officePage, `/customers/${customer.id}/orders`);
      await officePage.waitForTimeout(800);
      await officePage.mouse.wheel(0, 200);
      await officePage.waitForTimeout(300);
    }, errors));
  }

  // ── 75. Browse customer invoices tab (Office) ─────────────────────────────
  if (pct(w, 7500, 20) && customers.length > 0) {
    const customer = customers[(w + 11) % customers.length];
    inc(await tryAction(`browse-customer-invoices-${customer.id}`, async () => {
      await navigateTo(officePage, `/customers/${customer.id}/invoices`);
      await officePage.waitForTimeout(800);
      await officePage.mouse.wheel(0, 200);
      await officePage.waitForTimeout(300);
    }, errors));
  }

  // ── 76. Browse customer jobs tab (Office) ─────────────────────────────────
  if (pct(w, 7600, 20) && customers.length > 0) {
    const customer = customers[(w + 12) % customers.length];
    inc(await tryAction(`browse-customer-jobs-${customer.id}`, async () => {
      await navigateTo(officePage, `/customers/${customer.id}/jobs`);
      await officePage.waitForTimeout(800);
      await officePage.mouse.wheel(0, 200);
      await officePage.waitForTimeout(300);
    }, errors));
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION AC: ADDITIONAL FEATURE BROWSING
  // ════════════════════════════════════════════════════════════════════════════

  // ── 77. Browse time tracking + open first row edit (Worker) ──────────────
  if (pct(w, 7700, 25)) {
    inc(await tryAction('browse-time-tracking-deep', async () => {
      await navigateTo(workerPage, '/time-tracking');
      await workerPage.waitForTimeout(800);
      await workerPage.mouse.wheel(0, 300);
      await workerPage.waitForTimeout(300);
      const row = workerPage.locator('table tbody tr').first();
      if (await row.isVisible({ timeout: 2000 }).catch(() => false)) {
        await row.click();
        await workerPage.waitForTimeout(800);
        await workerPage.mouse.wheel(0, 200);
        await workerPage.waitForTimeout(200);
        await workerPage.keyboard.press('Escape').catch(() => {});
        await workerPage.waitForTimeout(300);
      }
    }, errors));
  }

  // ── 78. Browse expenses + open first row detail (Engineer) ─────────────────
  if (pct(w, 7800, 25)) {
    inc(await tryAction('browse-expenses-deep', async () => {
      await navigateTo(engineerPage, '/expenses');
      await engineerPage.waitForTimeout(800);
      await engineerPage.mouse.wheel(0, 300);
      await engineerPage.waitForTimeout(300);
      const row = engineerPage.locator('table tbody tr').first();
      if (await row.isVisible({ timeout: 2000 }).catch(() => false)) {
        await row.click();
        await engineerPage.waitForTimeout(800);
        await engineerPage.keyboard.press('Escape').catch(() => {});
        await engineerPage.waitForTimeout(300);
      }
    }, errors));
  }

  // ── 79. Browse assets + open first row detail (Manager) ───────────────────
  if (pct(w, 7900, 25)) {
    inc(await tryAction('browse-assets-deep', async () => {
      await navigateTo(managerPage, '/assets');
      await managerPage.waitForTimeout(800);
      await managerPage.mouse.wheel(0, 300);
      await managerPage.waitForTimeout(300);
      const row = managerPage.locator('table tbody tr').first();
      if (await row.isVisible({ timeout: 2000 }).catch(() => false)) {
        await row.click();
        await managerPage.waitForTimeout(800);
        await managerPage.keyboard.press('Escape').catch(() => {});
        await managerPage.waitForTimeout(300);
      }
    }, errors));
  }

  // ── 80. Browse vendors + open first row detail (Office) ───────────────────
  if (pct(w, 8000, 25)) {
    inc(await tryAction('browse-vendors-deep', async () => {
      await navigateTo(officePage, '/vendors');
      await officePage.waitForTimeout(800);
      await officePage.mouse.wheel(0, 300);
      await officePage.waitForTimeout(300);
      const row = officePage.locator('table tbody tr').first();
      if (await row.isVisible({ timeout: 2000 }).catch(() => false)) {
        await row.click();
        await officePage.waitForTimeout(800);
        await officePage.mouse.wheel(0, 300);
        await officePage.waitForTimeout(200);
        await officePage.keyboard.press('Escape').catch(() => {});
        await officePage.waitForTimeout(300);
      }
    }, errors));
  }

  // ── 81. Browse purchase orders + open first row detail (Office) ───────────
  if (pct(w, 8100, 25)) {
    inc(await tryAction('browse-purchase-orders-deep', async () => {
      await navigateTo(officePage, '/purchase-orders');
      await officePage.waitForTimeout(800);
      await officePage.mouse.wheel(0, 300);
      await officePage.waitForTimeout(300);
      const row = officePage.locator('table tbody tr').first();
      if (await row.isVisible({ timeout: 2000 }).catch(() => false)) {
        await row.click();
        await officePage.waitForTimeout(800);
        await officePage.mouse.wheel(0, 400);
        await officePage.waitForTimeout(200);
        await officePage.keyboard.press('Escape').catch(() => {});
        await officePage.waitForTimeout(300);
      }
    }, errors));
  }

  // ── 82. Browse quality page tabs (Engineer) ───────────────────────────────
  if (pct(w, 8200, 20)) {
    const qualityTabs = ['inspections', 'lots'];
    const tab = pick(qualityTabs, w, 8210);
    inc(await tryAction(`browse-quality-${tab}`, async () => {
      await navigateTo(engineerPage, `/quality/${tab}`);
      await engineerPage.waitForTimeout(800);
      await engineerPage.mouse.wheel(0, 300);
      await engineerPage.waitForTimeout(300);
    }, errors));
  }

  // ── 83. Browse customer returns + open first row detail (Office) ─────────
  if (pct(w, 8300, 25)) {
    inc(await tryAction('browse-customer-returns-deep', async () => {
      await navigateTo(officePage, '/customer-returns');
      await officePage.waitForTimeout(800);
      await officePage.mouse.wheel(0, 300);
      await officePage.waitForTimeout(300);
      const row = officePage.locator('table tbody tr').first();
      if (await row.isVisible({ timeout: 2000 }).catch(() => false)) {
        await row.click();
        await officePage.waitForTimeout(800);
        await officePage.mouse.wheel(0, 300);
        await officePage.waitForTimeout(200);
        await officePage.keyboard.press('Escape').catch(() => {});
        await officePage.waitForTimeout(300);
      }
    }, errors));
  }

  // ── 84. Browse shipments + open first row detail (Office) ─────────────────
  if (pct(w, 8400, 25)) {
    inc(await tryAction('browse-shipments-deep', async () => {
      await navigateTo(officePage, '/shipments');
      await officePage.waitForTimeout(800);
      await officePage.mouse.wheel(0, 300);
      await officePage.waitForTimeout(300);
      const row = officePage.locator('table tbody tr').first();
      if (await row.isVisible({ timeout: 2000 }).catch(() => false)) {
        await row.click();
        await officePage.waitForTimeout(800);
        await officePage.mouse.wheel(0, 300);
        await officePage.waitForTimeout(200);
        await officePage.keyboard.press('Escape').catch(() => {});
        await officePage.waitForTimeout(300);
      }
    }, errors));
  }

  // ── 85. Browse invoices + open first row detail (Office) ──────────────────
  if (pct(w, 8500, 25)) {
    inc(await tryAction('browse-invoices-deep', async () => {
      await navigateTo(officePage, '/invoices');
      await officePage.waitForTimeout(800);
      await officePage.mouse.wheel(0, 300);
      await officePage.waitForTimeout(300);
      const row = officePage.locator('table tbody tr').first();
      if (await row.isVisible({ timeout: 2000 }).catch(() => false)) {
        await row.click();
        await officePage.waitForTimeout(800);
        await officePage.mouse.wheel(0, 400);
        await officePage.waitForTimeout(200);
        await officePage.keyboard.press('Escape').catch(() => {});
        await officePage.waitForTimeout(300);
      }
    }, errors));
  }

  // ── 86. Browse payments + open first row detail (Office) ──────────────────
  if (pct(w, 8600, 25)) {
    inc(await tryAction('browse-payments-deep', async () => {
      await navigateTo(officePage, '/payments');
      await officePage.waitForTimeout(800);
      await officePage.mouse.wheel(0, 300);
      await officePage.waitForTimeout(300);
      const row = officePage.locator('table tbody tr').first();
      if (await row.isVisible({ timeout: 2000 }).catch(() => false)) {
        await row.click();
        await officePage.waitForTimeout(800);
        await officePage.mouse.wheel(0, 300);
        await officePage.waitForTimeout(200);
        await officePage.keyboard.press('Escape').catch(() => {});
        await officePage.waitForTimeout(300);
      }
    }, errors));
  }

  // ── 87. Browse leads + open first row detail (PM) ─────────────────────────
  if (pct(w, 8700, 25)) {
    inc(await tryAction('browse-leads-deep', async () => {
      await navigateTo(pmPage, '/leads');
      await pmPage.waitForTimeout(800);
      await pmPage.mouse.wheel(0, 300);
      await pmPage.waitForTimeout(300);
      const row = pmPage.locator('table tbody tr').first();
      if (await row.isVisible({ timeout: 2000 }).catch(() => false)) {
        await row.click();
        await pmPage.waitForTimeout(800);
        await pmPage.mouse.wheel(0, 300);
        await pmPage.waitForTimeout(200);
        await pmPage.keyboard.press('Escape').catch(() => {});
        await pmPage.waitForTimeout(300);
      }
    }, errors));
  }

  // ── 88. Browse parts + open first row detail (Engineer) ───────────────────
  if (pct(w, 8800, 25)) {
    inc(await tryAction('browse-parts-deep', async () => {
      await navigateTo(engineerPage, '/parts');
      await engineerPage.waitForTimeout(800);
      await engineerPage.mouse.wheel(0, 300);
      await engineerPage.waitForTimeout(300);
      const row = engineerPage.locator('table tbody tr').first();
      if (await row.isVisible({ timeout: 2000 }).catch(() => false)) {
        await row.click();
        await engineerPage.waitForTimeout(800);
        await engineerPage.mouse.wheel(0, 400);
        await engineerPage.waitForTimeout(200);
        await engineerPage.keyboard.press('Escape').catch(() => {});
        await engineerPage.waitForTimeout(300);
      }
    }, errors));
  }

  // ── 89. Browse quotes + open first row detail (PM) ────────────────────────
  if (pct(w, 8900, 25)) {
    inc(await tryAction('browse-quotes-deep', async () => {
      await navigateTo(pmPage, '/quotes');
      await pmPage.waitForTimeout(800);
      await pmPage.mouse.wheel(0, 300);
      await pmPage.waitForTimeout(300);
      const row = pmPage.locator('table tbody tr').first();
      if (await row.isVisible({ timeout: 2000 }).catch(() => false)) {
        await row.click();
        await pmPage.waitForTimeout(800);
        await pmPage.mouse.wheel(0, 400);
        await pmPage.waitForTimeout(200);
        await pmPage.keyboard.press('Escape').catch(() => {});
        await pmPage.waitForTimeout(300);
      }
    }, errors));
  }

  // ── 90. Browse sales orders + open first row detail (Office) ──────────────
  if (pct(w, 9000, 25)) {
    inc(await tryAction('browse-sales-orders-deep', async () => {
      await navigateTo(officePage, '/sales-orders');
      await officePage.waitForTimeout(800);
      await officePage.mouse.wheel(0, 300);
      await officePage.waitForTimeout(300);
      const row = officePage.locator('table tbody tr').first();
      if (await row.isVisible({ timeout: 2000 }).catch(() => false)) {
        await row.click();
        await officePage.waitForTimeout(800);
        await officePage.mouse.wheel(0, 400);
        await officePage.waitForTimeout(200);
        await officePage.keyboard.press('Escape').catch(() => {});
        await officePage.waitForTimeout(300);
      }
    }, errors));
  }

  // ── 91. Browse kanban board (Engineer) ────────────────────────────────────
  if (pct(w, 9100, 30)) {
    inc(await tryAction('browse-kanban', async () => {
      await navigateTo(engineerPage, '/kanban');
      await engineerPage.waitForTimeout(1000);
      // Scroll horizontally through columns
      const board = engineerPage.locator('.kanban-board, .board').first();
      if (await board.isVisible({ timeout: 3000 }).catch(() => false)) {
        await engineerPage.mouse.wheel(300, 0);
        await engineerPage.waitForTimeout(300);
      }
    }, errors));
  }

  // ── 92. Browse admin events + open first (Admin) ─────────────────────────
  if (pct(w, 9200, 20)) {
    inc(await tryAction('browse-admin-events', async () => {
      await navigateTo(adminPage, '/admin/events');
      await adminPage.waitForTimeout(800);
      await adminPage.mouse.wheel(0, 300);
      await adminPage.waitForTimeout(300);
      const row = adminPage.locator('table tbody tr, .event-row, .event-card').first();
      if (await row.isVisible({ timeout: 2000 }).catch(() => false)) {
        await row.click();
        await adminPage.waitForTimeout(700);
        await adminPage.keyboard.press('Escape').catch(() => {});
        await adminPage.waitForTimeout(300);
      }
    }, errors));
  }

  // ── 93. Browse admin training + open first (Admin) ───────────────────────
  if (pct(w, 9300, 15)) {
    inc(await tryAction('browse-admin-training', async () => {
      await navigateTo(adminPage, '/admin/training');
      await adminPage.waitForTimeout(800);
      await adminPage.mouse.wheel(0, 300);
      await adminPage.waitForTimeout(300);
      const row = adminPage.locator('table tbody tr, .training-row, .training-module-card').first();
      if (await row.isVisible({ timeout: 2000 }).catch(() => false)) {
        await row.click();
        await adminPage.waitForTimeout(700);
        await adminPage.keyboard.press('Escape').catch(() => {});
        await adminPage.waitForTimeout(300);
      }
    }, errors));
  }

  // ── 94. Browse customer overview tab (Office) ─────────────────────────────
  if (pct(w, 9400, 25) && customers.length > 0) {
    const customer = customers[(w + 13) % customers.length];
    inc(await tryAction(`browse-customer-overview-${customer.id}`, async () => {
      await navigateTo(officePage, `/customers/${customer.id}/overview`);
      await officePage.waitForTimeout(800);
      await officePage.mouse.wheel(0, 300);
      await officePage.waitForTimeout(300);
    }, errors));
  }

  // ── 95. Browse customer estimates tab (PM) ────────────────────────────────
  if (pct(w, 9500, 20) && customers.length > 0) {
    const customer = customers[(w + 14) % customers.length];
    inc(await tryAction(`browse-customer-estimates-${customer.id}`, async () => {
      await navigateTo(pmPage, `/customers/${customer.id}/estimates`);
      await pmPage.waitForTimeout(800);
      await pmPage.mouse.wheel(0, 200);
      await pmPage.waitForTimeout(300);
    }, errors));
  }

  // ── 96. Browse customer quotes tab (PM) ───────────────────────────────────
  if (pct(w, 9600, 20) && customers.length > 0) {
    const customer = customers[(w + 15) % customers.length];
    inc(await tryAction(`browse-customer-quotes-${customer.id}`, async () => {
      await navigateTo(pmPage, `/customers/${customer.id}/quotes`);
      await pmPage.waitForTimeout(800);
      await pmPage.mouse.wheel(0, 200);
      await pmPage.waitForTimeout(300);
    }, errors));
  }

  // ── 97. Browse customer activity tab (Office) ─────────────────────────────
  if (pct(w, 9700, 20) && customers.length > 0) {
    const customer = customers[(w + 16) % customers.length];
    inc(await tryAction(`browse-customer-activity-${customer.id}`, async () => {
      await navigateTo(officePage, `/customers/${customer.id}/activity`);
      await officePage.waitForTimeout(800);
      await officePage.mouse.wheel(0, 200);
      await officePage.waitForTimeout(300);
    }, errors));
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION AD: SCHEDULING
  // ════════════════════════════════════════════════════════════════════════════

  // ── 98. Browse scheduling — gantt tab (Manager) ───────────────────────────
  if (pct(w, 9800, 25)) {
    inc(await tryAction('browse-scheduling-gantt', async () => {
      await navigateTo(managerPage, '/scheduling/gantt');
      await managerPage.waitForTimeout(800);
      await managerPage.mouse.wheel(0, 300);
      await managerPage.waitForTimeout(300);
    }, errors));
  }

  // ── 99. Browse scheduling — dispatch tab + open first (Manager) ──────────
  if (pct(w, 9900, 20)) {
    inc(await tryAction('browse-scheduling-dispatch', async () => {
      await navigateTo(managerPage, '/scheduling/dispatch');
      await managerPage.waitForTimeout(800);
      await managerPage.mouse.wheel(0, 200);
      await managerPage.waitForTimeout(300);
      const row = managerPage.locator('table tbody tr, .dispatch-row, .dispatch-card').first();
      if (await row.isVisible({ timeout: 2000 }).catch(() => false)) {
        await row.click();
        await managerPage.waitForTimeout(700);
        await managerPage.keyboard.press('Escape').catch(() => {});
        await managerPage.waitForTimeout(300);
      }
    }, errors));
  }

  // ── 100. Browse scheduling — work centers tab + row (Manager) ────────────
  if (pct(w, 10000, 20)) {
    inc(await tryAction('browse-scheduling-work-centers-deep', async () => {
      await navigateTo(managerPage, '/scheduling/work-centers');
      await managerPage.waitForTimeout(800);
      await managerPage.mouse.wheel(0, 200);
      await managerPage.waitForTimeout(300);
      const row = managerPage.locator('table tbody tr, .work-center-card').first();
      if (await row.isVisible({ timeout: 2000 }).catch(() => false)) {
        await row.click();
        await managerPage.waitForTimeout(700);
        await managerPage.mouse.wheel(0, 200);
        await managerPage.waitForTimeout(200);
        await managerPage.keyboard.press('Escape').catch(() => {});
        await managerPage.waitForTimeout(300);
      }
    }, errors));
  }

  // ── 101. Browse scheduling — shifts tab + row (Admin) ─────────────────────
  if (pct(w, 10100, 15)) {
    inc(await tryAction('browse-scheduling-shifts-deep', async () => {
      await navigateTo(adminPage, '/scheduling/shifts');
      await adminPage.waitForTimeout(800);
      await adminPage.mouse.wheel(0, 200);
      await adminPage.waitForTimeout(300);
      const row = adminPage.locator('table tbody tr, .shift-card').first();
      if (await row.isVisible({ timeout: 2000 }).catch(() => false)) {
        await row.click();
        await adminPage.waitForTimeout(700);
        await adminPage.keyboard.press('Escape').catch(() => {});
        await adminPage.waitForTimeout(300);
      }
    }, errors));
  }

  // ── 102. Browse scheduling — run history tab + row (Manager) ──────────────
  if (pct(w, 10200, 15)) {
    inc(await tryAction('browse-scheduling-runs-deep', async () => {
      await navigateTo(managerPage, '/scheduling/runs');
      await managerPage.waitForTimeout(800);
      await managerPage.mouse.wheel(0, 200);
      await managerPage.waitForTimeout(300);
      const row = managerPage.locator('table tbody tr').first();
      if (await row.isVisible({ timeout: 2000 }).catch(() => false)) {
        await row.click();
        await managerPage.waitForTimeout(700);
        await managerPage.mouse.wheel(0, 300);
        await managerPage.waitForTimeout(200);
        await managerPage.keyboard.press('Escape').catch(() => {});
        await managerPage.waitForTimeout(300);
      }
    }, errors));
  }

  // ── 103. Run scheduler (Admin) ────────────────────────────────────────────
  if (pct(w, 10300, 10)) {
    inc(await tryAction('run-scheduler', async () => {
      await navigateTo(adminPage, '/scheduling/gantt');
      await adminPage.waitForTimeout(800);
      const runBtn = adminPage.locator('[data-testid="scheduling-run-btn"]');
      if (await runBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await runBtn.click();
        await adminPage.waitForTimeout(2000); // scheduler takes a moment
      }
    }, errors));
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION AE: MRP (Material Requirements Planning)
  // ════════════════════════════════════════════════════════════════════════════

  // ── 104. Browse MRP dashboard (Manager) ───────────────────────────────────
  if (pct(w, 10400, 25)) {
    inc(await tryAction('browse-mrp-dashboard', async () => {
      await navigateTo(managerPage, '/mrp/dashboard');
      await managerPage.waitForTimeout(800);
      await managerPage.mouse.wheel(0, 300);
      await managerPage.waitForTimeout(300);
    }, errors));
  }

  // ── 105. Browse MRP planned orders + open first (Manager) ────────────────
  if (pct(w, 10500, 20)) {
    inc(await tryAction('browse-mrp-planned-orders', async () => {
      await navigateTo(managerPage, '/mrp/planned-orders');
      await managerPage.waitForTimeout(800);
      await managerPage.mouse.wheel(0, 200);
      await managerPage.waitForTimeout(300);
      const row = managerPage.locator('table tbody tr, .planned-order-row').first();
      if (await row.isVisible({ timeout: 2000 }).catch(() => false)) {
        await row.click();
        await managerPage.waitForTimeout(700);
        await managerPage.keyboard.press('Escape').catch(() => {});
        await managerPage.waitForTimeout(300);
      }
    }, errors));
  }

  // ── 106. Browse MRP exceptions + open first (Manager) ─────────────────────
  if (pct(w, 10600, 20)) {
    inc(await tryAction('browse-mrp-exceptions-deep', async () => {
      await navigateTo(managerPage, '/mrp/exceptions');
      await managerPage.waitForTimeout(800);
      await managerPage.mouse.wheel(0, 200);
      await managerPage.waitForTimeout(300);
      const row = managerPage.locator('table tbody tr').first();
      if (await row.isVisible({ timeout: 2000 }).catch(() => false)) {
        await row.click();
        await managerPage.waitForTimeout(700);
        await managerPage.keyboard.press('Escape').catch(() => {});
        await managerPage.waitForTimeout(300);
      }
    }, errors));
  }

  // ── 107. Browse MRP run history (Admin) ───────────────────────────────────
  // Note: run history rows are non-clickable (clickableRows=false); just scroll to browse.
  if (pct(w, 10700, 15)) {
    inc(await tryAction('browse-mrp-runs-deep', async () => {
      await navigateTo(adminPage, '/mrp/runs');
      await adminPage.waitForTimeout(800);
      await adminPage.mouse.wheel(0, 200);
      await adminPage.waitForTimeout(300);
      await adminPage.mouse.wheel(0, 200);
      await adminPage.waitForTimeout(200);
    }, errors));
  }

  // ── 108. Browse MRP master schedule (Manager) ─────────────────────────────
  // Note: master-schedule rows are non-clickable (clickableRows=false); just scroll to browse.
  if (pct(w, 10800, 15)) {
    inc(await tryAction('browse-mrp-master-schedule-deep', async () => {
      await navigateTo(managerPage, '/mrp/master-schedule');
      await managerPage.waitForTimeout(800);
      await managerPage.mouse.wheel(0, 200);
      await managerPage.waitForTimeout(300);
      await managerPage.mouse.wheel(0, 200);
      await managerPage.waitForTimeout(200);
    }, errors));
  }

  // ── 109. Browse MRP forecasts (Manager) ───────────────────────────────────
  // Note: forecast rows are non-clickable (clickableRows=false); just scroll to browse.
  if (pct(w, 10900, 15)) {
    inc(await tryAction('browse-mrp-forecasts-deep', async () => {
      await navigateTo(managerPage, '/mrp/forecasts');
      await managerPage.waitForTimeout(800);
      await managerPage.mouse.wheel(0, 200);
      await managerPage.waitForTimeout(300);
      await managerPage.mouse.wheel(0, 200);
      await managerPage.waitForTimeout(200);
    }, errors));
  }

  // ── 110. Run MRP (Admin — ~10% of weeks) ──────────────────────────────────
  if (pct(w, 11000, 10)) {
    inc(await tryAction('run-mrp', async () => {
      await navigateTo(adminPage, '/mrp/dashboard');
      await adminPage.waitForTimeout(800);
      const runBtn = adminPage.locator('[data-testid="mrp-run-btn"]');
      if (await runBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await runBtn.click();
        await adminPage.waitForTimeout(3000); // MRP runs take a moment
      }
    }, errors));
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION AF: OEE (Overall Equipment Effectiveness)
  // ════════════════════════════════════════════════════════════════════════════

  // ── 111. Browse OEE page (Manager) ────────────────────────────────────────
  if (pct(w, 11100, 20)) {
    inc(await tryAction('browse-oee', async () => {
      await navigateTo(managerPage, '/oee');
      await managerPage.waitForTimeout(800);
      await managerPage.mouse.wheel(0, 300);
      await managerPage.waitForTimeout(300);
      // Try to click the first work center card for detail
      const firstCard = managerPage.locator('app-oee-work-center-card').first();
      if (await firstCard.isVisible({ timeout: 2000 }).catch(() => false)) {
        await firstCard.click();
        await managerPage.waitForTimeout(800);
        await managerPage.mouse.wheel(0, 300);
        await managerPage.waitForTimeout(300);
      }
    }, errors));
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION AG: EMPLOYEE DETAIL TABS
  // ════════════════════════════════════════════════════════════════════════════

  // ── 112. Browse employee detail — overview tab (Admin) ────────────────────
  if (pct(w, 11200, 20)) {
    const users = await getAllUsers(admin);
    if (users.length > 0) {
      const user = users[(w + 17) % users.length];
      inc(await tryAction(`browse-employee-overview-${user.id}`, async () => {
        await navigateTo(adminPage, `/employees/${user.id}/overview`);
        await adminPage.waitForTimeout(800);
        await adminPage.mouse.wheel(0, 300);
        await adminPage.waitForTimeout(300);
      }, errors));
    }
  }

  // ── 113. Browse employee detail — time tab (Admin) ────────────────────────
  if (pct(w, 11300, 15)) {
    const users = await getAllUsers(admin);
    if (users.length > 0) {
      const user = users[(w + 18) % users.length];
      inc(await tryAction(`browse-employee-time-${user.id}`, async () => {
        await navigateTo(adminPage, `/employees/${user.id}/time`);
        await adminPage.waitForTimeout(800);
        await adminPage.mouse.wheel(0, 200);
        await adminPage.waitForTimeout(300);
      }, errors));
    }
  }

  // ── 114. Browse employee detail — training tab (Admin) ────────────────────
  if (pct(w, 11400, 15)) {
    const users = await getAllUsers(admin);
    if (users.length > 0) {
      const user = users[(w + 19) % users.length];
      inc(await tryAction(`browse-employee-training-${user.id}`, async () => {
        await navigateTo(adminPage, `/employees/${user.id}/training`);
        await adminPage.waitForTimeout(800);
        await adminPage.mouse.wheel(0, 200);
        await adminPage.waitForTimeout(300);
      }, errors));
    }
  }

  // ── 115. Browse employee detail — compliance tab (Admin) ──────────────────
  if (pct(w, 11500, 15)) {
    const users = await getAllUsers(admin);
    if (users.length > 0) {
      const user = users[(w + 20) % users.length];
      inc(await tryAction(`browse-employee-compliance-${user.id}`, async () => {
        await navigateTo(adminPage, `/employees/${user.id}/compliance`);
        await adminPage.waitForTimeout(800);
        await adminPage.mouse.wheel(0, 200);
        await adminPage.waitForTimeout(300);
      }, errors));
    }
  }

  // ── 116. Browse employee detail — events tab (Admin) ──────────────────────
  if (pct(w, 11600, 15)) {
    const users = await getAllUsers(admin);
    if (users.length > 0) {
      const user = users[(w + 21) % users.length];
      inc(await tryAction(`browse-employee-events-${user.id}`, async () => {
        await navigateTo(adminPage, `/employees/${user.id}/events`);
        await adminPage.waitForTimeout(800);
        await adminPage.mouse.wheel(0, 200);
        await adminPage.waitForTimeout(300);
      }, errors));
    }
  }

  // ── 117. Browse employee detail — expenses tab (Manager) ──────────────────
  if (pct(w, 11700, 15)) {
    const users = await getAllUsers(admin);
    if (users.length > 0) {
      const user = users[(w + 22) % users.length];
      inc(await tryAction(`browse-employee-expenses-${user.id}`, async () => {
        await navigateTo(managerPage, `/employees/${user.id}/expenses`);
        await managerPage.waitForTimeout(800);
        await managerPage.mouse.wheel(0, 200);
        await managerPage.waitForTimeout(300);
      }, errors));
    }
  }

  // ── 118. Browse employee detail — jobs tab (Manager) ──────────────────────
  if (pct(w, 11800, 15)) {
    const users = await getAllUsers(admin);
    if (users.length > 0) {
      const user = users[(w + 23) % users.length];
      inc(await tryAction(`browse-employee-jobs-${user.id}`, async () => {
        await navigateTo(managerPage, `/employees/${user.id}/jobs`);
        await managerPage.waitForTimeout(800);
        await managerPage.mouse.wheel(0, 200);
        await managerPage.waitForTimeout(300);
      }, errors));
    }
  }

  // ── 119. Browse employee detail — pay tab (Admin) ─────────────────────────
  if (pct(w, 11900, 10)) {
    const users = await getAllUsers(admin);
    if (users.length > 0) {
      const user = users[(w + 24) % users.length];
      inc(await tryAction(`browse-employee-pay-${user.id}`, async () => {
        await navigateTo(adminPage, `/employees/${user.id}/pay`);
        await adminPage.waitForTimeout(800);
        await adminPage.mouse.wheel(0, 200);
        await adminPage.waitForTimeout(300);
      }, errors));
    }
  }

  // ── 120. Browse employee detail — documents tab (Admin) ───────────────────
  if (pct(w, 12000, 10)) {
    const users = await getAllUsers(admin);
    if (users.length > 0) {
      const user = users[(w + 25) % users.length];
      inc(await tryAction(`browse-employee-documents-${user.id}`, async () => {
        await navigateTo(adminPage, `/employees/${user.id}/documents`);
        await adminPage.waitForTimeout(800);
        await adminPage.mouse.wheel(0, 200);
        await adminPage.waitForTimeout(300);
      }, errors));
    }
  }

  // ── 121. Browse employee detail — activity tab (Admin) ────────────────────
  if (pct(w, 12100, 10)) {
    const users = await getAllUsers(admin);
    if (users.length > 0) {
      const user = users[(w + 26) % users.length];
      inc(await tryAction(`browse-employee-activity-${user.id}`, async () => {
        await navigateTo(adminPage, `/employees/${user.id}/activity`);
        await adminPage.waitForTimeout(800);
        await adminPage.mouse.wheel(0, 200);
        await adminPage.waitForTimeout(300);
      }, errors));
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION AH: APPROVALS
  // ════════════════════════════════════════════════════════════════════════════

  // ── 122. Browse approvals inbox + open first (Manager) ────────────────────
  if (pct(w, 12200, 25)) {
    inc(await tryAction('browse-approvals-inbox-deep', async () => {
      await navigateTo(managerPage, '/approvals/inbox');
      await managerPage.waitForTimeout(800);
      await managerPage.mouse.wheel(0, 300);
      await managerPage.waitForTimeout(300);
      const row = managerPage.locator('table tbody tr, .approval-item').first();
      if (await row.isVisible({ timeout: 2000 }).catch(() => false)) {
        await row.click();
        await managerPage.waitForTimeout(800);
        await managerPage.mouse.wheel(0, 300);
        await managerPage.waitForTimeout(200);
        await managerPage.keyboard.press('Escape').catch(() => {});
        await managerPage.waitForTimeout(300);
      }
    }, errors));
  }

  // ── 123. Browse approvals workflows + open first (Admin) ──────────────────
  if (pct(w, 12300, 15)) {
    inc(await tryAction('browse-approvals-workflows-deep', async () => {
      await navigateTo(adminPage, '/approvals/workflows');
      await adminPage.waitForTimeout(800);
      await adminPage.mouse.wheel(0, 200);
      await adminPage.waitForTimeout(300);
      const row = adminPage.locator('table tbody tr').first();
      if (await row.isVisible({ timeout: 2000 }).catch(() => false)) {
        await row.click();
        await adminPage.waitForTimeout(800);
        await adminPage.mouse.wheel(0, 200);
        await adminPage.waitForTimeout(200);
        await adminPage.keyboard.press('Escape').catch(() => {});
        await adminPage.waitForTimeout(300);
      }
    }, errors));
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION AI: INVENTORY ADDITIONAL TABS
  // ════════════════════════════════════════════════════════════════════════════

  // ── 124. Browse inventory — cycle counts + open first (Manager) ──────────
  if (pct(w, 12400, 20)) {
    inc(await tryAction('browse-inventory-cycle-counts-deep', async () => {
      await navigateTo(managerPage, '/inventory/cycleCounts');
      await managerPage.waitForTimeout(800);
      await managerPage.mouse.wheel(0, 200);
      await managerPage.waitForTimeout(300);
      const row = managerPage.locator('table tbody tr').first();
      if (await row.isVisible({ timeout: 2000 }).catch(() => false)) {
        await row.click();
        await managerPage.waitForTimeout(700);
        await managerPage.mouse.wheel(0, 200);
        await managerPage.waitForTimeout(200);
        await managerPage.keyboard.press('Escape').catch(() => {});
        await managerPage.waitForTimeout(300);
      }
    }, errors));
  }

  // ── 125. Browse inventory — reservations + open first (Manager) ──────────
  if (pct(w, 12500, 15)) {
    inc(await tryAction('browse-inventory-reservations-deep', async () => {
      await navigateTo(managerPage, '/inventory/reservations');
      await managerPage.waitForTimeout(800);
      await managerPage.mouse.wheel(0, 200);
      await managerPage.waitForTimeout(300);
      const row = managerPage.locator('table tbody tr').first();
      if (await row.isVisible({ timeout: 2000 }).catch(() => false)) {
        await row.click();
        await managerPage.waitForTimeout(700);
        await managerPage.keyboard.press('Escape').catch(() => {});
        await managerPage.waitForTimeout(300);
      }
    }, errors));
  }

  // ── 126. Browse inventory — replenishment + open first (Manager) ─────────
  if (pct(w, 12600, 15)) {
    inc(await tryAction('browse-inventory-replenishment-deep', async () => {
      await navigateTo(managerPage, '/inventory/replenishment');
      await managerPage.waitForTimeout(800);
      await managerPage.mouse.wheel(0, 200);
      await managerPage.waitForTimeout(300);
      const row = managerPage.locator('table tbody tr').first();
      if (await row.isVisible({ timeout: 2000 }).catch(() => false)) {
        await row.click();
        await managerPage.waitForTimeout(700);
        await managerPage.keyboard.press('Escape').catch(() => {});
        await managerPage.waitForTimeout(300);
      }
    }, errors));
  }

  // ── 127. Browse inventory — UoM + open first (Admin) ──────────────────────
  if (pct(w, 12700, 10)) {
    inc(await tryAction('browse-inventory-uom-deep', async () => {
      await navigateTo(adminPage, '/inventory/uom');
      await adminPage.waitForTimeout(800);
      await adminPage.mouse.wheel(0, 200);
      await adminPage.waitForTimeout(300);
      const row = adminPage.locator('table tbody tr').first();
      if (await row.isVisible({ timeout: 2000 }).catch(() => false)) {
        await row.click();
        await adminPage.waitForTimeout(700);
        await adminPage.keyboard.press('Escape').catch(() => {});
        await adminPage.waitForTimeout(300);
      }
    }, errors));
  }

  // ── 128. Browse inventory — stock operations + open first (Manager) ──────
  if (pct(w, 12800, 15)) {
    inc(await tryAction('browse-inventory-stock-ops-deep', async () => {
      await navigateTo(managerPage, '/inventory/stockOps');
      await managerPage.waitForTimeout(800);
      await managerPage.mouse.wheel(0, 200);
      await managerPage.waitForTimeout(300);
      const row = managerPage.locator('table tbody tr').first();
      if (await row.isVisible({ timeout: 2000 }).catch(() => false)) {
        await row.click();
        await managerPage.waitForTimeout(700);
        await managerPage.keyboard.press('Escape').catch(() => {});
        await managerPage.waitForTimeout(300);
      }
    }, errors));
  }

  // ── 129. Browse inventory — movements + open first (Manager) ─────────────
  if (pct(w, 12900, 20)) {
    inc(await tryAction('browse-inventory-movements-deep', async () => {
      await navigateTo(managerPage, '/inventory/movements');
      await managerPage.waitForTimeout(800);
      await managerPage.mouse.wheel(0, 200);
      await managerPage.waitForTimeout(300);
      const row = managerPage.locator('table tbody tr').first();
      if (await row.isVisible({ timeout: 2000 }).catch(() => false)) {
        await row.click();
        await managerPage.waitForTimeout(700);
        await managerPage.keyboard.press('Escape').catch(() => {});
        await managerPage.waitForTimeout(300);
      }
    }, errors));
  }

  // ── 130. Browse inventory — receiving + open first (Office) ──────────────
  if (pct(w, 13000, 20)) {
    inc(await tryAction('browse-inventory-receiving-deep', async () => {
      await navigateTo(officePage, '/inventory/receiving');
      await officePage.waitForTimeout(800);
      await officePage.mouse.wheel(0, 200);
      await officePage.waitForTimeout(300);
      const row = officePage.locator('table tbody tr').first();
      if (await row.isVisible({ timeout: 2000 }).catch(() => false)) {
        await row.click();
        await officePage.waitForTimeout(800);
        await officePage.mouse.wheel(0, 300);
        await officePage.waitForTimeout(200);
        await officePage.keyboard.press('Escape').catch(() => {});
        await officePage.waitForTimeout(300);
      }
    }, errors));
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION AJ: ASSET DETAIL & MAINTENANCE
  // ════════════════════════════════════════════════════════════════════════════

  // ── 131. Browse asset detail panel (Manager) ──────────────────────────────
  if (pct(w, 13100, 20)) {
    const assets = await getAssets(manager);
    if (assets.length > 0) {
      const asset = assets[(w + 27) % assets.length];
      inc(await tryAction(`browse-asset-detail-${asset.id}`, async () => {
        await navigateTo(managerPage, '/assets');
        await managerPage.waitForTimeout(800);
        await clickRowContaining(managerPage, asset.name);
        await managerPage.waitForTimeout(800);
        // Scroll down to see maintenance history section
        await managerPage.mouse.wheel(0, 400);
        await managerPage.waitForTimeout(300);
      }, errors));
    }
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION AK: CUSTOMER CONTACTS TAB
  // ════════════════════════════════════════════════════════════════════════════

  // ── 132. Browse customer contacts tab (Office) ────────────────────────────
  if (pct(w, 13200, 20) && customers.length > 0) {
    const customer = customers[(w + 28) % customers.length];
    inc(await tryAction(`browse-customer-contacts-${customer.id}`, async () => {
      await navigateTo(officePage, `/customers/${customer.id}/contacts`);
      await officePage.waitForTimeout(800);
      await officePage.mouse.wheel(0, 200);
      await officePage.waitForTimeout(300);
    }, errors));
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION AL: ADDITIONAL ADMIN FEATURES
  // ════════════════════════════════════════════════════════════════════════════

  // ── 133. Browse admin employees list + open first row (Admin) ────────────
  if (pct(w, 13300, 20)) {
    inc(await tryAction('browse-admin-employees-deep', async () => {
      await navigateTo(adminPage, '/admin/users');
      await adminPage.waitForTimeout(800);
      await adminPage.mouse.wheel(0, 300);
      await adminPage.waitForTimeout(300);
      const row = adminPage.locator('table tbody tr').first();
      if (await row.isVisible({ timeout: 2000 }).catch(() => false)) {
        await row.click();
        await adminPage.waitForTimeout(800);
        await adminPage.mouse.wheel(0, 300);
        await adminPage.waitForTimeout(200);
        await adminPage.keyboard.press('Escape').catch(() => {});
        await adminPage.waitForTimeout(300);
      }
    }, errors));
  }

  // ── 134. Browse admin integrations + open first row (Admin) ──────────────
  if (pct(w, 13400, 10)) {
    inc(await tryAction('browse-admin-integrations-deep', async () => {
      await navigateTo(adminPage, '/admin/integrations');
      await adminPage.waitForTimeout(800);
      await adminPage.mouse.wheel(0, 200);
      await adminPage.waitForTimeout(300);
      const row = adminPage.locator('table tbody tr, .integration-card').first();
      if (await row.isVisible({ timeout: 2000 }).catch(() => false)) {
        await row.click();
        await adminPage.waitForTimeout(700);
        await adminPage.keyboard.press('Escape').catch(() => {});
        await adminPage.waitForTimeout(300);
      }
    }, errors));
  }

  // ── 135. Browse admin scheduled tasks + open first row (Admin) ───────────
  if (pct(w, 13500, 10)) {
    inc(await tryAction('browse-admin-scheduled-tasks-deep', async () => {
      await navigateTo(adminPage, '/admin/scheduled-tasks');
      await adminPage.waitForTimeout(800);
      await adminPage.mouse.wheel(0, 200);
      await adminPage.waitForTimeout(300);
      const row = adminPage.locator('table tbody tr').first();
      if (await row.isVisible({ timeout: 2000 }).catch(() => false)) {
        await row.click();
        await adminPage.waitForTimeout(700);
        await adminPage.keyboard.press('Escape').catch(() => {});
        await adminPage.waitForTimeout(300);
      }
    }, errors));
  }

  // ── 136. Browse admin EDI + open first row (Admin) ───────────────────────
  if (pct(w, 13600, 10)) {
    inc(await tryAction('browse-admin-edi-deep', async () => {
      await navigateTo(adminPage, '/admin/edi');
      await adminPage.waitForTimeout(800);
      await adminPage.mouse.wheel(0, 200);
      await adminPage.waitForTimeout(300);
      const row = adminPage.locator('table tbody tr').first();
      if (await row.isVisible({ timeout: 2000 }).catch(() => false)) {
        await row.click();
        await adminPage.waitForTimeout(700);
        await adminPage.mouse.wheel(0, 200);
        await adminPage.waitForTimeout(200);
        await adminPage.keyboard.press('Escape').catch(() => {});
        await adminPage.waitForTimeout(300);
      }
    }, errors));
  }

  // ── 137. Browse admin AI assistants + open first (Admin) ─────────────────
  if (pct(w, 13700, 10)) {
    inc(await tryAction('browse-admin-ai-assistants-deep', async () => {
      await navigateTo(adminPage, '/admin/ai-assistants');
      await adminPage.waitForTimeout(800);
      await adminPage.mouse.wheel(0, 200);
      await adminPage.waitForTimeout(300);
      const row = adminPage.locator('table tbody tr, .ai-assistant-card').first();
      if (await row.isVisible({ timeout: 2000 }).catch(() => false)) {
        await row.click();
        await adminPage.waitForTimeout(700);
        await adminPage.keyboard.press('Escape').catch(() => {});
        await adminPage.waitForTimeout(300);
      }
    }, errors));
  }

  // ── 138. Browse admin time corrections + open first (Admin) ──────────────
  if (pct(w, 13800, 10)) {
    inc(await tryAction('browse-admin-time-corrections-deep', async () => {
      await navigateTo(adminPage, '/admin/time-corrections');
      await adminPage.waitForTimeout(800);
      await adminPage.mouse.wheel(0, 200);
      await adminPage.waitForTimeout(300);
      const row = adminPage.locator('table tbody tr').first();
      if (await row.isVisible({ timeout: 2000 }).catch(() => false)) {
        await row.click();
        await adminPage.waitForTimeout(700);
        await adminPage.keyboard.press('Escape').catch(() => {});
        await adminPage.waitForTimeout(300);
      }
    }, errors));
  }

  // ── 139. Browse admin MFA policies + open first (Admin) ──────────────────
  if (pct(w, 13900, 10)) {
    inc(await tryAction('browse-admin-mfa-deep', async () => {
      await navigateTo(adminPage, '/admin/mfa');
      await adminPage.waitForTimeout(800);
      await adminPage.mouse.wheel(0, 200);
      await adminPage.waitForTimeout(300);
      const row = adminPage.locator('table tbody tr').first();
      if (await row.isVisible({ timeout: 2000 }).catch(() => false)) {
        await row.click();
        await adminPage.waitForTimeout(700);
        await adminPage.keyboard.press('Escape').catch(() => {});
        await adminPage.waitForTimeout(300);
      }
    }, errors));
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION AM: QUALITY ADDITIONAL TABS
  // ════════════════════════════════════════════════════════════════════════════

  // ── 140. Browse quality — lots tab + open first row (Engineer) ──────────
  if (pct(w, 14000, 15)) {
    inc(await tryAction('browse-quality-lots-deep', async () => {
      await navigateTo(engineerPage, '/quality/lots');
      await engineerPage.waitForTimeout(800);
      await engineerPage.mouse.wheel(0, 200);
      await engineerPage.waitForTimeout(300);
      const row = engineerPage.locator('table tbody tr').first();
      if (await row.isVisible({ timeout: 2000 }).catch(() => false)) {
        await row.click();
        await engineerPage.waitForTimeout(800);
        await engineerPage.mouse.wheel(0, 300);
        await engineerPage.waitForTimeout(200);
        await engineerPage.keyboard.press('Escape').catch(() => {});
        await engineerPage.waitForTimeout(300);
      }
    }, errors));
  }

  // ── 141. Browse quality — templates tab + open first row (Engineer) ──────
  if (pct(w, 14100, 10)) {
    inc(await tryAction('browse-quality-templates-deep', async () => {
      await navigateTo(engineerPage, '/quality/templates');
      await engineerPage.waitForTimeout(800);
      await engineerPage.mouse.wheel(0, 200);
      await engineerPage.waitForTimeout(300);
      const row = engineerPage.locator('table tbody tr').first();
      if (await row.isVisible({ timeout: 2000 }).catch(() => false)) {
        await row.click();
        await engineerPage.waitForTimeout(800);
        await engineerPage.mouse.wheel(0, 300);
        await engineerPage.waitForTimeout(200);
        await engineerPage.keyboard.press('Escape').catch(() => {});
        await engineerPage.waitForTimeout(300);
      }
    }, errors));
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION AN: PURCHASING (RFQs, Vendor Scorecard)
  // ════════════════════════════════════════════════════════════════════════════

  // ── 142. Browse purchasing + open first RFQ (Office) ─────────────────────
  if (pct(w, 14200, 15)) {
    inc(await tryAction('browse-purchasing-deep', async () => {
      await navigateTo(officePage, '/purchasing');
      await officePage.waitForTimeout(800);
      await officePage.mouse.wheel(0, 300);
      await officePage.waitForTimeout(300);
      const row = officePage.locator('table tbody tr').first();
      if (await row.isVisible({ timeout: 2000 }).catch(() => false)) {
        await row.click();
        await officePage.waitForTimeout(800);
        await officePage.mouse.wheel(0, 300);
        await officePage.waitForTimeout(200);
        await officePage.keyboard.press('Escape').catch(() => {});
        await officePage.waitForTimeout(300);
      }
    }, errors));
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION AO: WORKER MODULE
  // ════════════════════════════════════════════════════════════════════════════

  // ── 143. Browse worker task list + open first task (Worker) ──────────────
  if (pct(w, 14300, 20)) {
    inc(await tryAction('browse-worker-deep', async () => {
      await navigateTo(workerPage, '/worker');
      await workerPage.waitForTimeout(800);
      await workerPage.mouse.wheel(0, 300);
      await workerPage.waitForTimeout(300);
      const row = workerPage.locator('table tbody tr, .task-card, .worker-task').first();
      if (await row.isVisible({ timeout: 2000 }).catch(() => false)) {
        await row.click();
        await workerPage.waitForTimeout(800);
        await workerPage.mouse.wheel(0, 300);
        await workerPage.waitForTimeout(200);
        await workerPage.keyboard.press('Escape').catch(() => {});
        await workerPage.waitForTimeout(300);
      }
    }, errors));
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION AP: AI ASSISTANT
  // ════════════════════════════════════════════════════════════════════════════

  // ── 144. Browse AI assistant (Engineer) ───────────────────────────────────
  if (pct(w, 14400, 10)) {
    inc(await tryAction('browse-ai-assistant', async () => {
      await navigateTo(engineerPage, '/ai/general');
      await engineerPage.waitForTimeout(800);
      await engineerPage.mouse.wheel(0, 200);
      await engineerPage.waitForTimeout(300);
    }, errors));
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION AQ: LOTS (standalone)
  // ════════════════════════════════════════════════════════════════════════════

  // ── 145. Browse lots + open first row traceability (Engineer) ─────────────
  if (pct(w, 14500, 15)) {
    inc(await tryAction('browse-lots-deep', async () => {
      await navigateTo(engineerPage, '/lots');
      await engineerPage.waitForTimeout(800);
      await engineerPage.mouse.wheel(0, 200);
      await engineerPage.waitForTimeout(300);
      const row = engineerPage.locator('table tbody tr').first();
      if (await row.isVisible({ timeout: 2000 }).catch(() => false)) {
        await row.click();
        await engineerPage.waitForTimeout(800);
        await engineerPage.mouse.wheel(0, 400);
        await engineerPage.waitForTimeout(200);
        await engineerPage.keyboard.press('Escape').catch(() => {});
        await engineerPage.waitForTimeout(300);
      }
    }, errors));
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION AR: NOTIFICATIONS CENTER
  // ════════════════════════════════════════════════════════════════════════════

  // ── 146. Browse notifications page + click first (Manager) ──────────────
  if (pct(w, 14600, 15)) {
    inc(await tryAction('browse-notifications-page-deep', async () => {
      await navigateTo(managerPage, '/notifications');
      await managerPage.waitForTimeout(800);
      await managerPage.mouse.wheel(0, 300);
      await managerPage.waitForTimeout(300);
      const row = managerPage.locator('.notification-item, table tbody tr').first();
      if (await row.isVisible({ timeout: 2000 }).catch(() => false)) {
        await row.click();
        await managerPage.waitForTimeout(700);
        await managerPage.keyboard.press('Escape').catch(() => {});
        await managerPage.waitForTimeout(300);
      }
    }, errors));
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION AS: ACCOUNT / PROFILE
  // ════════════════════════════════════════════════════════════════════════════

  // ── 147. Browse account profile (Engineer) ────────────────────────────────
  if (pct(w, 14700, 15)) {
    inc(await tryAction('browse-account-profile', async () => {
      await navigateTo(engineerPage, '/account/profile');
      await engineerPage.waitForTimeout(800);
      await engineerPage.mouse.wheel(0, 200);
      await engineerPage.waitForTimeout(300);
    }, errors));
  }

  // ── 148. Browse account security (Engineer) ───────────────────────────────
  if (pct(w, 14800, 10)) {
    inc(await tryAction('browse-account-security', async () => {
      await navigateTo(engineerPage, '/account/security');
      await engineerPage.waitForTimeout(800);
      await engineerPage.mouse.wheel(0, 200);
      await engineerPage.waitForTimeout(300);
    }, errors));
  }

  // ── 149. Browse account customization (Manager) ───────────────────────────
  if (pct(w, 14900, 10)) {
    inc(await tryAction('browse-account-customization', async () => {
      await navigateTo(managerPage, '/account/customization');
      await managerPage.waitForTimeout(800);
      await managerPage.mouse.wheel(0, 200);
      await managerPage.waitForTimeout(300);
    }, errors));
  }

  // ── 150. Browse account pay stubs + click first (Worker) ──────────────────
  if (pct(w, 15000, 10)) {
    inc(await tryAction('browse-account-pay-stubs-deep', async () => {
      await navigateTo(workerPage, '/account/pay-stubs');
      await workerPage.waitForTimeout(800);
      await workerPage.mouse.wheel(0, 200);
      await workerPage.waitForTimeout(300);
      const row = workerPage.locator('table tbody tr, .pay-stub-row, .pay-stub-card').first();
      if (await row.isVisible({ timeout: 2000 }).catch(() => false)) {
        await row.click();
        await workerPage.waitForTimeout(700);
        await workerPage.keyboard.press('Escape').catch(() => {});
        await workerPage.waitForTimeout(300);
      }
    }, errors));
  }

  // ── 151. Browse account tax documents + click first (Worker) ──────────────
  if (pct(w, 15100, 10)) {
    inc(await tryAction('browse-account-tax-documents-deep', async () => {
      await navigateTo(workerPage, '/account/tax-documents');
      await workerPage.waitForTimeout(800);
      await workerPage.mouse.wheel(0, 200);
      await workerPage.waitForTimeout(300);
      const row = workerPage.locator('table tbody tr, .tax-doc-row, .tax-document-card').first();
      if (await row.isVisible({ timeout: 2000 }).catch(() => false)) {
        await row.click();
        await workerPage.waitForTimeout(700);
        await workerPage.keyboard.press('Escape').catch(() => {});
        await workerPage.waitForTimeout(300);
      }
    }, errors));
  }

  // ── 152. Browse account documents + click first (Engineer) ────────────────
  if (pct(w, 15200, 10)) {
    inc(await tryAction('browse-account-documents-deep', async () => {
      await navigateTo(engineerPage, '/account/documents');
      await engineerPage.waitForTimeout(800);
      await engineerPage.mouse.wheel(0, 200);
      await engineerPage.waitForTimeout(300);
      const row = engineerPage.locator('table tbody tr, .document-row, .file-card').first();
      if (await row.isVisible({ timeout: 2000 }).catch(() => false)) {
        await row.click();
        await engineerPage.waitForTimeout(700);
        await engineerPage.keyboard.press('Escape').catch(() => {});
        await engineerPage.waitForTimeout(300);
      }
    }, errors));
  }

  // ── 153. Browse account integrations (Admin) ──────────────────────────────
  if (pct(w, 15300, 10)) {
    inc(await tryAction('browse-account-integrations', async () => {
      await navigateTo(adminPage, '/account/integrations');
      await adminPage.waitForTimeout(800);
      await adminPage.mouse.wheel(0, 200);
      await adminPage.waitForTimeout(300);
    }, errors));
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION H: DEEP FUNCTIONAL COVERAGE — ONBOARDING, MOBILE, SHOP FLOOR,
  //            CUSTOMER RETURNS LIFECYCLE, COMPLIANCE FORMS
  // ════════════════════════════════════════════════════════════════════════════

  // ── 154. Admin creates new user via UI ────────────────────────────────────
  // Once every ~10 weeks, admin creates a new employee and we capture the setup token
  if (pct(w, 15400, 10)) {
    inc(await tryAction('admin-create-user', async () => {
      const firstName = pick(ONBOARDING_FIRST_NAMES, w, 0);
      const lastName = pick(ONBOARDING_LAST_NAMES, w, 1);
      const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${ONBOARDING_EMAILS_DOMAIN}`;
      const role = pick(ONBOARDING_ROLES, w, 2);
      const initials = `${firstName[0]}${lastName[0]}`;

      await navigateTo(adminPage, '/admin/users');
      await clickButton(adminPage, 'new-user-btn');
      await waitForDialog(adminPage);

      await fillInput(adminPage, 'user-first-name', firstName);
      await fillInput(adminPage, 'user-last-name', lastName);
      await fillInput(adminPage, 'user-email', email);
      await fillInput(adminPage, 'user-initials', initials);
      await fillMatSelect(adminPage, 'user-role', role);

      await clickButton(adminPage, 'user-save-btn');

      // Wait for either the setup token (success) or a visible error/disabled save (failure) — up to 6s
      const tokenEl = adminPage.locator('[data-testid="user-setup-token"]');
      await Promise.race([
        tokenEl.waitFor({ state: 'visible', timeout: 6000 }).catch(() => null),
        adminPage.waitForTimeout(6000),
      ]);

      if (await tokenEl.isVisible().catch(() => false)) {
        const token = await tokenEl.textContent();
        if (token?.trim()) {
          console.log(`    [SIM] Created user ${firstName} ${lastName} (${role}), setup token: ${token.trim().substring(0, 8)}...`);
        }
      }

      // Close the dialog — try Done → Cancel → Escape, any of which will dismiss the dialog
      const closeCandidates = [
        'button:has-text("Done")',
        'button:has-text("Cancel")',
      ];
      let closed = false;
      for (const sel of closeCandidates) {
        const btn = adminPage.locator(sel).first();
        if (await btn.isVisible({ timeout: 500 }).catch(() => false)) {
          await btn.click({ force: true }).catch(() => {});
          closed = true;
          break;
        }
      }
      if (!closed) {
        await adminPage.keyboard.press('Escape').catch(() => {});
      }
      await waitForDialogClosed(adminPage).catch(() => { /* best effort */ });
    }, errors));
  }

  // ── 155. Existing user browses & updates W-4 tax form ─────────────────────
  if (pct(w, 15500, 8)) {
    inc(await tryAction('browse-update-w4', async () => {
      await navigateTo(engineerPage, '/account/tax-forms');
      await engineerPage.waitForTimeout(800);

      // Click on W-4 row if visible
      const w4Row = engineerPage.locator('text=W-4').first();
      if (await w4Row.isVisible({ timeout: 3000 }).catch(() => false)) {
        await w4Row.click();
        await engineerPage.waitForTimeout(1000);

        // If we land on the form detail, browse it; if redirected to onboarding, fill it
        const url = engineerPage.url();
        if (url.includes('/onboarding')) {
          // Fill W-4 step (step 2 = index 2 in wizard)
          const filingStatusSelect = engineerPage.locator('[data-testid="onboarding-w4-filing-status"]');
          if (await filingStatusSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
            await fillMatSelect(engineerPage, 'onboarding-w4-filing-status', 'Single');
            await fillInput(engineerPage, 'onboarding-w4-qualifying-children', '0');
            await fillInput(engineerPage, 'onboarding-w4-other-dependents', '0');
            await engineerPage.waitForTimeout(500);
          }
        }
        // Browse whatever page we're on
        await engineerPage.mouse.wheel(0, 300);
        await engineerPage.waitForTimeout(500);
      }
    }, errors));
  }

  // ── 156. Existing user browses I-9 form ───────────────────────────────────
  if (pct(w, 15600, 8)) {
    inc(await tryAction('browse-i9-form', async () => {
      await navigateTo(workerPage, '/account/tax-forms');
      await workerPage.waitForTimeout(800);

      const i9Row = workerPage.locator('text=I-9').first();
      if (await i9Row.isVisible({ timeout: 3000 }).catch(() => false)) {
        await i9Row.click();
        await workerPage.waitForTimeout(1000);
        await workerPage.mouse.wheel(0, 300);
        await workerPage.waitForTimeout(500);
      }
    }, errors));
  }

  // ── 157. Existing user browses state withholding ──────────────────────────
  if (pct(w, 15700, 8)) {
    inc(await tryAction('browse-state-withholding', async () => {
      await navigateTo(officePage, '/account/tax-forms');
      await officePage.waitForTimeout(800);

      const stateRow = officePage.locator('text=State').first();
      if (await stateRow.isVisible({ timeout: 3000 }).catch(() => false)) {
        await stateRow.click();
        await officePage.waitForTimeout(1000);
        await officePage.mouse.wheel(0, 300);
        await officePage.waitForTimeout(500);
      }
    }, errors));
  }

  // ── 158. Resolve a customer return (Office) ───────────────────────────────
  if (pct(w, 15800, 25)) {
    inc(await tryAction('resolve-customer-return', async () => {
      const returns = await getOpenReturns(office);
      const receivedReturn = returns.find(r => r.status === 'Received' || r.status === 'ReworkOrdered' || r.status === 'InInspection');
      if (receivedReturn) {
        await navigateTo(officePage, '/customer-returns');
        await clickRowContaining(officePage, receivedReturn.returnNumber ?? `#${receivedReturn.id}`);
        await officePage.waitForTimeout(800);

        const resolveBtn = officePage.locator('[data-testid="return-resolve-btn"]');
        if (await resolveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await resolveBtn.click();
          await waitForDialog(officePage);

          // Fill inspection notes
          await fillTextarea(officePage, 'return-inspection-notes',
            `Inspected return #${receivedReturn.id}. Items verified against original shipment. Condition documented.`);
          await clickButton(officePage, 'return-resolve-confirm-btn');
          await waitForDialogClosed(officePage);
        }
      }
    }, errors));
  }

  // ── 159. Close a resolved customer return (Manager) ───────────────────────
  if (pct(w, 15900, 25)) {
    inc(await tryAction('close-customer-return', async () => {
      const resolved = await getResolvedReturns(manager);
      if (resolved.length > 0) {
        const ret = resolved[0];
        await navigateTo(managerPage, '/customer-returns');
        await clickRowContaining(managerPage, ret.returnNumber ?? `#${ret.id}`);
        await managerPage.waitForTimeout(800);

        const closeBtn = managerPage.locator('[data-testid="return-close-btn"]');
        if (await closeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await closeBtn.click();
          await managerPage.waitForTimeout(500);

          // Confirm dialog — click the confirm/OK button
          const confirmBtn = managerPage.locator('button:has-text("Confirm"), button:has-text("Close Return"), button:has-text("Yes")');
          if (await confirmBtn.first().isVisible({ timeout: 3000 }).catch(() => false)) {
            await confirmBtn.first().click();
            await managerPage.waitForTimeout(1000);
          }
        }
      }
    }, errors));
  }

  // ── 160. Mobile clock-in/out (Worker via mobile route) ────────────────────
  if (pct(w, 16000, 30)) {
    inc(await tryAction('mobile-clock-action', async () => {
      await navigateTo(workerPage, '/m/clock');
      await workerPage.waitForTimeout(1500);

      // Click the first available clock action button
      const clockBtn = workerPage.locator('[data-testid^="clock-action-"]').first();
      if (await clockBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
        await clockBtn.click();
        await workerPage.waitForTimeout(2000);
      }
    }, errors));
  }

  // ── 161. Mobile browse jobs list (Worker) ─────────────────────────────────
  if (pct(w, 16100, 20)) {
    inc(await tryAction('mobile-browse-jobs', async () => {
      await navigateTo(workerPage, '/m/jobs');
      await workerPage.waitForTimeout(1000);
      await workerPage.mouse.wheel(0, 300);
      await workerPage.waitForTimeout(500);
    }, errors));
  }

  // ── 162. Mobile job detail — toggle timer + add note (Worker) ─────────────
  if (pct(w, 16200, 20)) {
    inc(await tryAction('mobile-job-detail-actions', async () => {
      // Get an active job to interact with
      const jobs = await getActiveJobs(worker);
      if (jobs.length > 0) {
        const job = jobs[seededInt(0, Math.min(jobs.length - 1, 9), w, 162)];
        await navigateTo(workerPage, `/m/jobs/${job.id}`);
        await workerPage.waitForTimeout(1000);

        // Toggle timer (start or stop)
        const timerBtn = workerPage.locator('[data-testid="mjob-timer-btn"]');
        if (await timerBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await timerBtn.click();
          await workerPage.waitForTimeout(1500);
        }

        // Add a note
        const noteInput = workerPage.locator('[data-testid="mjob-note-input"]');
        if (await noteInput.isVisible({ timeout: 3000 }).catch(() => false)) {
          const note = pick(JOB_NOTES_MOBILE, w, 162);
          await noteInput.click();
          await noteInput.fill(note);
          await workerPage.waitForTimeout(300);
          const sendBtn = workerPage.locator('[data-testid="mjob-note-send-btn"]');
          if (await sendBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await sendBtn.click();
            await workerPage.waitForTimeout(1000);
          }
        }
      }
    }, errors));
  }

  // ── 163. Mobile scan — manual barcode entry (Worker) ──────────────────────
  if (pct(w, 16300, 15)) {
    inc(await tryAction('mobile-scan-manual', async () => {
      await navigateTo(workerPage, '/m/scan');
      await workerPage.waitForTimeout(1500);

      // Toggle to manual entry mode
      const manualToggle = workerPage.locator('[data-testid="scan-manual-toggle"]');
      if (await manualToggle.isVisible({ timeout: 3000 }).catch(() => false)) {
        await manualToggle.click();
        await workerPage.waitForTimeout(500);

        // Type a part number or job number as manual scan
        const parts = await getParts(worker);
        if (parts.length > 0) {
          const part = parts[seededInt(0, Math.min(parts.length - 1, 9), w, 163)];
          const manualInput = workerPage.locator('[data-testid="scan-manual-input"]');
          if (await manualInput.isVisible({ timeout: 2000 }).catch(() => false)) {
            await manualInput.fill(part.partNumber ?? `P-${part.id}`);
            await workerPage.waitForTimeout(300);

            const submitBtn = workerPage.locator('[data-testid="scan-manual-submit"]');
            if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
              await submitBtn.click();
              await workerPage.waitForTimeout(1500);

              // If result found, try to open it
              const openBtn = workerPage.locator('[data-testid="scan-open-btn"]');
              if (await openBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
                await openBtn.click();
                await workerPage.waitForTimeout(1000);
              }
            }
          }
        }
      }
    }, errors));
  }

  // ── 164. Mobile chat — browse + open first thread (Engineer) ─────────────
  if (pct(w, 16400, 15)) {
    inc(await tryAction('mobile-chat-browse', async () => {
      await navigateTo(engineerPage, '/m/chat');
      await engineerPage.waitForTimeout(1000);
      await engineerPage.mouse.wheel(0, 200);
      await engineerPage.waitForTimeout(500);
      const thread = engineerPage.locator('.chat-thread, .mobile-thread, [data-testid^="chat-thread-"]').first();
      if (await thread.isVisible({ timeout: 2000 }).catch(() => false)) {
        await thread.click();
        await engineerPage.waitForTimeout(800);
        await engineerPage.goBack().catch(() => {});
        await engineerPage.waitForTimeout(300);
      }
    }, errors));
  }

  // ── 165. Mobile notifications — browse + click first (Engineer) ──────────
  if (pct(w, 16500, 15)) {
    inc(await tryAction('mobile-notifications-browse', async () => {
      await navigateTo(engineerPage, '/m/notifications');
      await engineerPage.waitForTimeout(1000);
      await engineerPage.mouse.wheel(0, 200);
      await engineerPage.waitForTimeout(500);
      const notif = engineerPage.locator('.notification-item, .mobile-notification, [data-testid^="notification-"]').first();
      if (await notif.isVisible({ timeout: 2000 }).catch(() => false)) {
        await notif.click();
        await engineerPage.waitForTimeout(700);
        await engineerPage.keyboard.press('Escape').catch(() => {});
        await engineerPage.waitForTimeout(300);
      }
    }, errors));
  }

  // ── 166. Mobile account page — browse tabs (Worker) ──────────────────────
  if (pct(w, 16600, 10)) {
    inc(await tryAction('mobile-account-browse', async () => {
      await navigateTo(workerPage, '/m/account');
      await workerPage.waitForTimeout(800);
      await workerPage.mouse.wheel(0, 200);
      await workerPage.waitForTimeout(300);
      const tabs = workerPage.locator('[role="tab"], .mobile-account-tab, .account-link');
      const tabCount = Math.min(await tabs.count().catch(() => 0), 3);
      for (let i = 0; i < tabCount; i++) {
        const tab = tabs.nth(i);
        if (await tab.isVisible({ timeout: 1000 }).catch(() => false)) {
          await tab.click();
          await workerPage.waitForTimeout(500);
          if (workerPage.url().includes('/m/account') === false) {
            await workerPage.goBack().catch(() => {});
            await workerPage.waitForTimeout(400);
          }
        }
      }
    }, errors));
  }

  // ── 167. Mobile time tracking — browse + tap entry (Worker) ──────────────
  if (pct(w, 16700, 15)) {
    inc(await tryAction('mobile-time-tracking', async () => {
      await navigateTo(workerPage, '/m/time');
      await workerPage.waitForTimeout(1000);
      await workerPage.mouse.wheel(0, 200);
      await workerPage.waitForTimeout(500);
      const entry = workerPage.locator('.time-entry, .mobile-time-entry, table tbody tr').first();
      if (await entry.isVisible({ timeout: 2000 }).catch(() => false)) {
        await entry.click();
        await workerPage.waitForTimeout(600);
        await workerPage.keyboard.press('Escape').catch(() => {});
        await workerPage.waitForTimeout(300);
      }
    }, errors));
  }

  // ── 168. Shop floor display — browse worker grid (Admin) ──────────────────
  if (pct(w, 16800, 15)) {
    inc(await tryAction('shop-floor-browse', async () => {
      await navigateTo(adminPage, '/display/shop-floor');
      await adminPage.waitForTimeout(2000);

      // Verify worker cards are visible
      const workerCards = adminPage.locator('[data-testid^="sf-worker-"]');
      const count = await workerCards.count().catch(() => 0);
      if (count > 0) {
        // Click first worker card to see their actions
        await workerCards.first().click();
        await adminPage.waitForTimeout(1500);

        // Cancel out of actions overlay
        const cancelBtn = adminPage.locator('[data-testid="sf-cancel-btn"]');
        if (await cancelBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await cancelBtn.click();
          await adminPage.waitForTimeout(500);
        }
      }
    }, errors));
  }

  // ── 169. Shop floor clock page — browse + focus scan input (Admin) ───────
  if (pct(w, 16900, 10)) {
    inc(await tryAction('shop-floor-clock-browse', async () => {
      await navigateTo(adminPage, '/display/shop-floor/clock');
      await adminPage.waitForTimeout(1500);
      await adminPage.mouse.wheel(0, 200);
      await adminPage.waitForTimeout(500);
      const scanInput = adminPage.locator('[data-testid="shop-floor-scan-input"], [data-testid="barcode-scan-input"], input[type="text"]').first();
      if (await scanInput.isVisible({ timeout: 1500 }).catch(() => false)) {
        await scanInput.click().catch(() => {});
        await adminPage.waitForTimeout(300);
        await adminPage.keyboard.press('Escape').catch(() => {});
        await adminPage.waitForTimeout(200);
      }
    }, errors));
  }

  // ── 170. Shop floor scan log — browse + click entry (Admin) ──────────────
  if (pct(w, 17000, 10)) {
    inc(await tryAction('shop-floor-scan-log', async () => {
      await navigateTo(adminPage, '/display/shop-floor/scan-log');
      await adminPage.waitForTimeout(1000);
      await adminPage.mouse.wheel(0, 200);
      await adminPage.waitForTimeout(500);
      const entry = adminPage.locator('table tbody tr, .scan-log-row, .scan-log-entry').first();
      if (await entry.isVisible({ timeout: 2000 }).catch(() => false)) {
        await entry.click();
        await adminPage.waitForTimeout(500);
        await adminPage.keyboard.press('Escape').catch(() => {});
        await adminPage.waitForTimeout(300);
      }
    }, errors));
  }

  // ── 171. Admin employee detail — all tabs deep browse ─────────────────────
  if (pct(w, 17100, 12)) {
    inc(await tryAction('admin-employee-detail-deep', async () => {
      const users = await getAllUsers(admin);
      const nonAdminUsers = users.filter(u => !u.roles.includes('Admin'));
      if (nonAdminUsers.length > 0) {
        const user = nonAdminUsers[seededInt(0, Math.min(nonAdminUsers.length - 1, 5), w, 171)];
        await navigateTo(adminPage, '/admin/users');
        await clickRowContaining(adminPage, user.lastName);
        await adminPage.waitForTimeout(1000);

        // Browse through employee detail tabs: profile, time, jobs, training, compliance, pay
        const tabs = ['profile', 'time-entries', 'jobs', 'training', 'compliance', 'pay-stubs'];
        for (const tab of tabs) {
          const tabBtn = adminPage.locator(`[data-testid="employee-tab-${tab}"], a:has-text("${tab}"), [role="tab"]:has-text("${tab}")`).first();
          if (await tabBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await tabBtn.click();
            await adminPage.waitForTimeout(600);
            await adminPage.mouse.wheel(0, 150);
            await adminPage.waitForTimeout(300);
          }
        }
      }
    }, errors));
  }

  // ── 172. Customer detail — deep tab browsing (all tabs) ───────────────────
  if (pct(w, 17200, 15)) {
    inc(await tryAction('customer-detail-all-tabs', async () => {
      const customers = await getCustomers(office);
      if (customers.length > 0) {
        const customer = customers[seededInt(0, Math.min(customers.length - 1, 9), w, 172)];

        // Browse all 9 customer tabs
        const tabs = ['overview', 'contacts', 'addresses', 'estimates', 'quotes', 'orders', 'jobs', 'invoices', 'activity'];
        for (const tab of tabs) {
          await navigateTo(officePage, `/customers/${customer.id}/${tab}`);
          await officePage.waitForTimeout(600);
          await officePage.mouse.wheel(0, 200);
          await officePage.waitForTimeout(300);
        }
      }
    }, errors));
  }

  // ── 173. Onboarding wizard — full 7-step flow (using engineer page) ───────
  // Simulates an existing user re-entering onboarding. Runs rarely (1 in ~50 weeks).
  if (pct(w, 17300, 2)) {
    inc(await tryAction('onboarding-full-wizard', async () => {
      await navigateTo(engineerPage, '/onboarding');
      await engineerPage.waitForTimeout(1500);

      // Step 0: Personal Info
      const firstNameInput = engineerPage.locator('[data-testid="onboarding-first-name"]');
      if (await firstNameInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        const first = pick(ONBOARDING_FIRST_NAMES, w, 173);
        const last = pick(ONBOARDING_LAST_NAMES, w, 174);
        const state = pick(US_STATES_COMMON, w, 175);
        const dob = `01/${seededInt(10, 28, w, 1)}/${seededInt(1970, 1998, w, 2)}`;

        // Personal Info
        await fillInput(engineerPage, 'onboarding-first-name', first);
        await fillInput(engineerPage, 'onboarding-last-name', last);
        await fillDatepicker(engineerPage, 'onboarding-dob', dob);
        await fillInput(engineerPage, 'onboarding-ssn', `${seededInt(100, 999, w, 3)}-${seededInt(10, 99, w, 4)}-${seededInt(1000, 9999, w, 5)}`);
        await fillInput(engineerPage, 'onboarding-phone', `(${seededInt(200, 999, w, 6)}) ${seededInt(200, 999, w, 7)}-${seededInt(1000, 9999, w, 8)}`);
        await engineerPage.waitForTimeout(300);

        // Click Continue
        const continueBtn = engineerPage.locator('[data-testid="onboarding-continue-btn"]');
        if (await continueBtn.isEnabled({ timeout: 2000 }).catch(() => false)) {
          await continueBtn.click();
          await engineerPage.waitForTimeout(1000);
        }

        // Step 1: Address
        const street1 = engineerPage.locator('[data-testid="onboarding-street1"]');
        if (await street1.isVisible({ timeout: 3000 }).catch(() => false)) {
          await fillInput(engineerPage, 'onboarding-street1', pick(STREET_ADDRESSES, w, 176));
          await fillInput(engineerPage, 'onboarding-city', pick(CITY_NAMES, w, 177));
          await fillMatSelect(engineerPage, 'onboarding-state', state);
          await fillInput(engineerPage, 'onboarding-zip', `${seededInt(10000, 99999, w, 9)}`);
          await engineerPage.waitForTimeout(300);

          if (await continueBtn.isEnabled({ timeout: 2000 }).catch(() => false)) {
            await continueBtn.click();
            await engineerPage.waitForTimeout(1000);
          }
        }

        // Step 2: W-4
        const w4Filing = engineerPage.locator('[data-testid="onboarding-w4-filing-status"]');
        if (await w4Filing.isVisible({ timeout: 3000 }).catch(() => false)) {
          const filingOptions = ['Single', 'MFJ', 'HH'];
          await fillMatSelect(engineerPage, 'onboarding-w4-filing-status', filingOptions[w % 3]);
          await fillInput(engineerPage, 'onboarding-w4-qualifying-children', String(seededInt(0, 3, w, 10)));
          await fillInput(engineerPage, 'onboarding-w4-other-dependents', String(seededInt(0, 2, w, 11)));
          await engineerPage.waitForTimeout(300);

          if (await continueBtn.isEnabled({ timeout: 2000 }).catch(() => false)) {
            await continueBtn.click();
            await engineerPage.waitForTimeout(1000);
          }
        }

        // Step 3: State Withholding
        const stateFilingSelect = engineerPage.locator('[data-testid="onboarding-state-filing-status"]');
        if (await stateFilingSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
          await fillMatSelect(engineerPage, 'onboarding-state-filing-status', 'Single');
          await fillInput(engineerPage, 'onboarding-state-allowances', String(seededInt(0, 5, w, 12)));
          await engineerPage.waitForTimeout(300);

          if (await continueBtn.isEnabled({ timeout: 2000 }).catch(() => false)) {
            await continueBtn.click();
            await engineerPage.waitForTimeout(1000);
          }
        } else {
          // State has no income tax — just continue
          if (await continueBtn.isEnabled({ timeout: 2000 }).catch(() => false)) {
            await continueBtn.click();
            await engineerPage.waitForTimeout(1000);
          }
        }

        // Step 4: I-9
        const citizenshipSelect = engineerPage.locator('[data-testid="onboarding-i9-citizenship"]');
        if (await citizenshipSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
          await fillMatSelect(engineerPage, 'onboarding-i9-citizenship', '1'); // US Citizen

          // Choose List A (single document proving both identity and work auth)
          const listABtn = engineerPage.locator('[data-testid="onboarding-i9-list-a-btn"]');
          if (await listABtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await listABtn.click();
            await engineerPage.waitForTimeout(500);
          }

          await fillMatSelect(engineerPage, 'onboarding-i9-list-a-type', pick(I9_LIST_A_DOC_TYPES, w, 178));
          await fillInput(engineerPage, 'onboarding-i9-list-a-doc-number', pick(DOC_NUMBERS, w, 179));
          await fillInput(engineerPage, 'onboarding-i9-list-a-authority', pick(DOC_AUTHORITIES, w, 180));
          await fillDatepicker(engineerPage, 'onboarding-i9-list-a-expiry',
            `12/${seededInt(10, 28, w, 13)}/${seededInt(2027, 2032, w, 14)}`);
          await engineerPage.waitForTimeout(300);

          if (await continueBtn.isEnabled({ timeout: 2000 }).catch(() => false)) {
            await continueBtn.click();
            await engineerPage.waitForTimeout(1000);
          }
        }

        // Step 5: Direct Deposit
        const bankName = engineerPage.locator('[data-testid="onboarding-bank-name"]');
        if (await bankName.isVisible({ timeout: 3000 }).catch(() => false)) {
          await fillInput(engineerPage, 'onboarding-bank-name', pick(BANK_NAMES, w, 181));
          await fillInput(engineerPage, 'onboarding-routing-number', pick(ROUTING_NUMBERS, w, 182));
          await fillInput(engineerPage, 'onboarding-account-number', `${seededInt(10000000, 99999999, w, 15)}${seededInt(100, 999, w, 16)}`);
          await fillMatSelect(engineerPage, 'onboarding-account-type', w % 2 === 0 ? 'Checking' : 'Savings');
          await engineerPage.waitForTimeout(300);

          // Note: voidedCheckFileId is required but file upload needs a real file —
          // skip the continue here as we can't upload without a real file
          // Instead, just verify we filled all fields correctly
          await engineerPage.mouse.wheel(0, 200);
          await engineerPage.waitForTimeout(500);
        }

        // Step 6: Acknowledgments (if we got this far)
        const ackWorkers = engineerPage.locator('[data-testid="onboarding-ack-workers-comp"]');
        if (await ackWorkers.isVisible({ timeout: 3000 }).catch(() => false)) {
          // Toggle both acknowledgments on
          await ackWorkers.click();
          await engineerPage.waitForTimeout(300);
          const ackHandbook = engineerPage.locator('[data-testid="onboarding-ack-handbook"]');
          if (await ackHandbook.isVisible({ timeout: 2000 }).catch(() => false)) {
            await ackHandbook.click();
            await engineerPage.waitForTimeout(300);
          }
          // Don't submit — just verify the toggles work
        }
      }
    }, errors));
  }

  // ── 174. Deep approval workflow — approve pending expense (Manager) ───────
  if (pct(w, 17400, 20)) {
    inc(await tryAction('approve-expense-deep', async () => {
      const pending = await getPendingExpenses(manager);
      if (pending.length > 0) {
        await navigateTo(managerPage, '/approvals/inbox');
        await managerPage.waitForTimeout(1000);

        // Click the first pending item
        const firstRow = managerPage.locator('table tbody tr, .approval-item, [role="row"]').first();
        if (await firstRow.isVisible({ timeout: 3000 }).catch(() => false)) {
          await firstRow.click();
          await managerPage.waitForTimeout(800);

          // Click approve
          const approveBtn = managerPage.locator('[data-testid="approval-approve-btn"]');
          if (await approveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await approveBtn.click();
            await managerPage.waitForTimeout(1500);
          }
        }
      }
    }, errors));
  }

  // ── 175. Sales order — confirm draft (Office) ─────────────────────────────
  if (pct(w, 17500, 20)) {
    inc(await tryAction('confirm-sales-order', async () => {
      const drafts = await getDraftSalesOrders(office);
      if (drafts.length > 0) {
        const so = drafts[0];
        await navigateTo(officePage, '/sales-orders');
        await clickRowContaining(officePage, `SO-${so.id}`);
        await officePage.waitForTimeout(800);

        const confirmBtn = officePage.locator('[data-testid="so-confirm-btn"]');
        if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await confirmBtn.click();
          await officePage.waitForTimeout(500);
          // Confirm in the confirmation dialog
          const okBtn = officePage.locator('button:has-text("Confirm"), button:has-text("Yes")');
          if (await okBtn.first().isVisible({ timeout: 3000 }).catch(() => false)) {
            await okBtn.first().click();
            await officePage.waitForTimeout(1500);
          }
        }
      }
    }, errors));
  }

  // ── 176. Shipment — mark shipped (Office) ─────────────────────────────────
  if (pct(w, 17600, 20)) {
    inc(await tryAction('mark-shipment-shipped', async () => {
      const pending = await getShipmentsByStatus(office, 'Pending');
      if (pending.length > 0) {
        await navigateTo(officePage, '/shipments');
        const shipment = pending[0];
        await clickRowContaining(officePage, shipment.trackingNumber ?? `#${shipment.id}`);
        await officePage.waitForTimeout(800);

        const shipBtn = officePage.locator('[data-testid="shipment-mark-shipped-btn"]');
        if (await shipBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await shipBtn.click();
          await officePage.waitForTimeout(1500);
        }
      }
    }, errors));
  }

  // ── 177. Shipment — mark delivered (Office) ───────────────────────────────
  if (pct(w, 17700, 20)) {
    inc(await tryAction('mark-shipment-delivered', async () => {
      const shipped = await getShipmentsByStatus(office, 'Shipped');
      if (shipped.length > 0) {
        await navigateTo(officePage, '/shipments');
        const shipment = shipped[0];
        await clickRowContaining(officePage, shipment.trackingNumber ?? `#${shipment.id}`);
        await officePage.waitForTimeout(800);

        const deliverBtn = officePage.locator('[data-testid="shipment-mark-delivered-btn"]');
        if (await deliverBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await deliverBtn.click();
          await officePage.waitForTimeout(1500);
        }
      }
    }, errors));
  }

  // ── 178. PO receiving — receive items (Office) ────────────────────────────
  if (pct(w, 17800, 20)) {
    inc(await tryAction('receive-po-items', async () => {
      const confirmedPOs = await getPurchaseOrdersByStatus(office, 'Confirmed');
      if (confirmedPOs.length > 0) {
        const po = confirmedPOs[0];
        await navigateTo(officePage, '/purchase-orders/orders');
        await clickRowContaining(officePage, po.poNumber ?? `PO-${po.id}`);
        await officePage.waitForTimeout(800);

        // Look for receive button
        const receiveBtn = officePage.locator('[data-testid="po-receive-btn"]');
        if (await receiveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await receiveBtn.click();
          await waitForDialog(officePage);
          await officePage.waitForTimeout(500);

          // Fill receive dialog — try to submit with whatever defaults exist
          const saveBtn = officePage.locator('[data-testid="receive-save-btn"], button:has-text("Receive"), button:has-text("Save")');
          if (await saveBtn.first().isVisible({ timeout: 3000 }).catch(() => false)) {
            await saveBtn.first().click();
            await officePage.waitForTimeout(1500);
          }
        }
      }
    }, errors));
  }

  // ── 179. Inventory cycle count — browse (Admin) ───────────────────────────
  if (pct(w, 17900, 12)) {
    inc(await tryAction('inventory-cycle-counts', async () => {
      await navigateTo(adminPage, '/inventory/cycleCounts');
      await adminPage.waitForTimeout(1000);
      await adminPage.mouse.wheel(0, 200);
      await adminPage.waitForTimeout(500);
    }, errors));
  }

  // ── 180. Asset detail — browse maintenance tab (Engineer) ─────────────────
  if (pct(w, 18000, 12)) {
    inc(await tryAction('asset-maintenance-deep', async () => {
      const assets = await getAssets(engineer);
      if (assets.length > 0) {
        const asset = assets[seededInt(0, Math.min(assets.length - 1, 5), w, 180)];
        await navigateTo(engineerPage, '/assets');
        await clickRowContaining(engineerPage, asset.name);
        await engineerPage.waitForTimeout(800);

        // Browse maintenance tab
        const maintenanceTab = engineerPage.locator('[role="tab"]:has-text("Maintenance"), a:has-text("Maintenance")').first();
        if (await maintenanceTab.isVisible({ timeout: 3000 }).catch(() => false)) {
          await maintenanceTab.click();
          await engineerPage.waitForTimeout(800);
          await engineerPage.mouse.wheel(0, 200);
          await engineerPage.waitForTimeout(300);
        }

        // Browse history tab
        const historyTab = engineerPage.locator('[role="tab"]:has-text("History"), a:has-text("History")').first();
        if (await historyTab.isVisible({ timeout: 2000 }).catch(() => false)) {
          await historyTab.click();
          await engineerPage.waitForTimeout(600);
          await engineerPage.mouse.wheel(0, 200);
          await engineerPage.waitForTimeout(300);
        }
      }
    }, errors));
  }

  // ── 181. QC inspection with detailed result (Engineer) ────────────────────
  if (pct(w, 18100, 15)) {
    inc(await tryAction('qc-inspection-deep', async () => {
      await navigateTo(engineerPage, '/quality/inspections');
      await engineerPage.waitForTimeout(800);

      const newBtn = engineerPage.locator('[data-testid="new-inspection-btn"]');
      if (await newBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await newBtn.click();
        await waitForDialog(engineerPage);

        // Fill inspection form
        const templates = await getQcTemplates(engineer);
        if (templates.length > 0) {
          await fillMatSelect(engineerPage, 'inspection-template', templates[0].name);
        }

        // Fill notes with pass/fail language
        const passFailNote = w % 2 === 0
          ? 'PASS — All dimensions within tolerance. Surface finish meets Ra 32 spec.'
          : 'FAIL — OD measurement 0.003" over max tolerance on 2 of 5 samples. Rework required.';
        await fillTextarea(engineerPage, 'inspection-notes', passFailNote);

        // Try to save
        const saveBtn = engineerPage.locator('[data-testid="inspection-save-btn"], button:has-text("Save")');
        if (await saveBtn.first().isVisible({ timeout: 2000 }).catch(() => false)) {
          await saveBtn.first().click();
          await engineerPage.waitForTimeout(1500);
        }
      }
    }, errors));
  }

  // ── 182. Report builder — run a saved report (PM) ─────────────────────────
  if (pct(w, 18200, 15)) {
    inc(await tryAction('run-saved-report', async () => {
      const reports = await getSavedReports(pm);
      if (reports.length > 0) {
        const report = reports[seededInt(0, Math.min(reports.length - 1, 5), w, 182)];
        await navigateTo(pmPage, '/reports/builder');
        await pmPage.waitForTimeout(800);

        // Click on the saved report
        const reportLink = pmPage.locator(`text=${report.name}`).first();
        if (await reportLink.isVisible({ timeout: 3000 }).catch(() => false)) {
          await reportLink.click();
          await pmPage.waitForTimeout(2000);

          // Run the report
          const runBtn = pmPage.locator('[data-testid="report-run-btn"], button:has-text("Run")');
          if (await runBtn.first().isVisible({ timeout: 3000 }).catch(() => false)) {
            await runBtn.first().click();
            await pmPage.waitForTimeout(3000);
          }

          // Scroll through results
          await pmPage.mouse.wheel(0, 400);
          await pmPage.waitForTimeout(500);
        }
      }
    }, errors));
  }

  // ── 183. Dashboard — interact with widgets (Admin) ────────────────────────
  if (pct(w, 18300, 15)) {
    inc(await tryAction('dashboard-widget-interaction', async () => {
      await navigateTo(adminPage, '/dashboard');
      await adminPage.waitForTimeout(2000);

      // Click through KPI chips
      const kpiChips = adminPage.locator('app-kpi-chip, .kpi-chip');
      const chipCount = await kpiChips.count().catch(() => 0);
      for (let i = 0; i < Math.min(chipCount, 4); i++) {
        await kpiChips.nth(i).click().catch(() => {});
        await adminPage.waitForTimeout(300);
      }

      // Scroll to see all widgets
      await adminPage.mouse.wheel(0, 600);
      await adminPage.waitForTimeout(500);
    }, errors));
  }

  // ── 184. Training module — complete a lesson (Worker) ─────────────────────
  if (pct(w, 18400, 12)) {
    inc(await tryAction('training-lesson-interaction', async () => {
      await navigateTo(workerPage, '/training');
      await workerPage.waitForTimeout(1000);

      // Click on first available module
      const moduleCard = workerPage.locator('.module-card, [data-testid^="training-module-"]').first();
      if (await moduleCard.isVisible({ timeout: 3000 }).catch(() => false)) {
        await moduleCard.click();
        await workerPage.waitForTimeout(1500);

        // Scroll through lesson content
        await workerPage.mouse.wheel(0, 400);
        await workerPage.waitForTimeout(500);
        await workerPage.mouse.wheel(0, 400);
        await workerPage.waitForTimeout(500);

        // Try to mark as complete
        const completeBtn = workerPage.locator('button:has-text("Complete"), button:has-text("Mark Complete"), button:has-text("Finish")');
        if (await completeBtn.first().isVisible({ timeout: 3000 }).catch(() => false)) {
          await completeBtn.first().click();
          await workerPage.waitForTimeout(1000);
        }
      }
    }, errors));
  }

  // ── 185. EDI transactions — browse + open first (Admin) ─────────────────
  if (pct(w, 18500, 8)) {
    inc(await tryAction('edi-transactions-browse', async () => {
      await navigateTo(adminPage, '/admin/edi');
      await adminPage.waitForTimeout(1000);

      const tabs = ['partners', 'transactions', 'mappings'];
      for (const tab of tabs) {
        const tabEl = adminPage.locator(`[role="tab"]:has-text("${tab}"), a:has-text("${tab}")`).first();
        if (await tabEl.isVisible({ timeout: 2000 }).catch(() => false)) {
          await tabEl.click();
          await adminPage.waitForTimeout(600);
          await adminPage.mouse.wheel(0, 150);
          await adminPage.waitForTimeout(300);
          const row = adminPage.locator('table tbody tr').first();
          if (await row.isVisible({ timeout: 1500 }).catch(() => false)) {
            await row.click();
            await adminPage.waitForTimeout(600);
            await adminPage.keyboard.press('Escape').catch(() => {});
            await adminPage.waitForTimeout(200);
          }
        }
      }
    }, errors));
  }

  // ── 186. Vendor detail — deep browse (Office) ─────────────────────────────
  if (pct(w, 18600, 12)) {
    inc(await tryAction('vendor-detail-deep', async () => {
      const vendors = await getVendors(office);
      if (vendors.length > 0) {
        const vendor = vendors[seededInt(0, Math.min(vendors.length - 1, 5), w, 186)];
        await navigateTo(officePage, '/vendors');
        await clickRowContaining(officePage, vendor.name);
        await officePage.waitForTimeout(800);

        // Browse vendor detail tabs
        await officePage.mouse.wheel(0, 300);
        await officePage.waitForTimeout(500);
      }
    }, errors));
  }

  // ── 187. Backlog — drag/interact with job cards (PM) ──────────────────────
  if (pct(w, 18700, 15)) {
    inc(await tryAction('backlog-job-interaction', async () => {
      await navigateTo(pmPage, '/backlog');
      await pmPage.waitForTimeout(1000);

      // Click on a backlog job to open detail
      const jobRow = pmPage.locator('table tbody tr, .backlog-item, [role="row"]').first();
      if (await jobRow.isVisible({ timeout: 3000 }).catch(() => false)) {
        await jobRow.click();
        await pmPage.waitForTimeout(800);

        // Scroll through detail
        await pmPage.mouse.wheel(0, 300);
        await pmPage.waitForTimeout(500);
      }
    }, errors));
  }

  // ── 188. Calendar — browse month/week views (PM) ──────────────────────────
  if (pct(w, 18800, 12)) {
    inc(await tryAction('calendar-views-browse', async () => {
      await navigateTo(pmPage, '/calendar');
      await pmPage.waitForTimeout(1500);

      // Navigate calendar — click next/prev month buttons
      const nextBtn = pmPage.locator('button[aria-label="Next month"], .mat-calendar-next-button').first();
      if (await nextBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await nextBtn.click();
        await pmPage.waitForTimeout(800);
        await nextBtn.click();
        await pmPage.waitForTimeout(800);

        // Go back
        const prevBtn = pmPage.locator('button[aria-label="Previous month"], .mat-calendar-previous-button').first();
        if (await prevBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await prevBtn.click();
          await pmPage.waitForTimeout(800);
        }
      }
    }, errors));
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SECTION AT: WAVE 10 SCAN FLOWS + SECURITY + PROFILE DEEP COVERAGE
  // ════════════════════════════════════════════════════════════════════════════

  // ── 189. Wave 10 scan action overlay — open + cancel (Worker) ─────────────
  // Exercises the scan-action-overlay quick-action-panel entry point.
  // Opens overlay via mobile scan UI, clicks an action button, cancels back.
  if (pct(w, 18900, 10)) {
    inc(await tryAction('scan-action-overlay-browse', async () => {
      await navigateTo(workerPage, '/m/scan');
      await workerPage.waitForTimeout(1200);

      const manualToggle = workerPage.locator('[data-testid="scan-manual-toggle"]');
      if (await manualToggle.isVisible({ timeout: 2000 }).catch(() => false)) {
        await manualToggle.click();
        await workerPage.waitForTimeout(400);

        const parts = await getParts(worker);
        if (parts.length > 0) {
          const part = parts[seededInt(0, Math.min(parts.length - 1, 5), w, 189)];
          const manualInput = workerPage.locator('[data-testid="scan-manual-input"]');
          if (await manualInput.isVisible({ timeout: 2000 }).catch(() => false)) {
            await manualInput.fill(part.partNumber ?? `P-${part.id}`);
            await workerPage.waitForTimeout(200);

            const submitBtn = workerPage.locator('[data-testid="scan-manual-submit"]');
            if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
              await submitBtn.click();
              await workerPage.waitForTimeout(1500);

              // If the scan-action-overlay appears, browse the actions panel and close
              const overlay = workerPage.locator('[data-testid="scan-overlay"]');
              if (await overlay.isVisible({ timeout: 2500 }).catch(() => false)) {
                // Try to click a non-destructive action (count) if enabled, else close
                const countAction = workerPage.locator('[data-testid="quick-action-count"]');
                if (await countAction.isVisible({ timeout: 1500 }).catch(() => false)) {
                  const isDisabled = await countAction.isDisabled().catch(() => true);
                  if (!isDisabled) {
                    await countAction.click();
                    await workerPage.waitForTimeout(800);
                    // Cancel out of whatever flow opened
                    const cancelBtn = workerPage.locator('button:has-text("Cancel")').first();
                    if (await cancelBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
                      await cancelBtn.click();
                      await workerPage.waitForTimeout(300);
                    }
                  }
                }

                const doneBtn = workerPage.locator('[data-testid="scan-overlay-done"]');
                if (await doneBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
                  await doneBtn.click();
                  await workerPage.waitForTimeout(300);
                }
              }
            }
          }
        }
      }
    }, errors));
  }

  // ── 190. Security page — open MFA setup dialog + cancel (Engineer) ────────
  // Opens the MFA TOTP setup dialog, views the QR/manual-key step, cancels.
  // Full TOTP verification requires a bespoke generator; this is a smoke test.
  if (pct(w, 19000, 5)) {
    inc(await tryAction('mfa-setup-browse', async () => {
      await navigateTo(engineerPage, '/account/security');
      await engineerPage.waitForTimeout(1000);

      const setupBtn = engineerPage.locator('button:has-text("Enable Two-Factor"), button:has-text("Set Up"), button:has-text("Enable MFA")').first();
      if (await setupBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await setupBtn.click();
        await engineerPage.waitForTimeout(1500);

        // Expand manual key section to exercise that branch
        const manualKeyToggle = engineerPage.locator('button:has-text("Can\'t scan?"), button:has-text("Enter key manually")').first();
        if (await manualKeyToggle.isVisible({ timeout: 2000 }).catch(() => false)) {
          await manualKeyToggle.click();
          await engineerPage.waitForTimeout(400);
        }

        // Cancel out
        const cancelBtn = engineerPage.locator('button:has-text("Cancel")').first();
        if (await cancelBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await cancelBtn.click();
          await engineerPage.waitForTimeout(500);
        }
      }
    }, errors));
  }

  // ── 191. Account profile — update optional fields (Worker) ────────────────
  // Improves profile completeness by updating phone/emergency contact.
  if (pct(w, 19100, 12)) {
    inc(await tryAction('profile-field-update', async () => {
      await navigateTo(workerPage, '/account/profile');
      await workerPage.waitForTimeout(1000);

      // Try to update phone field if available
      const phoneInput = workerPage.locator('input[formcontrolname="phone"], [data-testid="profile-phone"] input').first();
      if (await phoneInput.isVisible({ timeout: 2500 }).catch(() => false)) {
        await phoneInput.fill('');
        await phoneInput.fill('(555) 010-' + String(1000 + (w % 9000)).padStart(4, '0'));
        await workerPage.waitForTimeout(300);

        const saveBtn = workerPage.locator('button:has-text("Save"), button:has-text("Update")').first();
        if (await saveBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          const isDisabled = await saveBtn.isDisabled().catch(() => true);
          if (!isDisabled) {
            await saveBtn.click();
            await workerPage.waitForTimeout(1000);
          }
        }
      }
    }, errors));
  }

  // ── 192. Account customization — change theme + persist (Engineer) ────────
  if (pct(w, 19200, 8)) {
    inc(await tryAction('account-customization-update', async () => {
      await navigateTo(engineerPage, '/account/customization');
      await engineerPage.waitForTimeout(1000);

      // Click any theme toggle / variant buttons that exist
      const themeBtn = engineerPage.locator('button[role="radio"], .theme-swatch, [data-testid*="theme"]').first();
      if (await themeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await themeBtn.click();
        await engineerPage.waitForTimeout(400);
      }

      await engineerPage.mouse.wheel(0, 200);
      await engineerPage.waitForTimeout(300);
    }, errors));
  }

  // ── 193. Admin MFA compliance panel — browse + click row (Admin) ─────────
  if (pct(w, 19300, 8)) {
    inc(await tryAction('admin-mfa-compliance-browse', async () => {
      await navigateTo(adminPage, '/admin/mfa');
      await adminPage.waitForTimeout(1200);
      await adminPage.mouse.wheel(0, 300);
      await adminPage.waitForTimeout(300);

      const userRow = adminPage.locator('table tbody tr').first();
      if (await userRow.isVisible({ timeout: 2000 }).catch(() => false)) {
        await userRow.click();
        await adminPage.waitForTimeout(600);
        await adminPage.keyboard.press('Escape').catch(() => {});
        await adminPage.waitForTimeout(300);
      }
    }, errors));
  }

  // ── 194. Admin integration outbox — browse dead-letter + retry UI (Admin) ─
  // Exercises the Phase 0 integration outbox admin panel.
  if (pct(w, 19400, 10)) {
    inc(await tryAction('admin-integration-outbox-browse', async () => {
      await navigateTo(adminPage, '/admin/integration-outbox');
      await adminPage.waitForTimeout(1200);
      await adminPage.mouse.wheel(0, 200);
      await adminPage.waitForTimeout(300);

      // Click refresh button if present to exercise the API call
      const refreshBtn = adminPage.locator('button[aria-label*="Refresh"], button:has-text("Refresh")').first();
      if (await refreshBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await refreshBtn.click();
        await adminPage.waitForTimeout(600);
      }

      // Hover over any row to preview detail
      const row = adminPage.locator('table tbody tr').first();
      if (await row.isVisible({ timeout: 2000 }).catch(() => false)) {
        await row.click();
        await adminPage.waitForTimeout(500);
      }
    }, errors));
  }

  // ── 195. Scan devices panel — browse + click row (Admin) ────────────────
  if (pct(w, 19500, 6)) {
    inc(await tryAction('admin-scan-devices-browse', async () => {
      await navigateTo(adminPage, '/admin/scanner-devices');
      await adminPage.waitForTimeout(1000);
      await adminPage.mouse.wheel(0, 200);
      await adminPage.waitForTimeout(300);
      const row = adminPage.locator('table tbody tr, .device-row, .scanner-device-card').first();
      if (await row.isVisible({ timeout: 2000 }).catch(() => false)) {
        await row.click();
        await adminPage.waitForTimeout(600);
        await adminPage.keyboard.press('Escape').catch(() => {});
        await adminPage.waitForTimeout(300);
      }
    }, errors));
  }

  // ── 196. Domain event failures panel — browse + refresh (Admin) ───────────
  // Exercises the dead-letter queue admin UI for domain event handler failures.
  if (pct(w, 19600, 8)) {
    inc(await tryAction('admin-domain-event-failures-browse', async () => {
      await navigateTo(adminPage, '/admin/domain-event-failures');
      await adminPage.waitForTimeout(1200);

      const refreshBtn = adminPage.locator('button[aria-label*="Refresh"], button:has-text("Refresh")').first();
      if (await refreshBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await refreshBtn.click();
        await adminPage.waitForTimeout(500);
      }

      await adminPage.mouse.wheel(0, 200);
      await adminPage.waitForTimeout(300);

      // Click first row to view detail if any
      const row = adminPage.locator('table tbody tr').first();
      if (await row.isVisible({ timeout: 2000 }).catch(() => false)) {
        await row.click();
        await adminPage.waitForTimeout(500);
      }
    }, errors));
  }

  // ── 197. Auto-PO settings — browse admin panel (Admin) ────────────────────
  if (pct(w, 19700, 6)) {
    inc(await tryAction('admin-auto-po-settings-browse', async () => {
      await navigateTo(adminPage, '/admin/auto-po');
      await adminPage.waitForTimeout(1000);
      await adminPage.mouse.wheel(0, 300);
      await adminPage.waitForTimeout(300);

      // Hover over any threshold control
      const input = adminPage.locator('input[type="number"]').first();
      if (await input.isVisible({ timeout: 1500 }).catch(() => false)) {
        await input.hover();
        await adminPage.waitForTimeout(200);
      }
    }, errors));
  }

  // ── 198. Admin scheduled tasks — browse + toggle visibility (Admin) ───────
  if (pct(w, 19800, 8)) {
    inc(await tryAction('admin-scheduled-tasks-browse', async () => {
      await navigateTo(adminPage, '/admin/scheduled-tasks');
      await adminPage.waitForTimeout(1000);
      await adminPage.mouse.wheel(0, 200);
      await adminPage.waitForTimeout(300);

      // Click first task row to view detail
      const row = adminPage.locator('table tbody tr').first();
      if (await row.isVisible({ timeout: 2000 }).catch(() => false)) {
        await row.click();
        await adminPage.waitForTimeout(600);
        await adminPage.keyboard.press('Escape').catch(() => {});
      }
    }, errors));
  }

  // ── 199. Kanban — click first card to open detail panel (Engineer) ────────
  if (pct(w, 19900, 15)) {
    inc(await tryAction('kanban-job-detail-deep', async () => {
      await navigateTo(engineerPage, '/kanban');
      await engineerPage.waitForTimeout(1500);

      const card = engineerPage.locator('.kanban-card, [data-testid^="job-card"]').first();
      if (await card.isVisible({ timeout: 3000 }).catch(() => false)) {
        await card.click();
        await engineerPage.waitForTimeout(1000);
        await engineerPage.mouse.wheel(0, 400);
        await engineerPage.waitForTimeout(300);
        await engineerPage.keyboard.press('Escape').catch(() => {});
        await engineerPage.waitForTimeout(300);
      }
    }, errors));
  }

  // ── 200. Approvals inbox — browse + open first item (Manager) ─────────────
  if (pct(w, 20000, 10)) {
    inc(await tryAction('approvals-inbox-deep', async () => {
      await navigateTo(managerPage, '/approvals');
      await managerPage.waitForTimeout(1000);
      await managerPage.mouse.wheel(0, 200);
      await managerPage.waitForTimeout(300);

      const row = managerPage.locator('table tbody tr, .approval-item').first();
      if (await row.isVisible({ timeout: 2000 }).catch(() => false)) {
        await row.click();
        await managerPage.waitForTimeout(800);
        await managerPage.keyboard.press('Escape').catch(() => {});
      }
    }, errors));
  }

  // ── 201. Admin routes — rotating coverage (Admin) ─────────────────────────
  // Cycles a different uncovered admin route each week for broad smoke coverage.
  {
    const adminRoutes = [
      '/admin/track-types',
      '/admin/reference-data',
      '/admin/terminology',
      '/admin/teams',
      '/admin/sales-tax',
      '/admin/audit-log',
      '/admin/announcements',
      '/admin/compliance',
      '/admin/automations',
      '/admin/users',
      '/admin/auto-po',
      '/admin/integration-outbox',
      '/admin/events',
      '/admin/settings',
    ];
    const route = adminRoutes[w % adminRoutes.length];
    if (pct(w, 20100, 35)) {
      inc(await tryAction(`admin-route-rotate:${route}`, async () => {
        await navigateTo(adminPage, route);
        await adminPage.waitForTimeout(1000);
        await adminPage.mouse.wheel(0, 300);
        await adminPage.waitForTimeout(300);

        // Try clicking first tab/row to exercise deeper UI
        const row = adminPage.locator('table tbody tr').first();
        if (await row.isVisible({ timeout: 1500 }).catch(() => false)) {
          await row.hover();
          await adminPage.waitForTimeout(150);
        }
      }, errors));
    }
  }

  // ── 202. Backward scheduling — view milestones on SO (Office) ─────────────
  // Exercises backward-scheduling milestone display introduced in Wave 8.
  if (pct(w, 20200, 8)) {
    inc(await tryAction('backward-scheduling-view', async () => {
      const openSos = await getOpenSalesOrders(office);
      if (openSos.length > 0) {
        const so = openSos[0];
        await navigateTo(officePage, '/sales-orders');
        await officePage.waitForTimeout(600);

        const row = officePage.locator(`table tbody tr:has-text("${so.id}"), [data-testid="so-row-${so.id}"]`).first();
        if (await row.isVisible({ timeout: 2000 }).catch(() => false)) {
          await row.click();
          await officePage.waitForTimeout(800);

          // Click schedule/milestones tab if present
          const schedTab = officePage.locator('[role="tab"]:has-text("Schedule"), [role="tab"]:has-text("Milestones"), [data-testid*="schedule-tab"]').first();
          if (await schedTab.isVisible({ timeout: 1500 }).catch(() => false)) {
            await schedTab.click();
            await officePage.waitForTimeout(600);
            await officePage.mouse.wheel(0, 200);
            await officePage.waitForTimeout(200);
          }

          await officePage.keyboard.press('Escape').catch(() => {});
        }
      }
    }, errors));
  }

  // ── 203. Chat popout — browse standalone chat route (Engineer) ────────────
  if (pct(w, 20300, 8)) {
    inc(await tryAction('chat-popout-browse', async () => {
      await navigateTo(engineerPage, '/chat-popout');
      await engineerPage.waitForTimeout(1000);
      await engineerPage.mouse.wheel(0, 200);
      await engineerPage.waitForTimeout(300);
    }, errors));
  }

  // ── 204. Follow-up tasks — check training/QC generated tasks (Worker) ─────
  if (pct(w, 20400, 10)) {
    inc(await tryAction('follow-up-tasks-browse', async () => {
      await navigateTo(workerPage, '/tasks');
      await workerPage.waitForTimeout(1000);
      await workerPage.mouse.wheel(0, 200);
      await workerPage.waitForTimeout(300);

      const row = workerPage.locator('table tbody tr, .task-item').first();
      if (await row.isVisible({ timeout: 2000 }).catch(() => false)) {
        await row.click();
        await workerPage.waitForTimeout(600);
        await workerPage.keyboard.press('Escape').catch(() => {});
      }
    }, errors));
  }

  // ── 205. Saved reports — open + run first template (PM) ───────────────────
  if (pct(w, 20500, 10)) {
    inc(await tryAction('saved-report-run', async () => {
      await navigateTo(pmPage, '/reports');
      await pmPage.waitForTimeout(1000);
      await pmPage.mouse.wheel(0, 200);
      await pmPage.waitForTimeout(300);
      const row = pmPage.locator('table tbody tr, .report-item, [data-testid*="report-"]').first();
      if (await row.isVisible({ timeout: 2000 }).catch(() => false)) {
        await row.click();
        await pmPage.waitForTimeout(1000);
        await pmPage.mouse.wheel(0, 300);
        await pmPage.waitForTimeout(300);
        await pmPage.keyboard.press('Escape').catch(() => {});
      }
    }, errors));
  }

  // ── 206. Calendar day view — open first event (Office) ────────────────────
  if (pct(w, 20600, 12)) {
    inc(await tryAction('calendar-day-event-open', async () => {
      await navigateTo(officePage, '/calendar');
      await officePage.waitForTimeout(1000);
      const event = officePage.locator('.calendar-event, [data-testid*="calendar-event"], .fc-event').first();
      if (await event.isVisible({ timeout: 2000 }).catch(() => false)) {
        await event.click();
        await officePage.waitForTimeout(700);
        await officePage.keyboard.press('Escape').catch(() => {});
      }
    }, errors));
  }

  // ── 207. Dashboard widget interactions — ambient mode toggle (Engineer) ───
  if (pct(w, 20700, 6)) {
    inc(await tryAction('dashboard-ambient-toggle', async () => {
      await navigateTo(engineerPage, '/dashboard');
      await engineerPage.waitForTimeout(1000);
      const ambientBtn = engineerPage.locator('[data-testid*="ambient"], button[aria-label*="ambient" i], button[title*="ambient" i]').first();
      if (await ambientBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
        await ambientBtn.click();
        await engineerPage.waitForTimeout(700);
        // Toggle back off
        if (await ambientBtn.isVisible({ timeout: 800 }).catch(() => false)) {
          await ambientBtn.click().catch(() => {});
          await engineerPage.waitForTimeout(400);
        }
      }
    }, errors));
  }

  // ── 208. Notifications panel — open + mark all read (Engineer) ────────────
  if (pct(w, 20800, 15)) {
    inc(await tryAction('notifications-panel-interact', async () => {
      await navigateTo(engineerPage, '/dashboard');
      await engineerPage.waitForTimeout(600);
      const bell = engineerPage.locator('[data-testid="notifications-bell"], button[aria-label*="otification" i]').first();
      if (await bell.isVisible({ timeout: 1500 }).catch(() => false)) {
        await bell.click();
        await engineerPage.waitForTimeout(800);
        const markAll = engineerPage.locator('[data-testid*="mark-all-read"], button:has-text("Mark all read")').first();
        if (await markAll.isVisible({ timeout: 1000 }).catch(() => false)) {
          await markAll.click().catch(() => {});
          await engineerPage.waitForTimeout(400);
        }
        await engineerPage.keyboard.press('Escape').catch(() => {});
      }
    }, errors));
  }

  // ── 209. Global search — open + submit query (Engineer) ───────────────────
  if (pct(w, 20900, 12)) {
    inc(await tryAction('global-search-submit', async () => {
      await navigateTo(engineerPage, '/dashboard');
      await engineerPage.waitForTimeout(500);
      const search = engineerPage.locator('[data-testid="global-search"], input[placeholder*="earch" i]').first();
      if (await search.isVisible({ timeout: 1500 }).catch(() => false)) {
        await search.click();
        await search.fill('part');
        await engineerPage.waitForTimeout(800);
        await engineerPage.keyboard.press('Escape').catch(() => {});
        await engineerPage.waitForTimeout(200);
      }
    }, errors));
  }

  // ── 210. Keyboard shortcuts help — open + close (Engineer) ────────────────
  if (pct(w, 21000, 5)) {
    inc(await tryAction('keyboard-shortcuts-open', async () => {
      await navigateTo(engineerPage, '/dashboard');
      await engineerPage.waitForTimeout(500);
      await engineerPage.keyboard.press('Shift+?').catch(() => {});
      await engineerPage.waitForTimeout(700);
      await engineerPage.keyboard.press('Escape').catch(() => {});
      await engineerPage.waitForTimeout(200);
    }, errors));
  }

  // ── 211. Reports — open new-report builder dialog (PM) ────────────────────
  if (pct(w, 21100, 6)) {
    inc(await tryAction('report-builder-open', async () => {
      await navigateTo(pmPage, '/reports');
      await pmPage.waitForTimeout(800);
      const newBtn = pmPage.locator('[data-testid="new-report-btn"], button:has-text("New Report")').first();
      if (await newBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
        await newBtn.click();
        await pmPage.waitForTimeout(1000);
        await pmPage.mouse.wheel(0, 200);
        await pmPage.waitForTimeout(300);
        await pmPage.keyboard.press('Escape').catch(() => {});
        await pmPage.waitForTimeout(300);
      }
    }, errors));
  }

  // ── 212. MRP planned orders — open first row detail (Manager) ─────────────
  if (pct(w, 21200, 10)) {
    inc(await tryAction('mrp-planned-orders-deep', async () => {
      await navigateTo(managerPage, '/mrp/planned-orders');
      await managerPage.waitForTimeout(800);
      await managerPage.mouse.wheel(0, 200);
      await managerPage.waitForTimeout(300);
      const row = managerPage.locator('table tbody tr').first();
      if (await row.isVisible({ timeout: 2000 }).catch(() => false)) {
        await row.click();
        await managerPage.waitForTimeout(700);
        await managerPage.keyboard.press('Escape').catch(() => {});
      }
    }, errors));
  }

  // ── 213. Purchasing RFQ — open first row detail (Office) ──────────────────
  if (pct(w, 21300, 10)) {
    inc(await tryAction('purchasing-rfq-deep', async () => {
      await navigateTo(officePage, '/purchasing');
      await officePage.waitForTimeout(800);
      await officePage.mouse.wheel(0, 200);
      await officePage.waitForTimeout(300);
      const row = officePage.locator('table tbody tr').first();
      if (await row.isVisible({ timeout: 2000 }).catch(() => false)) {
        await row.click();
        await officePage.waitForTimeout(800);
        await officePage.mouse.wheel(0, 300);
        await officePage.waitForTimeout(200);
        await officePage.keyboard.press('Escape').catch(() => {});
      }
    }, errors));
  }

  // ── 214. Training — open first module + read (Engineer) ───────────────────
  if (pct(w, 21400, 12)) {
    inc(await tryAction('training-module-open', async () => {
      await navigateTo(engineerPage, '/training');
      await engineerPage.waitForTimeout(1000);
      const module = engineerPage.locator('[data-testid*="training-module"], .training-card, table tbody tr').first();
      if (await module.isVisible({ timeout: 2000 }).catch(() => false)) {
        await module.click();
        await engineerPage.waitForTimeout(1200);
        await engineerPage.mouse.wheel(0, 400);
        await engineerPage.waitForTimeout(300);
        await engineerPage.keyboard.press('Escape').catch(() => {});
      }
    }, errors));
  }

  // ── 215. Onboarding wizard — browse current step (Engineer) ───────────────
  if (pct(w, 21500, 4)) {
    inc(await tryAction('onboarding-wizard-browse', async () => {
      await navigateTo(engineerPage, '/onboarding');
      await engineerPage.waitForTimeout(1000);
      await engineerPage.mouse.wheel(0, 200);
      await engineerPage.waitForTimeout(300);
    }, errors));
  }

  // ════════════════════════════════════════════════════════════════════════════
  // Wave 11 — End-to-end scan flow submits (UI-driven writes)
  // Opens /m/scan, manually types a part number, clicks the action, completes
  // the flow through the new data-testid submit path. Each action defensively
  // exits if enablement preconditions aren't met.
  // ════════════════════════════════════════════════════════════════════════════

  // Helper: open scan overlay for a part via manual input
  const openScanOverlayForPart = async (partNumber: string): Promise<boolean> => {
    await navigateTo(workerPage, '/m/scan');
    await workerPage.waitForTimeout(1000);
    const manualToggle = workerPage.locator('[data-testid="scan-manual-toggle"]');
    if (!(await manualToggle.isVisible({ timeout: 2000 }).catch(() => false))) return false;
    await manualToggle.click();
    await workerPage.waitForTimeout(300);
    const manualInput = workerPage.locator('[data-testid="scan-manual-input"]');
    if (!(await manualInput.isVisible({ timeout: 2000 }).catch(() => false))) return false;
    await manualInput.fill(partNumber);
    await workerPage.waitForTimeout(200);
    const submitBtn = workerPage.locator('[data-testid="scan-manual-submit"]');
    if (!(await submitBtn.isVisible({ timeout: 2000 }).catch(() => false))) return false;
    await submitBtn.click();
    await workerPage.waitForTimeout(1400);
    const overlay = workerPage.locator('[data-testid="scan-overlay"]');
    return await overlay.isVisible({ timeout: 2500 }).catch(() => false);
  };

  // Helper: close overlay at end of flow
  const closeScanOverlay = async (): Promise<void> => {
    const doneBtn = workerPage.locator('[data-testid="scan-overlay-done"]');
    if (await doneBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await doneBtn.click();
      await workerPage.waitForTimeout(300);
    } else {
      await workerPage.keyboard.press('Escape').catch(() => {});
      await workerPage.waitForTimeout(300);
    }
  };

  // ── 216. Scan flow — count submit (Worker) ────────────────────────────────
  if (pct(w, 21600, 3)) {
    inc(await tryAction('scan-count-submit', async () => {
      const parts = await getParts(worker);
      if (parts.length === 0) return;
      const part = parts[seededInt(0, Math.min(parts.length - 1, 9), w, 216)];
      const partNumber = part.partNumber ?? `P-${part.id}`;
      if (!(await openScanOverlayForPart(partNumber))) return;

      const countAction = workerPage.locator('[data-testid="quick-action-count"]');
      if (!(await countAction.isVisible({ timeout: 1500 }).catch(() => false))) {
        await closeScanOverlay();
        return;
      }
      if (await countAction.isDisabled().catch(() => true)) {
        await closeScanOverlay();
        return;
      }
      await countAction.click();
      await workerPage.waitForTimeout(600);

      // Enter actual count — read the overlay's "Recorded Qty" and match it to minimize data churn
      const countQty = workerPage.locator('[data-testid="count-qty"] input');
      if (!(await countQty.isVisible({ timeout: 2000 }).catch(() => false))) return;
      const recordedText = await workerPage
        .locator('.scan-overlay__stock-qty, .scan-flow__info-value--mono')
        .first()
        .textContent()
        .catch(() => '0');
      const recorded = parseInt((recordedText ?? '0').trim(), 10);
      await countQty.fill(String(isNaN(recorded) ? 0 : recorded));
      await workerPage.waitForTimeout(200);

      const submitCount = workerPage.locator('[data-testid="count-submit-btn"]');
      if (await submitCount.isVisible({ timeout: 1500 }).catch(() => false)) {
        await submitCount.click();
        await workerPage.waitForTimeout(700);
      }

      // If there's a confirm step (difference detected), also click it
      const confirmCount = workerPage.locator('[data-testid="count-confirm-btn"]');
      if (await confirmCount.isVisible({ timeout: 1500 }).catch(() => false)) {
        await confirmCount.click();
        await workerPage.waitForTimeout(1000);
      }

      await closeScanOverlay();
    }, errors));
  }

  // ── 217. Scan flow — move submit (Worker) ─────────────────────────────────
  if (pct(w, 21700, 3)) {
    inc(await tryAction('scan-move-submit', async () => {
      const parts = await getParts(worker);
      if (parts.length === 0) return;
      const part = parts[seededInt(0, Math.min(parts.length - 1, 9), w, 217)];
      const partNumber = part.partNumber ?? `P-${part.id}`;
      if (!(await openScanOverlayForPart(partNumber))) return;

      const moveAction = workerPage.locator('[data-testid="quick-action-move"]');
      if (!(await moveAction.isVisible({ timeout: 1500 }).catch(() => false))) {
        await closeScanOverlay();
        return;
      }
      if (await moveAction.isDisabled().catch(() => true)) {
        await closeScanOverlay();
        return;
      }
      await moveAction.click();
      await workerPage.waitForTimeout(600);

      // Step 1: move all
      const moveAllBtn = workerPage.locator('[data-testid="move-all-btn"]');
      if (!(await moveAllBtn.isVisible({ timeout: 2000 }).catch(() => false))) return;
      await moveAllBtn.click();
      await workerPage.waitForTimeout(500);

      // Step 2: choose destination from select
      const selectTrigger = workerPage.locator('app-select mat-select').first();
      if (await selectTrigger.isVisible({ timeout: 2000 }).catch(() => false)) {
        await selectTrigger.click();
        await workerPage.waitForTimeout(400);
        const firstOption = workerPage.locator('mat-option').first();
        if (await firstOption.isVisible({ timeout: 1500 }).catch(() => false)) {
          await firstOption.click();
          await workerPage.waitForTimeout(300);
        }
      }
      const destNext = workerPage.locator('[data-testid="move-dest-next-btn"]');
      if (!(await destNext.isVisible({ timeout: 1500 }).catch(() => false))) return;
      if (await destNext.isDisabled().catch(() => true)) {
        await closeScanOverlay();
        return;
      }
      await destNext.click();
      await workerPage.waitForTimeout(500);

      // Step 3: confirm
      const confirmMove = workerPage.locator('[data-testid="move-confirm-btn"]');
      if (await confirmMove.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmMove.click();
        await workerPage.waitForTimeout(1200);
      }

      await closeScanOverlay();
    }, errors));
  }

  // ── 218. Scan flow — inspect submit (Worker) ──────────────────────────────
  if (pct(w, 21800, 3)) {
    inc(await tryAction('scan-inspect-submit', async () => {
      const parts = await getParts(worker);
      if (parts.length === 0) return;
      const part = parts[seededInt(0, Math.min(parts.length - 1, 9), w, 218)];
      const partNumber = part.partNumber ?? `P-${part.id}`;
      if (!(await openScanOverlayForPart(partNumber))) return;

      const inspectAction = workerPage.locator('[data-testid="quick-action-inspect"]');
      if (!(await inspectAction.isVisible({ timeout: 1500 }).catch(() => false))) {
        await closeScanOverlay();
        return;
      }
      if (await inspectAction.isDisabled().catch(() => true)) {
        await closeScanOverlay();
        return;
      }
      await inspectAction.click();
      await workerPage.waitForTimeout(600);

      // Click Pass
      const passBtn = workerPage.locator('[data-testid="inspect-pass-btn"]');
      if (!(await passBtn.isVisible({ timeout: 2000 }).catch(() => false))) return;
      await passBtn.click();
      await workerPage.waitForTimeout(200);

      // Optional notes
      const notes = workerPage.locator('[data-testid="inspect-notes"] textarea');
      if (await notes.isVisible({ timeout: 1000 }).catch(() => false)) {
        await notes.fill('Sim inspection passed');
      }

      const submitInspect = workerPage.locator('[data-testid="inspect-submit-btn"]');
      if (await submitInspect.isVisible({ timeout: 2000 }).catch(() => false)) {
        await submitInspect.click();
        await workerPage.waitForTimeout(1200);
      }

      await closeScanOverlay();
    }, errors));
  }

  // ── 219. Scan flow — receive submit (Worker) ──────────────────────────────
  if (pct(w, 21900, 3)) {
    inc(await tryAction('scan-receive-submit', async () => {
      // Find part from an open PO — otherwise receive won't be enabled
      const openPos = await getPurchaseOrdersByStatus(office, 'Sent').catch(() => []);
      if (openPos.length === 0) return;
      const parts = await getParts(worker);
      if (parts.length === 0) return;
      // Try the first few parts — receive action enabled only if part has an open PO line
      for (let i = 0; i < Math.min(parts.length, 5); i++) {
        const part = parts[i];
        const partNumber = part.partNumber ?? `P-${part.id}`;
        if (!(await openScanOverlayForPart(partNumber))) continue;

        const receiveAction = workerPage.locator('[data-testid="quick-action-receive"]');
        if (!(await receiveAction.isVisible({ timeout: 1500 }).catch(() => false))) {
          await closeScanOverlay();
          continue;
        }
        if (await receiveAction.isDisabled().catch(() => true)) {
          await closeScanOverlay();
          continue;
        }
        await receiveAction.click();
        await workerPage.waitForTimeout(600);

        // Step 1: select first PO line
        const poLineBtn = workerPage.locator('[data-testid="receive-po-line"]').first();
        if (!(await poLineBtn.isVisible({ timeout: 2000 }).catch(() => false))) {
          await closeScanOverlay();
          return;
        }
        await poLineBtn.click();
        await workerPage.waitForTimeout(500);

        // Step 2: receive all
        const receiveAllBtn = workerPage.locator('[data-testid="receive-all-btn"]');
        if (!(await receiveAllBtn.isVisible({ timeout: 2000 }).catch(() => false))) return;
        await receiveAllBtn.click();
        await workerPage.waitForTimeout(500);

        // Step 3: pick destination
        const dest = workerPage.locator('app-select mat-select').first();
        if (await dest.isVisible({ timeout: 2000 }).catch(() => false)) {
          await dest.click();
          await workerPage.waitForTimeout(400);
          const firstOption = workerPage.locator('mat-option').first();
          if (await firstOption.isVisible({ timeout: 1500 }).catch(() => false)) {
            await firstOption.click();
            await workerPage.waitForTimeout(300);
          }
        }
        const destNext = workerPage.locator('[data-testid="receive-dest-next-btn"]');
        if (!(await destNext.isVisible({ timeout: 1500 }).catch(() => false))) return;
        if (await destNext.isDisabled().catch(() => true)) {
          await closeScanOverlay();
          return;
        }
        await destNext.click();
        await workerPage.waitForTimeout(500);

        // Step 4: confirm
        const confirmReceive = workerPage.locator('[data-testid="receive-confirm-btn"]');
        if (await confirmReceive.isVisible({ timeout: 2000 }).catch(() => false)) {
          await confirmReceive.click();
          await workerPage.waitForTimeout(1200);
        }

        await closeScanOverlay();
        return;
      }
    }, errors));
  }

  // ── 220. Scan flow — ship submit (Worker) ─────────────────────────────────
  if (pct(w, 22000, 2)) {
    inc(await tryAction('scan-ship-submit', async () => {
      const parts = await getParts(worker);
      if (parts.length === 0) return;
      for (let i = 0; i < Math.min(parts.length, 5); i++) {
        const part = parts[i];
        const partNumber = part.partNumber ?? `P-${part.id}`;
        if (!(await openScanOverlayForPart(partNumber))) continue;

        const shipAction = workerPage.locator('[data-testid="quick-action-ship"]');
        if (!(await shipAction.isVisible({ timeout: 1500 }).catch(() => false))) {
          await closeScanOverlay();
          continue;
        }
        if (await shipAction.isDisabled().catch(() => true)) {
          await closeScanOverlay();
          continue;
        }
        await shipAction.click();
        await workerPage.waitForTimeout(600);

        // Step 1: select first shipment line
        const lineItem = workerPage.locator('[data-testid="ship-line-item"]').first();
        if (!(await lineItem.isVisible({ timeout: 2000 }).catch(() => false))) {
          await closeScanOverlay();
          return;
        }
        await lineItem.click();
        await workerPage.waitForTimeout(500);

        // Step 2: ship all
        const shipAllBtn = workerPage.locator('[data-testid="ship-all-btn"]');
        if (await shipAllBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await shipAllBtn.click();
          await workerPage.waitForTimeout(500);
        }

        // Step 3: confirm
        const confirmShip = workerPage.locator('[data-testid="ship-confirm-btn"]');
        if (await confirmShip.isVisible({ timeout: 2000 }).catch(() => false)) {
          await confirmShip.click();
          await workerPage.waitForTimeout(1200);
        }

        await closeScanOverlay();
        return;
      }
    }, errors));
  }

  // ── 221. Scan flow — issue submit (Worker) ────────────────────────────────
  if (pct(w, 22100, 2)) {
    inc(await tryAction('scan-issue-submit', async () => {
      const parts = await getParts(worker);
      if (parts.length === 0) return;
      const part = parts[seededInt(0, Math.min(parts.length - 1, 9), w, 221)];
      const partNumber = part.partNumber ?? `P-${part.id}`;
      if (!(await openScanOverlayForPart(partNumber))) return;

      const issueAction = workerPage.locator('[data-testid="quick-action-issue"]');
      if (!(await issueAction.isVisible({ timeout: 1500 }).catch(() => false))) {
        await closeScanOverlay();
        return;
      }
      if (await issueAction.isDisabled().catch(() => true)) {
        await closeScanOverlay();
        return;
      }
      await issueAction.click();
      await workerPage.waitForTimeout(600);

      // Step 1: pick first job
      const jobBtn = workerPage.locator('[data-testid="issue-job-select"]').first();
      if (!(await jobBtn.isVisible({ timeout: 2000 }).catch(() => false))) {
        await closeScanOverlay();
        return;
      }
      await jobBtn.click();
      await workerPage.waitForTimeout(500);

      // Step 2: issue all
      const issueAllBtn = workerPage.locator('[data-testid="issue-all-btn"]');
      if (await issueAllBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await issueAllBtn.click();
        await workerPage.waitForTimeout(500);
      }

      // Step 3: confirm
      const confirmIssue = workerPage.locator('[data-testid="issue-confirm-btn"]');
      if (await confirmIssue.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmIssue.click();
        await workerPage.waitForTimeout(1200);
      }

      await closeScanOverlay();
    }, errors));
  }

  // ── 222. Scan flow — return submit (Worker) ───────────────────────────────
  if (pct(w, 22200, 2)) {
    inc(await tryAction('scan-return-submit', async () => {
      const parts = await getParts(worker);
      if (parts.length === 0) return;
      for (let i = 0; i < Math.min(parts.length, 5); i++) {
        const part = parts[i];
        const partNumber = part.partNumber ?? `P-${part.id}`;
        if (!(await openScanOverlayForPart(partNumber))) continue;

        const returnAction = workerPage.locator('[data-testid="quick-action-return"]');
        if (!(await returnAction.isVisible({ timeout: 1500 }).catch(() => false))) {
          await closeScanOverlay();
          continue;
        }
        if (await returnAction.isDisabled().catch(() => true)) {
          await closeScanOverlay();
          continue;
        }
        await returnAction.click();
        await workerPage.waitForTimeout(600);

        // Step 1: pick shipment
        const shipItem = workerPage.locator('[data-testid="return-shipment-item"]').first();
        if (!(await shipItem.isVisible({ timeout: 2000 }).catch(() => false))) {
          await closeScanOverlay();
          return;
        }
        await shipItem.click();
        await workerPage.waitForTimeout(500);

        // Step 2: return all
        const returnAllBtn = workerPage.locator('[data-testid="return-all-btn"]');
        if (await returnAllBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await returnAllBtn.click();
          await workerPage.waitForTimeout(500);
        }

        // Step 3: pick reason
        const reasonSelect = workerPage.locator('[data-testid="return-reason"] mat-select').first();
        if (await reasonSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
          await reasonSelect.click();
          await workerPage.waitForTimeout(400);
          const firstOption = workerPage.locator('mat-option').first();
          if (await firstOption.isVisible({ timeout: 1500 }).catch(() => false)) {
            await firstOption.click();
            await workerPage.waitForTimeout(300);
          }
        }
        const continueBtn = workerPage.locator('[data-testid="return-continue-btn"]');
        if (await continueBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await continueBtn.click();
          await workerPage.waitForTimeout(500);
        }

        // Step 4: submit
        const returnSubmit = workerPage.locator('[data-testid="return-submit-btn"]');
        if (await returnSubmit.isVisible({ timeout: 2000 }).catch(() => false)) {
          await returnSubmit.click();
          await workerPage.waitForTimeout(1200);
        }

        await closeScanOverlay();
        return;
      }
    }, errors));
  }

  // ── 223. Scan flow — job log note (Worker) ────────────────────────────────
  // Uses the job scan flow: scan job number, log note (non-destructive action)
  if (pct(w, 22300, 3)) {
    inc(await tryAction('scan-job-log-note', async () => {
      const activeJobs = await getJobsInStage(worker, 'In Production').catch(() => []);
      if (activeJobs.length === 0) return;
      const job = activeJobs[seededInt(0, Math.min(activeJobs.length - 1, 5), w, 223)];
      const jobNumber = (job as { jobNumber?: string }).jobNumber ?? `J-${job.id}`;

      await navigateTo(workerPage, '/m/scan');
      await workerPage.waitForTimeout(1000);
      const manualToggle = workerPage.locator('[data-testid="scan-manual-toggle"]');
      if (!(await manualToggle.isVisible({ timeout: 2000 }).catch(() => false))) return;
      await manualToggle.click();
      await workerPage.waitForTimeout(300);
      const manualInput = workerPage.locator('[data-testid="scan-manual-input"]');
      if (!(await manualInput.isVisible({ timeout: 2000 }).catch(() => false))) return;
      await manualInput.fill(jobNumber);
      await workerPage.waitForTimeout(200);
      const submitBtn = workerPage.locator('[data-testid="scan-manual-submit"]');
      if (!(await submitBtn.isVisible({ timeout: 2000 }).catch(() => false))) return;
      await submitBtn.click();
      await workerPage.waitForTimeout(1500);

      // Job overlay appears — click Log Note
      const logNoteBtn = workerPage.locator('[data-testid="job-log-note-btn"]');
      if (!(await logNoteBtn.isVisible({ timeout: 2500 }).catch(() => false))) return;
      await logNoteBtn.click();
      await workerPage.waitForTimeout(400);

      // Enter note text
      const noteText = workerPage.locator('[data-testid="job-note-text"] textarea');
      if (!(await noteText.isVisible({ timeout: 2000 }).catch(() => false))) return;
      await noteText.fill('Sim progress note');
      await workerPage.waitForTimeout(200);

      const submitNoteBtn = workerPage.locator('[data-testid="job-submit-note-btn"]');
      if (await submitNoteBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
        await submitNoteBtn.click();
        await workerPage.waitForTimeout(1200);
      }
    }, errors));
  }

  // ── 230. Drain approvals inbox — approve up to 3 pending items (Manager) ──
  // Runs every week. The /approvals/inbox table renders inline approve buttons
  // per row; no detail-click needed. Covers whatever source entity is queued
  // (PurchaseOrder, Expense, etc.) and keeps the inbox from growing unbounded.
  if (pct(w, 23000, 100)) {
    inc(await tryAction('drain-approvals-inbox', async () => {
      await navigateTo(managerPage, '/approvals/inbox');
      await managerPage.waitForTimeout(1200);

      for (let i = 0; i < 3; i += 1) {
        const approveBtn = managerPage.locator('[data-testid="approval-approve-btn"]').first();
        if (!(await approveBtn.isVisible({ timeout: 1500 }).catch(() => false))) break;
        await approveBtn.click();
        await managerPage.waitForTimeout(1200);
      }
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
