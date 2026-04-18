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
  JOB_COMMENTS,
  ASSET_NAMES, MAINTENANCE_TITLES, DOWNTIME_REASONS, DOWNTIME_RESOLUTIONS,
  SCRAP_REASONS,
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
 * Normalize API responses — some endpoints return plain arrays,
 * others return { data: [...] }. This always returns an array.
 */
function asList<T>(resp: unknown): T[] {
  if (!resp) return [];
  if (Array.isArray(resp)) return resp as T[];
  if (typeof resp === 'object' && 'data' in (resp as Record<string, unknown>)) {
    const data = (resp as Record<string, unknown>).data;
    return Array.isArray(data) ? data as T[] : [];
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
  const admin    = ctx.tokens['admin@qbengineer.local'];
  const pm       = ctx.tokens['pmorris@qbengineer.local'];
  const engineer = ctx.tokens['akim@qbengineer.local'];
  const manager  = ctx.tokens['lwilson@qbengineer.local'];
  const office   = ctx.tokens['cthompson@qbengineer.local'];
  const worker   = ctx.tokens['bkelly@qbengineer.local'];
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
  const allQuotes = asList<{ id: number; status: string; quoteNumber: string }>(
    await apiCall<unknown>('GET', 'quotes?pageSize=200', pm),
  );
  const draftQuotes = allQuotes.filter(q => q.status === 'Draft');

  // Re-fetch quotes after creation to get accurate status
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
  // Re-fetch after accepts
  const quotesForConvert = asList<{ id: number; status: string }>(
    await apiCall<unknown>('GET', 'quotes?pageSize=200', office),
  );
  const acceptedQuotes = quotesForConvert.filter(q => q.status === 'Accepted');
  for (const quote of acceptedQuotes.slice(0, 2)) {
    inc(await tryAction(`convert-quote-${quote.id}`, async () => {
      const result = await apiCall('POST', `quotes/${quote.id}/convert`, office, {});
      if (!result) throw new Error(`Quote ${quote.id} convert failed`);
    }, errors));
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
  const engineers = allUsers.filter(u => u.roles?.includes('Engineer') || u.roles?.includes('ProductionWorker'));

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
  const expenseCount = seededInt(1, 3, w, 6);
  for (let i = 0; i < expenseCount; i++) {
    const token = i === 0 ? engineer : worker;
    const category = pick(EXPENSE_CATEGORIES, w, i + 50);
    const desc = pick(EXPENSE_DESCRIPTIONS, w, i + 55).replace('{q}', `${Math.ceil((ctx.weekStart.getUTCMonth() + 1) / 3)}`);
    const amount = seededInt(15, 350, w, i + 60);

    inc(await tryAction(`expense-${i}`, async () => {
      const result = await apiCall('POST', 'expenses', token, {
        amount,
        date: weekDay(ctx, i + 1),
        category,
        description: desc,
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

  return {
    weekLabel: ctx.weekLabel,
    weekStart: ctx.weekStart.toISOString(),
    actionsAttempted: attempted,
    actionsSucceeded: succeeded,
    errors,
    durationMs: 0,
  };
}
