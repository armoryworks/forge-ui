/**
 * API-direct week scenario — fast, reliable backfill for historical data.
 *
 * Uses direct POST calls instead of UI automation for speed and reliability.
 * Every action is wrapped in tryAction — failures logged, never thrown.
 *
 * Entity pipeline per week:
 *   1. Create leads (1-3)
 *   2. Advance existing leads (New → Contacted → Qualified)
 *   3. Convert qualified leads → customers
 *   4. Create quotes with line items
 *   5. Send draft quotes, accept sent quotes
 *   6. Convert accepted quotes → sales orders
 *   7. Create jobs on kanban board
 *   8. Move jobs forward through stages
 *   9. Log time entries against jobs
 *   10. Clock in/out events
 *   11. Submit + approve expenses
 *   12. Create purchase orders
 *   13. Create shipments from fulfilled SOs
 *   14. Create invoices from shipped jobs
 *   15. Record payments against invoices
 *   16. Create shop assets (machines, tooling, vehicles)
 *   17. Set up maintenance schedules on assets
 *   18. Log maintenance performed + machine hours
 *   19. Log unplanned downtime events
 *   20. Create maintenance jobs from overdue schedules
 *   21. Dispose completed jobs (ship, scrap, inventory, capitalize)
 *   22. QC inspections on in-progress/QC-stage jobs
 *
 * Expanded coverage (26-35) — broadens the training corpus:
 *   26. Standalone parts + BOM (Make parent ← Buy child)
 *   27. Vendors (grow the supplier list)
 *   28. Inventory: storage locations, stock receipts, lot records, movements
 *   29. Purchase order lifecycle: submit → acknowledge → receive into bins
 *   30. Compliance calendar: events + attendees + RSVP
 *   31. Entity comments + notes (jobs / parts / customers)
 *   32. Direct chat messages between the workforce
 *   33. File attachments (drawings/docs on jobs, parts, assets)
 *   34. AI / RAG: index entities + semantic search (document_embeddings)
 *   35. Watchtower: apply/dismiss regulatory proposals (inert until seeded)
 */

import type { WeekContext, WeekResult } from '../types/simulation.types';
import { tryAction, type SimError } from '../helpers/sim-context.helper';
import { apiCall, apiUpload, fixturePdf } from '../helpers/api.helper';
import {
  pick, seededInt,
  COMPANIES, CONTACT_FIRST, CONTACT_LAST,
  LEAD_SOURCES, LEAD_NOTES,
  JOB_TITLES, QUOTE_LINE_DESCRIPTIONS,
  EXPENSE_CATEGORIES, EXPENSE_DESCRIPTIONS,
  JOB_COMMENTS,
  ASSET_NAMES, MAINTENANCE_TITLES, DOWNTIME_REASONS, DOWNTIME_RESOLUTIONS,
  SCRAP_REASONS,
  PART_NAMES, VENDOR_NAMES, RAW_MATERIALS, PURCHASED_COMPONENTS,
  STORAGE_LOCATION_NAMES, EVENT_TITLES, EVENT_LOCATIONS,
  ENTITY_COMMENTS, CHAT_MESSAGES_GENERAL, CHAT_MESSAGES_JOB,
} from '../data/scenario-data';

// ── helpers ──────────────────────────────────────────────────────────────────

/** ISO datetime for a given day offset from weekStart */
function weekDay(ctx: WeekContext, offsetDays = 0): string {
  const d = new Date(ctx.weekStart);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString();
}

/** true with probability p/100 seeded by weekIndex + salt */
function pct(weekIndex: number, salt: number, p: number): boolean {
  return ((weekIndex * 31 + salt * 17) % 100) < p;
}

/**
 * Normalize API responses — the list endpoints are inconsistent: some return a
 * plain array (leads, quotes, orders, expenses), some `{ data: [...] }`, and the
 * paged ones (jobs, customers, vendors, parts) return
 * `{ items, totalCount, page, pageSize }`. This always returns the array —
 * checking `data` AND `items` is essential: without the `items` branch the whole
 * job / customer / vendor / part pipeline silently resolves to empty.
 */
function asList<T>(resp: unknown): T[] {
  if (!resp) return [];
  if (Array.isArray(resp)) return resp as T[];
  if (typeof resp === 'object') {
    const obj = resp as Record<string, unknown>;
    if (Array.isArray(obj['data'])) return obj['data'] as T[];
    if (Array.isArray(obj['items'])) return obj['items'] as T[];
  }
  return [];
}

// ── main ─────────────────────────────────────────────────────────────────────

