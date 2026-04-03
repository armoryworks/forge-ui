/**
 * Full lead-to-cash week simulation.
 * Every action is wrapped in tryAction — failures are logged, never thrown.
 * Uses deterministic variation via pick() / seededInt() so each week produces
 * different but repeatable data.
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
  getNextStage, getOpenSalesOrders, getUninvoicedJobs,
  getEngineers,
} from '../helpers/entity-query.helper';

// ── helpers ──────────────────────────────────────────────────────────────────

/** ISO date string for a given day offset from weekStart */
function weekDay(ctx: WeekContext, offsetDays = 0): string {
  const d = new Date(ctx.weekStart);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10) + 'T00:00:00Z';
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

  // Role tokens
  const admin   = ctx.tokens['admin@qbengineer.local'];
  const engineer = ctx.tokens['akim@qbengineer.local'];
  const pm      = ctx.tokens['pmorris@qbengineer.local'];
  const manager = ctx.tokens['lwilson@qbengineer.local'];
  const office  = ctx.tokens['cthompson@qbengineer.local'];
  const worker  = ctx.tokens['bkelly@qbengineer.local'];

  const w = ctx.weekIndex;

  // ── 1. Create 1–3 new leads (PM) ─────────────────────────────────────────
  const newLeadCount = seededInt(1, 3, w, 0);
  for (let i = 0; i < newLeadCount; i++) {
    const company = pick(COMPANIES, w, i);
    const first   = pick(CONTACT_FIRST, w, i + 1);
    const last    = pick(CONTACT_LAST, w, i + 2);
    const source  = pick(LEAD_SOURCES, w, i);
    const notes   = pick(LEAD_NOTES, w, i + 3);
    const followUp = weekDay(ctx, 5 + i);

    inc(await tryAction(`create-lead-${i}`, async () => {
      await apiCall('POST', 'leads', pm, {
        companyName: company,
        contactName: `${first} ${last}`,
        email: `${first.toLowerCase()}.${last.toLowerCase()}@${company.toLowerCase().replace(/\s+/g, '')}.com`,
        phone: `(${555 + (w % 40)}) ${100 + (w % 900)}-${1000 + (i * 111 + w) % 9000}`,
        source,
        notes,
        followUpDate: followUp,
      });
    }, errors));
  }

  // ── 2. Advance open leads → Contacted / Qualified (PM) ──────────────────
  const openLeads = await getOpenLeads(pm);
  const leadsToAdvance = openLeads.filter((_, idx) => pct(w, idx + 10, 40));
  for (const lead of leadsToAdvance.slice(0, 2)) {
    inc(await tryAction(`advance-lead-${lead.id}`, async () => {
      const newStatus = lead.status === 'New' ? 'Contacted' : 'Qualified';
      await apiCall('PATCH', `leads/${lead.id}`, pm, { status: newStatus });
    }, errors));
  }

  // ── 3. Convert qualified leads → customers (PM, ~30% of qualified) ───────
  const qualifiedLeads = openLeads.filter(l => l.status === 'Qualified');
  const leadsToConvert = qualifiedLeads.filter((_, idx) => pct(w, idx + 20, 30));
  for (const lead of leadsToConvert.slice(0, 1)) {
    inc(await tryAction(`convert-lead-${lead.id}`, async () => {
      await apiCall('POST', `leads/${lead.id}/convert`, pm, { createJob: false });
    }, errors));
  }

  // ── 4. Create quotes for customers who don't have one yet (PM) ──────────
  const customers = await getCustomers(pm);
  const quotesToCreate = seededInt(1, 2, w, 4);
  for (let i = 0; i < quotesToCreate && i < customers.length; i++) {
    const customer = customers[(w + i) % customers.length];
    const lineCount = seededInt(1, 3, w, i + 30);
    const lines = Array.from({ length: lineCount }, (_, li) => ({
      description: pick(QUOTE_LINE_DESCRIPTIONS, w, i + li),
      quantity: seededInt(10, 500, w, li + 40),
      unitPrice: seededInt(5, 85, w, li + 50),
    }));
    const expiry = weekDay(ctx, 30);

    inc(await tryAction(`create-quote-${i}`, async () => {
      await apiCall('POST', 'quotes', pm, {
        customerId: customer.id,
        expirationDate: expiry,
        notes: `Quote for ${customer.name} — ${ctx.weekLabel}`,
        taxRate: 0.08,
        lines,
      });
    }, errors));
  }

  // ── 5. Send draft quotes (PM) ────────────────────────────────────────────
  const draftQuotes = await getDraftQuotes(pm);
  const quotesToSend = draftQuotes.filter((_, idx) => pct(w, idx + 60, 70));
  for (const quote of quotesToSend.slice(0, 3)) {
    inc(await tryAction(`send-quote-${quote.id}`, async () => {
      await apiCall('POST', `quotes/${quote.id}/send`, pm, {});
    }, errors));
  }

  // ── 6. Accept sent quotes (simulates customer acceptance, Manager) ────────
  const sentQuotes = await getSentQuotes(manager);
  const quotesToAccept = sentQuotes.filter((_, idx) => pct(w, idx + 70, 50));
  for (const quote of quotesToAccept.slice(0, 2)) {
    inc(await tryAction(`accept-quote-${quote.id}`, async () => {
      await apiCall('POST', `quotes/${quote.id}/accept`, manager, {});
    }, errors));
  }

  // ── 7. Convert accepted quotes → sales orders (Office Manager) ───────────
  const acceptedQuotes = await getAcceptedQuotes(office);
  for (const quote of acceptedQuotes.slice(0, 2)) {
    inc(await tryAction(`convert-quote-${quote.id}`, async () => {
      await apiCall('POST', `quotes/${quote.id}/convert`, office, {});
    }, errors));
  }

  // ── 8. Confirm open sales orders (Office Manager) ────────────────────────
  const openOrders = await getOpenSalesOrders(office);
  const ordersToConfirm = openOrders.filter(o => o.status === 'Draft');
  for (const order of ordersToConfirm.slice(0, 2)) {
    inc(await tryAction(`confirm-order-${order.id}`, async () => {
      await apiCall('POST', `orders/${order.id}/confirm`, office, {});
    }, errors));
  }

  // ── 9. Create new production jobs (Manager) ───────────────────────────────
  const trackType = await getDefaultTrackType(manager);
  const engineers = await getEngineers(manager);

  if (trackType && engineers.length > 0) {
    const jobsToCreate = seededInt(1, 2, w, 5);
    for (let i = 0; i < jobsToCreate; i++) {
      const customer = customers.length > 0 ? customers[(w + i) % customers.length] : null;
      const titleTemplate = pick(JOB_TITLES, w, i + 10);
      const title = titleTemplate.replace('{customer}', customer?.name ?? 'Internal');
      const assignee = engineers[(w + i) % engineers.length];
      const priorities = ['Low', 'Medium', 'High'];
      const priority = pick(priorities, w, i + 15);
      const dueDate = weekDay(ctx, 14 + seededInt(0, 14, w, i + 20));

      inc(await tryAction(`create-job-${i}`, async () => {
        await apiCall('POST', 'jobs', manager, {
          title,
          description: `Production run for ${ctx.weekLabel}`,
          trackTypeId: trackType.id,
          assigneeId: assignee.id,
          customerId: customer?.id ?? null,
          priority,
          dueDate,
        });
      }, errors));
    }
  }

  // ── 10. Advance job stages (Engineer + Worker) ────────────────────────────
  if (trackType) {
    const activeJobs = await getActiveJobs(engineer);
    const jobsToAdvance = activeJobs.filter((_, idx) => pct(w, idx + 80, 40));
    for (const job of jobsToAdvance.slice(0, 3)) {
      const nextStage = getNextStage(trackType, job.currentStageId);
      if (!nextStage) continue;
      inc(await tryAction(`advance-job-${job.id}`, async () => {
        await apiCall('PATCH', `jobs/${job.id}/stage`, engineer, { stageId: nextStage.id });
      }, errors));
    }
  }

  // ── 11. Add job comments (Engineer) ──────────────────────────────────────
  const activeJobs = await getActiveJobs(engineer);
  const jobsToComment = activeJobs.filter((_, idx) => pct(w, idx + 90, 50));
  for (const job of jobsToComment.slice(0, 2)) {
    const comment = pick(JOB_COMMENTS, w, job.id % 12);
    inc(await tryAction(`comment-job-${job.id}`, async () => {
      await apiCall('POST', `jobs/${job.id}/comments`, engineer, { content: comment });
    }, errors));
  }

  // ── 12. Log time entries (Engineer, Worker) ───────────────────────────────
  const jobsForTime = activeJobs.slice(0, 4);
  for (let i = 0; i < jobsForTime.length; i++) {
    const job = jobsForTime[i];
    const dayOffset = i % 5; // Mon–Fri spread
    const duration = seededInt(60, 480, w, i + 100); // 1–8 hrs in minutes
    const token = i % 2 === 0 ? engineer : worker;

    inc(await tryAction(`time-entry-${job.id}-${i}`, async () => {
      await apiCall('POST', 'time-tracking/entries', token, {
        jobId: job.id,
        date: weekDay(ctx, dayOffset),
        durationMinutes: duration,
        category: 'Production',
        notes: `Week ${ctx.weekLabel} work on job #${job.id}`,
      });
    }, errors));
  }

  // ── 13. Clock in / clock out (Worker) ────────────────────────────────────
  inc(await tryAction('clock-in', async () => {
    await apiCall('POST', 'time-tracking/clock', worker, {
      type: 'ClockIn',
      timestamp: weekDay(ctx, 1),
    });
  }, errors));

  inc(await tryAction('clock-out', async () => {
    await apiCall('POST', 'time-tracking/clock', worker, {
      type: 'ClockOut',
      timestamp: weekDay(ctx, 1),
    });
  }, errors));

  // ── 14. Submit expenses (Engineer, Worker) ────────────────────────────────
  const expenseCount = seededInt(1, 3, w, 6);
  for (let i = 0; i < expenseCount; i++) {
    const token  = i === 0 ? engineer : worker;
    const category = pick(EXPENSE_CATEGORIES, w, i + 50);
    const desc   = pick(EXPENSE_DESCRIPTIONS, w, i + 55).replace('{q}', `${Math.ceil((ctx.weekStart.getMonth() + 1) / 3)}`);
    const amount = seededInt(15, 350, w, i + 60);
    const linkedJob = activeJobs.length > 0 ? activeJobs[(w + i) % activeJobs.length] : null;

    inc(await tryAction(`expense-${i}`, async () => {
      await apiCall('POST', 'expenses', token, {
        amount,
        category,
        description: desc,
        jobId: linkedJob?.id ?? null,
        expenseDate: weekDay(ctx, i + 1),
      });
    }, errors));
  }

  // ── 15. Approve pending expenses (Manager) ────────────────────────────────
  if (pct(w, 200, 60)) {
    inc(await tryAction('approve-expenses', async () => {
      const pending = await apiCall<{ data: Array<{ id: number }> }>('GET', 'expenses?status=Submitted&pageSize=10', manager);
      const toApprove = (pending?.data ?? []).slice(0, 3);
      for (const exp of toApprove) {
        await apiCall('PATCH', `expenses/${exp.id}`, manager, { status: 'Approved' });
      }
    }, errors));
  }

  // ── 16. Create a purchase order (Office Manager) ──────────────────────────
  if (pct(w, 300, 50)) {
    const vendors = await apiCall<{ data: Array<{ id: number; name: string }> }>('GET', 'vendors?pageSize=20', office);
    const vendorList = vendors?.data ?? [];
    if (vendorList.length > 0) {
      const vendor = vendorList[w % vendorList.length];
      inc(await tryAction('create-po', async () => {
        await apiCall('POST', 'purchase-orders', office, {
          vendorId: vendor.id,
          expectedDeliveryDate: weekDay(ctx, 10),
          notes: `Materials order — ${ctx.weekLabel}`,
          lines: [
            {
              description: pick(QUOTE_LINE_DESCRIPTIONS, w, 20),
              quantity: seededInt(10, 100, w, 70),
              unitPrice: seededInt(5, 50, w, 75),
            },
          ],
        });
      }, errors));
    }
  }

  // ── 17. Receive a pending PO (Office Manager) ─────────────────────────────
  if (pct(w, 400, 40)) {
    const pendingPos = await apiCall<{ data: Array<{ id: number; status: string }> }>('GET', 'purchase-orders?status=Submitted&pageSize=10', office);
    const po = (pendingPos?.data ?? [])[0];
    if (po) {
      inc(await tryAction(`receive-po-${po.id}`, async () => {
        await apiCall('POST', `purchase-orders/${po.id}/receive`, office, {
          receivedAt: weekDay(ctx, 3),
          notes: 'All items received in good condition.',
        });
      }, errors));
    }
  }

  // ── 18. Invoice completed jobs (Office Manager) ───────────────────────────
  const uninvoicedJobs = await getUninvoicedJobs(office);
  for (const job of uninvoicedJobs.slice(0, 2)) {
    inc(await tryAction(`invoice-job-${job.id}`, async () => {
      const invoice = await apiCall<{ id: number }>('POST', `invoices/from-job/${job.id}`, office, {});
      if (invoice?.id && pct(w, job.id + 500, 80)) {
        await apiCall('POST', `invoices/${invoice.id}/send`, office, {});
      }
    }, errors));
  }

  // ── 19. Record a payment on a sent invoice (Office Manager) ──────────────
  if (pct(w, 600, 45)) {
    const sentInvoices = await apiCall<{ data: Array<{ id: number; totalAmount: number }> }>('GET', 'invoices?status=Sent&pageSize=10', office);
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

  // ── 20. Send a general chat message (Engineer) ────────────────────────────
  if (pct(w, 700, 60)) {
    inc(await tryAction('chat-general', async () => {
      const rooms = await apiCall<{ data: Array<{ id: number; name: string }> }>('GET', 'chat/rooms?pageSize=10', engineer);
      const room = (rooms?.data ?? [])[0];
      if (room) {
        const msg = pick(CHAT_MESSAGES_GENERAL, w, 0);
        await apiCall('POST', `chat/rooms/${room.id}/messages`, engineer, { content: msg });
      }
    }, errors));
  }

  // ── 21. Send a DM to admin (Engineer → Admin) ─────────────────────────────
  if (pct(w, 800, 30)) {
    inc(await tryAction('chat-dm', async () => {
      const adminUser = await apiCall<{ data: Array<{ id: number; email: string }> }>('GET', 'admin/users?pageSize=50', engineer);
      const adminUserId = adminUser?.data?.find(u => u.email === 'admin@qbengineer.local')?.id;
      if (adminUserId) {
        await apiCall('POST', 'chat/messages', engineer, {
          recipientId: adminUserId,
          content: `Quick update from week ${ctx.weekLabel} — production is on track.`,
        });
      }
    }, errors));
  }

  // ── 22. Set job status / hold on a random job (Manager) ──────────────────
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
