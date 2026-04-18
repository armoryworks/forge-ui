/**
 * Comprehensive UI-driven week simulation — ALL operations via Playwright UI.
 *
 * ARCHITECTURE:
 *   - Entity state queries (getOpenLeads, etc.) use API tokens (read-only, decision-making)
 *   - ALL create / update / advance / delete actions go through the Angular UI
 *   - Clock control (setSimulatedClock) stays as API — no UI equivalent
 *   - Every action wrapped in tryAction — failures logged, never thrown
 *
 * ENTITY COVERAGE (~45 sections):
 *   Leads, Customers, Contacts, Quotes, Sales Orders, Jobs, Parts, BOMs,
 *   Vendors, Purchase Orders, Receiving, Inventory, Expenses, Time Tracking,
 *   Assets, Shipments, Invoices, Payments, QC Inspections, Lots,
 *   Customer Returns, Events, Chat (with entity mentions),
 *   Entity Activity/Conversation (on all entity types)
 *
 * SUPPLY CHAIN FLOW:
 *   Customer needs product → Create manufactured part + BOM →
 *   PO for raw materials → Receive materials → Create production job →
 *   Job advances through stages → QC inspection → Ship → Invoice → Payment
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
} from '../data/scenario-data';
import {
  getOpenLeads, getCustomers, getDraftQuotes, getSentQuotes,
  getAcceptedQuotes, getActiveJobs, getDefaultTrackType, getNextStage,
  getUninvoicedJobs, getEngineers, getTrackTypes,
  getParts, getVendors, getAssets, getStorageLocations,
  getSentInvoices, getShippableSalesOrders, getSalesOrderDetail,
  getQcTemplates, getLots, getOpenReturns, getAllUsers,
  getCustomerContacts, getPurchaseOrdersByStatus, getAllPurchaseOrders,
  getOpenSalesOrders, getOpenInvoices, getAllInvoices,
} from '../helpers/entity-query.helper';
import {
  navigateTo, fillInput, fillTextarea, fillMatSelect, fillDatepicker,
  fillAutocomplete, fillRichText, clickButton,
  waitForDialog, waitForDialogClosed,
  clickRowContaining, toDisplayDate,
} from '../helpers/ui-actions.helper';

// ── helpers ──────────────────────────────────────────────────────────────────

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
        await fillMatSelect(engineerPage, 'part-type', 'Manufactured');
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
      await fillMatSelect(engineerPage, 'part-type', 'RawMaterial');
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
      await fillMatSelect(engineerPage, 'part-type', 'Manufactured');
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
  // Uses the kanban board drag-and-drop or job detail stage change
  const trackTypes = await getTrackTypes(engineer);
  const jobsToAdvance = activeJobs.filter((_, idx) => pct(w, idx + 150, 35)).slice(0, 3);

  for (const job of jobsToAdvance) {
    const tt = trackTypes.find(t => t.id === job.trackTypeId);
    if (!tt) continue;
    const nextStage = getNextStage(tt, job.currentStageId);
    if (!nextStage) continue;

    // Stage advancement via API — no single-click UI button exists for this;
    // kanban drag is fragile in headless mode. The API PATCH is the standard
    // programmatic interface used by the kanban DnD handler.
    inc(await tryAction(`advance-job-${job.id}`, async () => {
      await apiCall('PATCH', `jobs/${job.id}/stage`, engineer, {
        stageId: nextStage.id,
      });
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
    }, errors));
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

  return {
    weekLabel: ctx.weekLabel,
    weekStart: ctx.weekStart.toISOString(),
    actionsAttempted: attempted,
    actionsSucceeded: succeeded,
    errors,
    durationMs: 0, // set by runner
  };
}