export async function runWeekApi(ctx: WeekContext): Promise<WeekResult> {
  const errors: SimError[] = [];
  let attempted = 0;
  let succeeded = 0;
  const inc = (ok: boolean) => { attempted++; if (ok) succeeded++; };

  // Tokens
  const admin    = ctx.tokens['admin@forge.local'];
  const pm       = ctx.tokens['pmorris@forge.local'];
  const engineer = ctx.tokens['akim@forge.local'];
  const manager  = ctx.tokens['lwilson@forge.local'];
  const office   = ctx.tokens['cthompson@forge.local'];
  const worker   = ctx.tokens['bkelly@forge.local'];
  const w = ctx.weekIndex;

  // ── 1. Create leads ────────────────────────────────────────────────────────
  const newLeadCount = seededInt(1, 3, w, 0);
  for (let i = 0; i < newLeadCount; i++) {
    const company = pick(COMPANIES, w, i);
    const first   = pick(CONTACT_FIRST, w, i + 1);
    const last    = pick(CONTACT_LAST, w, i + 2);
    const source  = pick(LEAD_SOURCES, w, i);
    const notes   = pick(LEAD_NOTES, w, i + 3);
    const email   = `${first.toLowerCase()}.${last.toLowerCase()}@${company.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`;
    const phone   = `(555) ${String(100 + (w % 900)).padStart(3, '0')}-${String(1000 + (i * 111 + w) % 9000).padStart(4, '0')}`;

    inc(await tryAction(`lead-${i}`, async () => {
      const result = await apiCall('POST', 'leads', pm, {
        companyName: company,
        contactName: `${first} ${last}`,
        email,
        phone,
        source,
        notes,
        followUpDate: weekDay(ctx, 5 + i),
      });
      if (!result) throw new Error('Lead creation returned null');
    }, errors));
  }

  // ── 2. Advance open leads ──────────────────────────────────────────────────
  const leadsResp = await apiCall<unknown>('GET', 'leads?pageSize=500', pm);
  const allLeads = asList<{ id: number; status: string; companyName: string }>(leadsResp);
  const openLeads = allLeads.filter(l => l.status !== 'Converted' && l.status !== 'Lost');

  const advanceable = openLeads.filter(l => l.status === 'New' || l.status === 'Contacted');
  for (const lead of advanceable.filter((_, idx) => pct(w, idx + 10, 35)).slice(0, 3)) {
    const newStatus = lead.status === 'New' ? 'Contacted' : 'Quoting';
    inc(await tryAction(`advance-lead-${lead.id}`, async () => {
      const result = await apiCall('PATCH', `leads/${lead.id}`, pm, { status: newStatus });
      if (!result) throw new Error(`Lead ${lead.id} advance failed`);
    }, errors));
  }

  // ── 3. Convert quoting leads → customers ────────────────────────────────────
  const qualifiedLeads = openLeads.filter(l => l.status === 'Quoting');
  for (const lead of qualifiedLeads.filter((_, idx) => pct(w, idx + 20, 30)).slice(0, 1)) {
    inc(await tryAction(`convert-lead-${lead.id}`, async () => {
      const result = await apiCall('POST', `leads/${lead.id}/convert`, pm, {});
      if (!result) throw new Error(`Lead ${lead.id} conversion failed`);
    }, errors));
  }

  // ── 4. Create quotes ───────────────────────────────────────────────────────
  const customers = asList<{ id: number; name: string }>(
    await apiCall<unknown>('GET', 'customers?pageSize=100', pm),
  );
  const parts = asList<{ id: number; partNumber: string; description: string }>(
    await apiCall<unknown>('GET', 'parts?pageSize=100', pm),
  );

  if (customers.length > 0) {
    const quotesToCreate = seededInt(1, 2, w, 4);
    for (let i = 0; i < quotesToCreate; i++) {
      const customer = customers[(w + i) % customers.length];
      const lineCount = seededInt(1, 3, w, i + 30);
      const lines = [];
      for (let li = 0; li < lineCount; li++) {
        const part = parts.length > 0 ? parts[(w + i + li) % parts.length] : null;
        lines.push({
          partId: part?.id ?? null,
          description: pick(QUOTE_LINE_DESCRIPTIONS, w, i + li + 30),
          quantity: seededInt(10, 200, w, i + li + 40),
          unitPrice: seededInt(5, 85, w, i + li + 50),
          notes: null,
        });
      }

      inc(await tryAction(`quote-${i}`, async () => {
        const result = await apiCall('POST', 'quotes', pm, {
          customerId: customer.id,
          expirationDate: weekDay(ctx, 30),
          notes: `Simulation quote for ${ctx.weekLabel}`,
          taxRate: 0,
          lines,
        });
        if (!result) throw new Error('Quote creation returned null');
      }, errors));
    }
  }

  // ── 5. Send draft quotes ───────────────────────────────────────────────────
  // Fetch after creation so newly-created drafts are included.
  const quotesForSend = asList<{ id: number; status: string }>(
    await apiCall<unknown>('GET', 'quotes?pageSize=200', pm),
  ).filter(q => q.status === 'Draft');
  for (const quote of quotesForSend.filter((_, idx) => pct(w, idx + 60, 60)).slice(0, 3)) {
    inc(await tryAction(`send-quote-${quote.id}`, async () => {
      const result = await apiCall('POST', `quotes/${quote.id}/send`, pm, {});
      if (!result) throw new Error(`Quote ${quote.id} send failed`);
    }, errors));
  }

  // ── 6. Accept sent quotes ──────────────────────────────────────────────────
  // Re-fetch after sends
  const quotesForAccept = asList<{ id: number; status: string }>(
    await apiCall<unknown>('GET', 'quotes?pageSize=200', manager),
  );
  const sentQuotes = quotesForAccept.filter(q => q.status === 'Sent');
  for (const quote of sentQuotes.filter((_, idx) => pct(w, idx + 70, 50)).slice(0, 2)) {
    inc(await tryAction(`accept-quote-${quote.id}`, async () => {
      const result = await apiCall('POST', `quotes/${quote.id}/accept`, manager, {});
      if (!result) throw new Error(`Quote ${quote.id} accept failed`);
    }, errors));
  }

  // ── 7. Convert accepted quotes → sales orders ─────────────────────────────
  // Re-fetch after accepts. A converted quote KEEPS status 'Accepted' (the list
  // has no converted flag), so we fetch detail and skip any that already carry a
  // salesOrderId — otherwise the same seed quotes 409 ("already converted") every
  // week. Convert up to 2 genuinely-unconverted quotes.
  const quotesForConvert = asList<{ id: number; status: string }>(
    await apiCall<unknown>('GET', 'quotes?pageSize=200', office),
  );
  const acceptedQuotes = quotesForConvert.filter(q => q.status === 'Accepted');
  let convertedThisWeek = 0;
  for (const quote of acceptedQuotes) {
    if (convertedThisWeek >= 2) break;
    const detail = await apiCall<{ salesOrderId: number | null }>('GET', `quotes/${quote.id}`, office);
    if (detail?.salesOrderId) continue; // already converted in a prior week/run
    const ok = await tryAction(`convert-quote-${quote.id}`, async () => {
      const result = await apiCall('POST', `quotes/${quote.id}/convert`, office, {});
      if (!result) throw new Error(`Quote ${quote.id} convert failed`);
    }, errors);
    inc(ok);
    if (ok) convertedThisWeek++;
  }

  // ── 7b. Confirm draft sales orders ──────────────────────────────────────────
  const draftSOs = asList<{ id: number; status: string }>(
    await apiCall<unknown>('GET', 'orders?pageSize=200', office),
  ).filter(so => so.status === 'Draft');
  for (const so of draftSOs.slice(0, 5)) {
    inc(await tryAction(`confirm-so-${so.id}`, async () => {
      await apiCall('POST', `orders/${so.id}/confirm`, office, {});
    }, errors));
  }

  // ── 8. Create jobs ─────────────────────────────────────────────────────────
  const trackTypesResp = await apiCall<Array<{ id: number; name: string; isDefault: boolean; stages: Array<{ id: number; name: string; sortOrder: number }> }>>(
    'GET', 'track-types', manager,
  );
  const trackTypes = trackTypesResp ?? [];
  const defaultTrack = trackTypes.find(t => t.isDefault) ?? trackTypes[0];

  const allUsers = asList<{ id: number; email: string; firstName: string; lastName: string; roles: string[] }>(
    await apiCall<unknown>('GET', 'admin/users?pageSize=50', admin),
  );

  if (defaultTrack) {
    const jobCount = seededInt(1, 2, w, 5);
    for (let i = 0; i < jobCount; i++) {
      const customer = customers.length > 0 ? customers[(w + i) % customers.length] : null;
      const title = pick(JOB_TITLES, w, i + 10).replace('{customer}', customer?.name ?? 'Internal');
      // Skip assignee — compliance docs may not be complete for seeded users
      const priorities = ['Low', 'Normal', 'High', 'Urgent'];
      const priority = pick(priorities, w, i + 15);

      inc(await tryAction(`job-${i}`, async () => {
        const result = await apiCall('POST', 'jobs', manager, {
          title,
          description: `Production run for ${ctx.weekLabel}`,
          trackTypeId: defaultTrack.id,
          customerId: customer?.id ?? null,
          priority,
          dueDate: weekDay(ctx, 14 + seededInt(0, 14, w, i + 20)),
        });
        if (!result) throw new Error('Job creation returned null');
      }, errors));
    }
  }

  // ── 9. Move jobs forward through stages ────────────────────────────────────
  // List endpoint returns stageName (not currentStageId), so match by name
  const allJobs = asList<{ id: number; jobNumber: string; stageName: string }>(
    await apiCall<unknown>('GET', 'jobs?pageSize=2000', manager),
  );

  if (defaultTrack) {
    const sortedStages = [...defaultTrack.stages].sort((a, b) => a.sortOrder - b.sortOrder);
    const lastStageName = sortedStages[sortedStages.length - 1]?.name;
    // Advance jobs not at the final stage — rotate through different offsets each week
    const notAtFinal = allJobs.filter(j => j.stageName && j.stageName !== lastStageName);
    // Rotate start offset by week to ensure different jobs get picked
    const startOffset = (w * 7) % Math.max(notAtFinal.length, 1);
    const rotated = [...notAtFinal.slice(startOffset), ...notAtFinal.slice(0, startOffset)];
    const jobsToAdvance = rotated.slice(0, 20);

    for (const job of jobsToAdvance) {
      const stageIdx = sortedStages.findIndex(s => s.name === job.stageName);
      // Advance 1-3 stages per week for faster progression through the pipeline
      const stepsToAdvance = pct(w, job.id + 90, 30) ? 3 : pct(w, job.id + 90, 60) ? 2 : 1;
      let currentIdx = stageIdx;

      for (let step = 0; step < stepsToAdvance; step++) {
        if (currentIdx >= 0 && currentIdx < sortedStages.length - 1) {
          const nextStage = sortedStages[currentIdx + 1];
          const ok = await tryAction(`move-job-${job.id}-step${step}`, async () => {
            const result = await apiCall('PATCH', `jobs/${job.id}/stage`, manager, {
              jobId: job.id,
              stageId: nextStage.id,
            });
            if (!result) throw new Error(`Job ${job.id} stage move failed`);
          }, errors);
          inc(ok);
          if (ok) currentIdx++;
          else break;
        }
      }
    }
  }

  // ── 10. Log time entries ───────────────────────────────────────────────────
  const jobsForTime = allJobs.slice(0, 5);
  for (let i = 0; i < jobsForTime.length; i++) {
    const token = i % 2 === 0 ? engineer : worker;
    const dayOffset = i % 5;
    const hours = seededInt(1, 6, w, i + 100);
    const minutes = [0, 15, 30, 45][(w + i) % 4];
    const dateStr = weekDay(ctx, dayOffset).slice(0, 10); // YYYY-MM-DD for DateOnly

    inc(await tryAction(`time-${i}`, async () => {
      const result = await apiCall('POST', 'time-tracking/entries', token, {
        jobId: jobsForTime[i].id,
        date: dateStr,
        durationMinutes: hours * 60 + minutes,
        category: 'Production',
        notes: `Week ${ctx.weekLabel} - ${pick(JOB_COMMENTS, w, i).slice(0, 60)}`,
      });
      if (!result) throw new Error('Time entry creation returned null');
    }, errors));
  }

  // ── 11. Clock in/out ───────────────────────────────────────────────────────
  for (const token of [engineer, worker]) {
    inc(await tryAction('clock-in', async () => {
      await apiCall('POST', 'time-tracking/clock-events', token, {
        eventTypeCode: 'ClockIn', reason: null, scanMethod: 'Manual', source: 'Simulation',
      });
    }, errors));
    inc(await tryAction('clock-out', async () => {
      await apiCall('POST', 'time-tracking/clock-events', token, {
        eventTypeCode: 'ClockOut', reason: null, scanMethod: 'Manual', source: 'Simulation',
      });
    }, errors));
  }

  // ── 12. Expenses ───────────────────────────────────────────────────────────
  // Policy (expense_require_receipt) requires a receipt attachment: stage the
  // receipt via POST /expenses/receipts (uploads with EntityId=0), then pass its
  // id as receiptFileId — CreateExpense re-parents the file onto the new row.
  // NOTE: the request field is `expenseDate` (not `date`), and Description must be
  // >= 10 chars — both were silently wrong/defaulted before.
  const expenseCount = seededInt(1, 3, w, 6);
  for (let i = 0; i < expenseCount; i++) {
    const token = i === 0 ? engineer : worker;
    const category = pick(EXPENSE_CATEGORIES, w, i + 50);
    let desc = pick(EXPENSE_DESCRIPTIONS, w, i + 55).replace('{q}', `${Math.ceil((ctx.weekStart.getUTCMonth() + 1) / 3)}`);
    if (desc.length < 10) desc = `${desc} — shop expense`;
    const amount = seededInt(15, 350, w, i + 60);

    inc(await tryAction(`expense-${i}`, async () => {
      const receipt = await apiUpload<{ id: number }>(
        'expenses/receipts', token, 'file',
        `receipt-${ctx.weekLabel}-${i}.pdf`, fixturePdf(`Receipt ${desc.slice(0, 30)}`),
      );
      const result = await apiCall('POST', 'expenses', token, {
        amount,
        expenseDate: weekDay(ctx, i + 1),
        category,
        description: desc,
        receiptFileId: receipt?.id ? String(receipt.id) : undefined,
      });
      if (!result) throw new Error('Expense creation returned null');
    }, errors));
  }

  // ── 13. Approve expenses ───────────────────────────────────────────────────
  if (pct(w, 200, 55)) {
    const pendingExpenses = asList<{ id: number; status: string }>(
      await apiCall<unknown>('GET', 'expenses?status=Pending&pageSize=20', manager),
    );
    for (const exp of pendingExpenses.slice(0, 5)) {
      inc(await tryAction(`approve-exp-${exp.id}`, async () => {
        await apiCall('PATCH', `expenses/${exp.id}/status`, manager, { status: 'Approved' });
      }, errors));
    }
  }

  // ── 14. Purchase orders ────────────────────────────────────────────────────
  if (pct(w, 300, 70)) {
    const vendors = asList<{ id: number; companyName: string }>(
      await apiCall<unknown>('GET', 'vendors?pageSize=20', office),
    );
    if (vendors.length > 0 && parts.length > 0) {
      const vendor = vendors[w % vendors.length];
      const part = parts[(w + 1) % parts.length];

      inc(await tryAction('create-po', async () => {
        const result = await apiCall('POST', 'purchase-orders', office, {
          vendorId: vendor.id,
          notes: `Restock for ${ctx.weekLabel}`,
          lines: [{
            partId: part.id,
            description: null,
            quantity: seededInt(5, 50, w, 70),
            unitPrice: seededInt(10, 100, w, 75),
            notes: null,
          }],
        });
        if (!result) throw new Error('PO creation returned null');
      }, errors));
    }
  }

  // ── 15. Shipments from fulfilled SOs ───────────────────────────────────────
  if (pct(w, 350, 75)) {
    const allSOs = asList<{ id: number; status: string; customerId: number }>(
      await apiCall<unknown>('GET', 'orders?pageSize=200', office),
    );
    const openSOs = allSOs.filter(so => so.status === 'Confirmed' || so.status === 'InProduction' || so.status === 'PartiallyShipped');

    for (const so of openSOs.slice(0, 3)) {
      inc(await tryAction(`ship-so-${so.id}`, async () => {
        // Get SO details with lines
        const detail = await apiCall<{ id: number; lines: Array<{ id: number; quantity: number; partId: number | null }> }>(
          'GET', `orders/${so.id}`, office,
        );
        if (!detail?.lines?.length) throw new Error('SO has no lines');

        const carriers = ['UPS Ground', 'FedEx Express', 'USPS Priority', 'Freight LTL'];
        const result = await apiCall('POST', 'shipments', office, {
          salesOrderId: so.id,
          carrier: carriers[w % carriers.length],
          trackingNumber: `SIM${w}${so.id}`,
          shippingCost: seededInt(15, 150, w, 90),
          weight: seededInt(5, 100, w, 91),
          notes: `Simulation shipment ${ctx.weekLabel}`,
          lines: detail.lines.map(l => ({
            salesOrderLineId: l.id,
            quantity: l.quantity,
            notes: null,
            partId: l.partId,
          })),
        });
        if (!result) throw new Error('Shipment creation returned null');
      }, errors));
    }
  }

  // ── 16. Invoices ───────────────────────────────────────────────────────────
  if (pct(w, 400, 80)) {
    // Try from-job approach first (requires CompletedDate on job)
    const uninvResp = await apiCall<Array<{ id: number; title: string }>>(
      'GET', 'invoices/uninvoiced-jobs', office,
    );
    const uninvoicedJobs = (uninvResp ?? []).filter(j => j?.id);

    for (const job of uninvoicedJobs.slice(0, 4)) {
      inc(await tryAction(`invoice-job-${job.id}`, async () => {
        const invoice = await apiCall<{ id: number }>('POST', `invoices/from-job/${job.id}`, office, {});
        if (!invoice?.id) throw new Error('Invoice creation returned null');
        // Send the invoice immediately so it's available for payment
        await apiCall('POST', `invoices/${invoice.id}/send`, office, {});
      }, errors));
    }

    // Also create standalone invoices — higher probability for more invoice coverage
    if (customers.length > 0 && pct(w, 410, 55)) {
      const customer = customers[(w + 2) % customers.length];
      const part = parts.length > 0 ? parts[(w + 3) % parts.length] : null;
      inc(await tryAction('standalone-invoice', async () => {
        const result = await apiCall<{ id: number }>('POST', 'invoices', office, {
          customerId: customer.id,
          invoiceDate: weekDay(ctx, 0),
          dueDate: weekDay(ctx, 30),
          creditTerms: 'Net30',
          taxRate: 0,
          notes: `Simulation invoice ${ctx.weekLabel}`,
          lines: [{
            partId: part?.id ?? null,
            description: pick(QUOTE_LINE_DESCRIPTIONS, w, 80),
            quantity: seededInt(1, 50, w, 81),
            unitPrice: seededInt(20, 200, w, 82),
          }],
        });
        if (!result) throw new Error('Invoice creation returned null');
        // Send immediately so it's available for payment
        if (result.id) await apiCall('POST', `invoices/${result.id}/send`, office, {});
      }, errors));
    }
  }

  // ── 16b. Send any remaining draft invoices ─────────────────────────────────
  const draftInvoices = asList<{ id: number; status: string }>(
    await apiCall<unknown>('GET', 'invoices?status=Draft&pageSize=20', office),
  );
  for (const inv of draftInvoices.slice(0, 5)) {
    inc(await tryAction(`send-invoice-${inv.id}`, async () => {
      await apiCall('POST', `invoices/${inv.id}/send`, office, {});
    }, errors));
  }

  // ── 17. Payments ───────────────────────────────────────────────────────────
  if (pct(w, 600, 75)) {
    const sentInvoicesRaw = asList<{ id: number; status: string; total: number; balanceDue: number; customerId: number }>(
      await apiCall<unknown>('GET', 'invoices?status=Sent&pageSize=50', office),
    );
    const sentInvoices = sentInvoicesRaw.filter(inv => (inv.balanceDue ?? inv.total) > 0);

    for (const inv of sentInvoices.slice(0, 5)) {
      const payAmount = inv.balanceDue ?? inv.total;
      inc(await tryAction(`payment-${inv.id}`, async () => {
        const methods = ['Check', 'BankTransfer', 'CreditCard', 'Wire'];
        const result = await apiCall('POST', 'payments', office, {
          customerId: inv.customerId,
          method: methods[w % methods.length],
          amount: payAmount,
          paymentDate: weekDay(ctx, 4),
          referenceNumber: `REF-${w}-${inv.id}`,
          notes: `Payment for invoice ${inv.id}`,
          applications: [{
            invoiceId: inv.id,
            amount: payAmount,
          }],
        });
        if (!result) throw new Error('Payment creation returned null');
      }, errors));
    }
  }

  // ── 18. Assets — create shop equipment (first few weeks only) ──────────────
  if (w < ASSET_NAMES.length) {
    const asset = ASSET_NAMES[w];
    const serial = `SN-${asset.manufacturer.slice(0, 3).toUpperCase()}-${1000 + w}`;
    inc(await tryAction(`asset-${w}`, async () => {
      const result = await apiCall('POST', 'assets', admin, {
        name: asset.name,
        assetType: asset.type,
        location: 'Main Shop Floor',
        manufacturer: asset.manufacturer,
        model: asset.model,
        serialNumber: serial,
        status: 'Active',
        notes: `Simulation asset created for ${ctx.weekLabel}`,
      });
      if (!result) throw new Error('Asset creation returned null');
    }, errors));
  }

  // ── 19. Maintenance schedules — set up recurring PM on assets ─────────────
  if (w >= 3 && w <= 22) {
    // Create one maintenance schedule per week for existing assets
    const assets = asList<{ id: number; name: string; currentHours: number }>(
      await apiCall<unknown>('GET', 'assets?status=Active', admin),
    );
    if (assets.length > 0) {
      const asset = assets[(w - 3) % assets.length];
      const title = pick(MAINTENANCE_TITLES, w, 0);
      const intervalDays = [30, 60, 90, 180, 365][(w - 3) % 5];
      const dueOffset = seededInt(7, intervalDays, w, 300);

      inc(await tryAction(`maint-sched-${w}`, async () => {
        const result = await apiCall('POST', `assets/${asset.id}/maintenance`, admin, {
          assetId: asset.id,
          title,
          description: `Recurring ${intervalDays}-day PM for ${asset.name}`,
          intervalDays,
          intervalHours: intervalDays <= 90 ? 500 : null,
          nextDueAt: weekDay(ctx, dueOffset),
        });
        if (!result) throw new Error('Maintenance schedule creation returned null');
      }, errors));
    }
  }

  // ── 20. Log maintenance — perform scheduled PM ────────────────────────────
  if (pct(w, 700, 40)) {
    const schedules = asList<{ id: number; assetId: number; assetName: string; title: string; isOverdue: boolean }>(
      await apiCall<unknown>('GET', 'assets/maintenance', manager),
    );
    const overdue = schedules.filter(s => s.isOverdue);
    const toLog = overdue.length > 0 ? overdue.slice(0, 2) : schedules.slice(0, 1);

    for (const sched of toLog) {
      inc(await tryAction(`maint-log-${sched.id}`, async () => {
        const result = await apiCall('POST', `assets/maintenance/${sched.id}/log`, manager, {
          hoursAtService: seededInt(200, 5000, w, 710),
          notes: `PM performed per schedule — ${sched.title}`,
          cost: seededInt(50, 800, w, 720),
        });
        if (!result) throw new Error('Maintenance log returned null');
      }, errors));
    }
  }

  // ── 21. Machine hours — accumulate running hours ──────────────────────────
  if (pct(w, 750, 60)) {
    const assets = asList<{ id: number; name: string; currentHours: number; assetType: string }>(
      await apiCall<unknown>('GET', 'assets?type=Machine', manager),
    );
    for (const asset of assets.slice(0, 5)) {
      const hoursThisWeek = seededInt(20, 80, w, asset.id + 760);
      inc(await tryAction(`hours-${asset.id}`, async () => {
        await apiCall('PATCH', `assets/${asset.id}/hours`, manager, {
          currentHours: asset.currentHours + hoursThisWeek,
        });
      }, errors));
    }
  }

  // ── 22. Downtime logs — unplanned breakdowns ──────────────────────────────
  if (pct(w, 800, 20)) {
    const assets = asList<{ id: number; name: string }>(
      await apiCall<unknown>('GET', 'assets?type=Machine', manager),
    );
    if (assets.length > 0) {
      const asset = assets[w % assets.length];
      const reason = pick(DOWNTIME_REASONS, w, 0);
      const resolution = pick(DOWNTIME_RESOLUTIONS, w, 0);
      const downtimeHours = seededInt(1, 16, w, 810);

      inc(await tryAction(`downtime-${asset.id}`, async () => {
        const startedAt = weekDay(ctx, seededInt(0, 4, w, 820));
        const endDate = new Date(startedAt);
        endDate.setUTCHours(endDate.getUTCHours() + downtimeHours);

        await apiCall('POST', `assets/${asset.id}/downtime`, manager, {
          assetId: asset.id,
          startedAt,
          endedAt: endDate.toISOString(),
          reason,
          resolution,
          isPlanned: false,
          notes: `Sim week ${ctx.weekLabel}`,
        });
      }, errors));
    }
  }

  // ── 23. Maintenance jobs — create from maintenance schedules ──────────────
  if (pct(w, 850, 15)) {
    const schedules = asList<{ id: number; isOverdue: boolean; title: string }>(
      await apiCall<unknown>('GET', 'assets/maintenance', manager),
    );
    const overdue = schedules.filter(s => s.isOverdue);
    if (overdue.length > 0) {
      const sched = overdue[w % overdue.length];
      inc(await tryAction(`maint-job-${sched.id}`, async () => {
        const result = await apiCall('POST', `assets/maintenance/${sched.id}/create-job`, manager, {});
        if (!result) throw new Error('Maintenance job creation returned null');
      }, errors));
    }
  }

  // ── 24. Job disposition — dispose completed jobs (ship, scrap, inventory) ─
  if (pct(w, 900, 60)) {
    // Re-fetch jobs to see newly advanced ones at final stage
    const freshJobs = asList<{ id: number; jobNumber: string; stageName: string }>(
      await apiCall<unknown>('GET', 'jobs?pageSize=2000', manager),
    );
    const completedJobs = freshJobs.filter(j => j.stageName === 'Payment Received');
    // Rotate offset so different jobs get checked each week
    const dispOffset = (w * 5) % Math.max(completedJobs.length, 1);
    const dispRotated = [...completedJobs.slice(dispOffset), ...completedJobs.slice(0, dispOffset)];
    // Dispose jobs that haven't been disposed yet (fetch detail to check)
    for (const job of dispRotated.slice(0, 8)) {
      const detail = await apiCall<{ id: number; disposition: string | null }>('GET', `jobs/${job.id}`, manager);
      if (detail?.disposition !== null && detail?.disposition !== undefined) continue; // already disposed

      // Weighted disposition: 70% ship, 10% scrap, 10% inventory, 10% capitalize
      const dispositions: Array<{ disp: string; notes: string }> = [
        { disp: 'ShipToCustomer', notes: 'Parts shipped to customer per PO terms.' },
        { disp: 'ShipToCustomer', notes: 'Final shipment on order. Job complete.' },
        { disp: 'ShipToCustomer', notes: 'Partial ship — remaining on backorder.' },
        { disp: 'ShipToCustomer', notes: 'Customer picked up from dock.' },
        { disp: 'ShipToCustomer', notes: 'Shipped via UPS Ground.' },
        { disp: 'ShipToCustomer', notes: 'Freight pickup scheduled.' },
        { disp: 'ShipToCustomer', notes: 'Customer-supplied material returned with parts.' },
        { disp: 'Scrap', notes: pick(SCRAP_REASONS, w, job.id) },
        { disp: 'AddToInventory', notes: 'Overrun — excess parts added to stock.' },
        { disp: 'CapitalizeAsAsset', notes: 'Tooling fixture capitalized as shop asset.' },
      ];
      const d = dispositions[(w + job.id) % dispositions.length];

      inc(await tryAction(`dispose-${job.id}`, async () => {
        await apiCall('POST', `jobs/${job.id}/dispose`, manager, {
          disposition: d.disp,
          notes: d.notes,
        });
      }, errors));
    }
  }

  // ── 25. QC inspections — quality checks on in-progress jobs ───────────────
  if (pct(w, 950, 30)) {
    // Inspect jobs at QC/Review or In Production stage
    const qcJobs = allJobs.filter(j => j.stageName === 'QC/Review' || j.stageName === 'In Production');

    // Get existing templates
    const templates = asList<{ id: number; name: string }>(
      await apiCall<unknown>('GET', 'quality/templates', manager),
    );

    for (const job of qcJobs.slice(0, 2)) {
      inc(await tryAction(`qc-${job.id}`, async () => {
        const templateId = templates.length > 0 ? templates[w % templates.length].id : null;
        const inspection = await apiCall<{ id: number }>('POST', 'quality/inspections', engineer, {
          jobId: job.id,
          templateId,
          lotNumber: `LOT-${ctx.weekLabel}-${job.id}`,
          notes: `Simulation QC inspection — ${ctx.weekLabel}`,
        });
        if (!inspection?.id) throw new Error('QC inspection creation returned null');

        // Complete the inspection with results
        const passed = pct(w, job.id + 960, 85); // 85% pass rate
        await apiCall('PUT', `quality/inspections/${inspection.id}`, engineer, {
          status: passed ? 'Passed' : 'Failed',
          notes: passed ? 'All dimensions within spec.' : 'Dimensional non-conformance found. See results.',
          results: [
            { description: 'Critical dimension check', passed, measuredValue: passed ? 'In spec' : 'Out of tolerance', notes: null },
            { description: 'Surface finish verification', passed: true, measuredValue: 'Ra 32', notes: null },
            { description: 'Visual inspection', passed: true, measuredValue: 'No defects', notes: null },
          ],
        });
      }, errors));
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  EXPANDED COVERAGE (26-35) — broadens the corpus into parts/BOM, vendors,
  //  inventory + lots, PO receiving, compliance calendar, collaboration
  //  (comments/notes/chat), file attachments, and AI/RAG indexing.
  // ══════════════════════════════════════════════════════════════════════════

  const userByEmail = (email: string) => allUsers.find(u => u.email === email);
  const engUserId = userByEmail('akim@forge.local')?.id ?? null;
  const wkUserId  = userByEmail('bkelly@forge.local')?.id ?? null;
  const mgrUserId = userByEmail('lwilson@forge.local')?.id ?? null;
  const offUserId = userByEmail('cthompson@forge.local')?.id ?? null;

  // ── 26. Standalone parts + BOM ─────────────────────────────────────────────
  // Grow the part catalog with a Make parent + a Buy child, then link them via a
  // BOM line. New parts stay Draft (promotion to Active needs a routing, out of
  // scope here) — Draft parts are still valid training data.
  {
    const makeChild = pct(w, 1000, 60);
    const parentName = `${pick(PART_NAMES, w, 1000)} ${1000 + w}`;
    const childName  = makeChild
      ? `${pick(PURCHASED_COMPONENTS, w, 1001).name} ${1000 + w}`
      : `${pick(RAW_MATERIALS, w, 1002).name} ${1000 + w}`;

    // Create parent + child + BOM line as one chained action so ids flow through.
    inc(await tryAction(`part-bom-${w}`, async () => {
      const parent = await apiCall<{ id: number }>('POST', 'parts', engineer, {
        name: parentName.slice(0, 120),
        description: `Simulated assembly part introduced ${ctx.weekLabel}`,
        revision: 'A',
        procurementSource: 'Make',
        inventoryClass: pick(['Subassembly', 'FinishedGood'], w, 1003),
      });
      if (!parent?.id) throw new Error('Parent part creation returned null');

      const child = await apiCall<{ id: number }>('POST', 'parts', engineer, {
        name: childName.slice(0, 120),
        description: `Simulated ${makeChild ? 'purchased' : 'raw'} component ${ctx.weekLabel}`,
        revision: 'A',
        procurementSource: 'Buy',
        inventoryClass: makeChild ? 'Component' : 'Raw',
      });
      if (!child?.id) throw new Error('Child part creation returned null');

      await apiCall('POST', `parts/${parent.id}/bom`, engineer, {
        childPartId: child.id,
        quantity: seededInt(1, 8, w, 1004),
        sourceType: makeChild ? 'Buy' : 'Stock',
        referenceDesignator: `REF-${w}`,
        notes: `BOM line added ${ctx.weekLabel}`,
      });
    }, errors));
  }

  // ── 27. Vendors — grow the supplier list ───────────────────────────────────
  // The PO step only READ vendors; without new vendors the seed set never grows.
  // Create one vendor for the first ~24 weeks, then occasionally after.
  if (w < VENDOR_NAMES.length && (w < 24 || pct(w, 1100, 15))) {
    const vname = VENDOR_NAMES[w % VENDOR_NAMES.length];
    inc(await tryAction(`vendor-${w}`, async () => {
      const first = pick(CONTACT_FIRST, w, 1101);
      const last  = pick(CONTACT_LAST, w, 1102);
      const result = await apiCall('POST', 'vendors', manager, {
        companyName: vname,
        contactName: `${first} ${last}`,
        email: `${first.toLowerCase()}.${last.toLowerCase()}@${vname.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
        phone: `(555) ${String(200 + (w % 700)).padStart(3, '0')}-${String(1000 + (w * 7) % 9000).padStart(4, '0')}`,
        paymentTerms: pick(['Net30', 'Net45', 'Net60', 'Due on Receipt'], w, 1103),
        notes: `Approved supplier onboarded ${ctx.weekLabel}`,
      });
      if (!result) throw new Error('Vendor creation returned null');
    }, errors));
  }

  // ── 28. Inventory — storage locations, stock receipts, lots, movements ──────
  // Build out an Area→Bin hierarchy in the early weeks, then receive stock,
  // create lot records (FEFO), and occasionally adjust/place bin contents.
  const bins = asList<{ id: number; name: string; locationType: string }>(
    await apiCall<unknown>('GET', 'inventory/locations/bins?pageSize=100', manager),
  );
  if (bins.length < 8 && w < 12) {
    inc(await tryAction(`storage-area-${w}`, async () => {
      const areaName = pick(STORAGE_LOCATION_NAMES, w, 1200);
      const area = await apiCall<{ id: number }>('POST', 'inventory/locations', manager, {
        name: `${areaName} ${w}`, locationType: 'Area',
      });
      if (!area?.id) throw new Error('Area creation returned null');
      // Two bins under the area.
      for (let b = 0; b < 2; b++) {
        await apiCall('POST', 'inventory/locations', manager, {
          name: `${areaName.slice(0, 12)}-BIN-${w}-${b}`,
          locationType: 'Bin',
          parentId: area.id,
        });
      }
    }, errors));
  }

  // Fresh parts + bins for stock ops (asList now correctly unwraps paged results).
  const stockParts = asList<{ id: number; partNumber: string; inventoryClass: string }>(
    await apiCall<unknown>('GET', 'parts?pageSize=200', manager),
  );
  const freshBins = asList<{ id: number; name: string }>(
    await apiCall<unknown>('GET', 'inventory/locations/bins?pageSize=100', manager),
  );
  if (stockParts.length > 0 && freshBins.length > 0) {
    // Receive stock for 1-2 parts into a rotating bin.
    const receiveCount = seededInt(1, 2, w, 1210);
    for (let i = 0; i < receiveCount; i++) {
      const part = stockParts[(w * 3 + i) % stockParts.length];
      const bin  = freshBins[(w + i) % freshBins.length];
      const lotNo = `LOT-${ctx.weekLabel}-${part.id}`;
      inc(await tryAction(`receive-stock-${i}`, async () => {
        await apiCall('POST', 'inventory/receive-stock', manager, {
          partId: part.id,
          locationId: bin.id,
          quantity: seededInt(25, 500, w, i + 1211),
          reason: `Cycle receipt ${ctx.weekLabel}`,
          lotNumber: lotNo,
        });
      }, errors));

      // Create a matching lot record (FEFO tracking) for a subset.
      if (pct(w, i + 1220, 55)) {
        inc(await tryAction(`lot-${i}`, async () => {
          const exp = new Date(ctx.weekStart);
          exp.setUTCFullYear(exp.getUTCFullYear() + 2);
          await apiCall('POST', 'lots', engineer, {
            partId: part.id,
            quantity: seededInt(25, 500, w, i + 1221),
            supplierLotNumber: `SUP-${part.partNumber}-${w}`,
            expirationDate: exp.toISOString(),
            notes: `Lot received ${ctx.weekLabel}`,
          });
        }, errors));
      }
    }

    // Occasional adjustment + bin-content placement for movement coverage.
    if (pct(w, 1230, 30)) {
      const bin = freshBins[w % freshBins.length];
      const part = stockParts[(w * 5) % stockParts.length];
      inc(await tryAction('bin-place', async () => {
        await apiCall('POST', 'inventory/bin-contents', manager, {
          locationId: bin.id,
          entityType: 'part',
          entityId: part.id,
          quantity: seededInt(5, 60, w, 1231),
          status: 'Stored',
          notes: `Binned ${ctx.weekLabel}`,
        });
      }, errors));
    }
  }

  // ── 29. Purchase order lifecycle — submit → acknowledge → receive ──────────
  // The PO step leaves POs in Draft; advance a few each week and receive their
  // lines into a bin so goods-receipt + PO status transitions populate.
  if (freshBins.length > 0 && pct(w, 1300, 70)) {
    const draftPOs = asList<{ id: number; status: string }>(
      await apiCall<unknown>('GET', 'purchase-orders?pageSize=50', office),
    ).filter(po => po.status === 'Draft');

    for (const po of draftPOs.slice(0, 2)) {
      inc(await tryAction(`po-submit-${po.id}`, async () => {
        await apiCall('POST', `purchase-orders/${po.id}/submit`, office, {});
      }, errors));
      inc(await tryAction(`po-ack-${po.id}`, async () => {
        await apiCall('POST', `purchase-orders/${po.id}/acknowledge`, office, {});
      }, errors));
      inc(await tryAction(`po-receive-${po.id}`, async () => {
        const detail = await apiCall<{ id: number; status: string; lines: Array<{ id: number; remainingQuantity: number }> }>(
          'GET', `purchase-orders/${po.id}`, office,
        );
        const receivable = (detail?.lines ?? []).filter(l => (l.remainingQuantity ?? 0) > 0);
        if (receivable.length === 0) throw new Error('No receivable lines');
        const bin = freshBins[w % freshBins.length];
        await apiCall('POST', `purchase-orders/${po.id}/receive`, office, {
          lines: receivable.map(l => ({
            lineId: l.id,
            quantity: l.remainingQuantity,
            storageLocationId: bin.id,
            notes: null,
          })),
          freightAllocationMethod: 'ByExtendedValue',
        });
      }, errors));
    }
  }

  // ── 30. Compliance calendar — events + attendees + RSVP ────────────────────
  // Events (safety/training/meeting) with the workforce as attendees; one
  // attendee RSVPs. Recurrence + workflow-status need the seeded taxonomy
  // (calendar_event_types) which is empty in dev, so we stay on the legacy enum.
  if (pct(w, 1400, 50)) {
    const attendees = [engUserId, wkUserId, mgrUserId, offUserId].filter((x): x is number => x !== null);
    const eventTypes = ['Training', 'Safety', 'Meeting', 'Other'];
    inc(await tryAction(`event-${w}`, async () => {
      const start = new Date(ctx.weekStart);
      start.setUTCDate(start.getUTCDate() + seededInt(1, 5, w, 1401));
      start.setUTCHours(14, 0, 0, 0);
      const end = new Date(start);
      end.setUTCHours(16, 0, 0, 0);
      const ev = await apiCall<{ id: number }>('POST', 'events', manager, {
        title: pick(EVENT_TITLES, w, 1402),
        description: `Recurring shop event scheduled ${ctx.weekLabel}`,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        location: pick(EVENT_LOCATIONS, w, 1403),
        eventType: pick(eventTypes, w, 1404),
        isRequired: pct(w, 1405, 60),
        attendeeUserIds: attendees,
      });
      if (!ev?.id) throw new Error('Event creation returned null');
      // One attendee RSVPs "Accepted".
      if (engUserId !== null) {
        await apiCall('POST', `events/${ev.id}/respond`, engineer, { status: 'Accepted' });
      }
    }, errors));
  }

  // ── 31. Entity comments + notes — collaboration threads ────────────────────
  // Comments (activity log) and notes on jobs / parts / customers. The generic
  // EntityActivity controller requires the SINGULAR PascalCase entity type
  // (Job/Part/Customer), not the plural route segment. mentionedUserIds is
  // REQUIRED (send [] when nobody is @-mentioned).
  {
    const commentTargets: Array<{ type: string; id: number | undefined; pool: string[] }> = [
      { type: 'Job', id: allJobs[w % Math.max(allJobs.length, 1)]?.id, pool: ENTITY_COMMENTS.job },
      { type: 'Part', id: stockParts[w % Math.max(stockParts.length, 1)]?.id, pool: ENTITY_COMMENTS.part },
      { type: 'Customer', id: customers[w % Math.max(customers.length, 1)]?.id, pool: ENTITY_COMMENTS.customer },
    ];
    for (let i = 0; i < commentTargets.length; i++) {
      const t = commentTargets[i];
      if (!t.id || !pct(w, i + 1500, 45)) continue;
      inc(await tryAction(`comment-${t.type}-${t.id}`, async () => {
        await apiCall('POST', `${t.type}/${t.id}/comments`, engineer, {
          comment: pick(t.pool, w, i + 1501),
          mentionedUserIds: [],
        });
      }, errors));
      if (pct(w, i + 1510, 35)) {
        inc(await tryAction(`note-${t.type}-${t.id}`, async () => {
          await apiCall('POST', `${t.type}/${t.id}/notes`, manager, {
            text: pick(t.pool, w, i + 1511),
            mentionedUserIds: [],
          });
        }, errors));
      }
    }
  }

  // ── 32. Chat — direct messages between the workforce ───────────────────────
  if (mgrUserId !== null && pct(w, 1600, 60)) {
    inc(await tryAction('chat-general', async () => {
      await apiCall('POST', 'chat/messages', worker, {
        recipientId: mgrUserId,
        content: pick(CHAT_MESSAGES_GENERAL, w, 1601),
      });
    }, errors));
  }
  if (engUserId !== null && pct(w, 1610, 40)) {
    const job = allJobs[w % Math.max(allJobs.length, 1)];
    inc(await tryAction('chat-job', async () => {
      await apiCall('POST', 'chat/messages', manager, {
        recipientId: engUserId,
        content: pick(CHAT_MESSAGES_JOB, w, 1611),
        linkedEntityType: job ? 'Job' : undefined,
        linkedEntityId: job?.id,
      });
    }, errors));
  }

  // ── 33. File attachments — drawings/docs on jobs, parts, assets ────────────
  // Generates FileAttachment rows + MinIO objects (also indexable by RAG).
  {
    const job = allJobs[(w * 2) % Math.max(allJobs.length, 1)];
    const part = stockParts[(w * 2) % Math.max(stockParts.length, 1)];
    if (job?.id && pct(w, 1700, 50)) {
      inc(await tryAction(`attach-job-${job.id}`, async () => {
        const r = await apiUpload('jobs/' + job.id + '/files', engineer, 'file',
          `traveler-${ctx.weekLabel}.pdf`, fixturePdf(`Job traveler ${job.jobNumber ?? job.id}`));
        if (!r) throw new Error('Job file upload returned null');
      }, errors));
    }
    if (part?.id && pct(w, 1710, 40)) {
      inc(await tryAction(`attach-part-${part.id}`, async () => {
        const r = await apiUpload('parts/' + part.id + '/files', engineer, 'file',
          `drawing-${ctx.weekLabel}.pdf`, fixturePdf(`Part drawing ${part.partNumber ?? part.id}`));
        if (!r) throw new Error('Part file upload returned null');
      }, errors));
    }
    const assetsForFiles = asList<{ id: number; name: string }>(
      await apiCall<unknown>('GET', 'assets?status=Active', admin),
    );
    const asset = assetsForFiles[w % Math.max(assetsForFiles.length, 1)];
    if (asset?.id && pct(w, 1720, 25)) {
      inc(await tryAction(`attach-asset-${asset.id}`, async () => {
        const r = await apiUpload('assets/' + asset.id + '/files', admin, 'file',
          `manual-${ctx.weekLabel}.pdf`, fixturePdf(`Asset manual ${asset.name}`));
        if (!r) throw new Error('Asset file upload returned null');
      }, errors));
    }
  }

  // ── 34. AI / RAG — index recent entities + run a semantic search ───────────
  // Ollama is available in dev; index a job + a part into document_embeddings and
  // exercise the RAG search path. Guarded so it no-ops cleanly if AI is offline.
  if (pct(w, 1800, 35)) {
    const aiStatus = await apiCall<{ available: boolean }>('GET', 'ai/status', manager);
    if (aiStatus?.available) {
      const job = allJobs[(w * 4) % Math.max(allJobs.length, 1)];
      if (job?.id) {
        inc(await tryAction(`ai-index-job-${job.id}`, async () => {
          await apiCall('POST', 'ai/index', manager, { entityType: 'Job', entityId: job.id });
        }, errors));
      }
      const part = stockParts[(w * 4) % Math.max(stockParts.length, 1)];
      if (part?.id) {
        inc(await tryAction(`ai-index-part-${part.id}`, async () => {
          await apiCall('POST', 'ai/index', manager, { entityType: 'Part', entityId: part.id });
        }, errors));
      }
      inc(await tryAction('ai-search', async () => {
        const r = await apiCall('POST', 'ai/search', manager, {
          query: pick(['aluminum bracket lead time', 'stainless valve tolerance', 'anodize finish spec', 'bearing housing part'], w, 1801),
          includeAnswer: false,
        });
        if (!r) throw new Error('AI search returned null');
      }, errors));
    }
  }

  // ── 35. Watchtower (regulatory) — NOT DRIVEN ───────────────────────────────
  // Intentionally omitted: the WatchtowerController gates on
  // [RequiresCapability("CAP-EXT-WATCHTOWER")], but that capability code is not in
  // the capability descriptor, so every watchtower route returns 404 regardless of
  // toggles. Sources + change-proposals are also seed-only (no create endpoint)
  // and the dev DB ships none. This domain cannot be exercised via API until the
  // backend registers the capability and seeds proposals. See corpus-gap notes.

  return {
    weekLabel: ctx.weekLabel,
    weekStart: ctx.weekStart.toISOString(),
    actionsAttempted: attempted,
    actionsSucceeded: succeeded,
    errors,
    durationMs: 0,
  };
}
