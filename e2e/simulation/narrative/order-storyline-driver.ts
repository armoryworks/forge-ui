/**
 * Order storyline driver — advances a single storyline at most one stage per
 * simulated week, toward the end-state its pre-rolled fate dictates. Every app
 * mutation reuses the endpoints/payloads proven by the stateless week scenario;
 * the new layer here is the *sequencing* and the wiring of the new backend
 * keystones (payment schedules, lot genealogy, recalls, cancellation fees).
 *
 * All calls are wrapped in tryAction: a failed step logs and the storyline simply
 * retries the same stage next week, so one bad response never derails the run.
 */
import type { WeekContext } from '../types/simulation.types';
import { tryAction, type SimError } from '../helpers/sim-context.helper';
import { apiCall } from '../helpers/api.helper';
import {
  pick, seededInt, CONTACT_FIRST, CONTACT_LAST, LEAD_SOURCES, LEAD_NOTES,
  QUOTE_LINE_DESCRIPTIONS, JOB_TITLES, SHIPMENT_CARRIERS, SCRAP_REASONS,
} from '../data/scenario-data';
import { makeRng } from './outcome';
import type { StorylineState } from './storyline.types';

export interface NarrativeWorld {
  parts: Array<{ id: number; partNumber: string }>;
  defaultTrack: { id: number; stages: Array<{ id: number; name: string; sortOrder: number }> } | null;
}

type Tok = string;
interface Tokens { pm: Tok; office: Tok; manager: Tok; engineer: Tok; admin: Tok; worker: Tok; }

/** ISO datetime for a day offset from weekStart. */
function weekDay(ctx: WeekContext, offsetDays = 0): string {
  const d = new Date(ctx.weekStart);
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString();
}

/** Payment milestones for a fate's payment plan (empty = plain credit terms). */
function milestonesFor(plan: StorylineState['fate']['payment']): Array<Record<string, unknown>> {
  switch (plan) {
    case 'deposit-balance':
      return [
        { sequence: 1, name: 'Deposit', percentage: 50, dueTrigger: 'OnOrderConfirmation' },
        { sequence: 2, name: 'Balance', percentage: 50, dueTrigger: 'OnDelivery' },
      ];
    case 'fifty-fifty':
      return [
        { sequence: 1, name: 'On confirmation', percentage: 50, dueTrigger: 'OnOrderConfirmation' },
        { sequence: 2, name: 'On completion', percentage: 50, dueTrigger: 'OnDelivery' },
      ];
    case 'pre-production':
      return [{ sequence: 1, name: 'Payment before production', percentage: 100, dueTrigger: 'OnOrderConfirmation' }];
    case 'net':
    default:
      return [];
  }
}

/**
 * Advance one storyline. Returns the number of actions attempted (each also
 * inc()'d through the caller's counters via the errors array + return of ok).
 */
export async function advanceStoryline(
  s: StorylineState,
  ctx: WeekContext,
  t: Tokens,
  world: NarrativeWorld,
  errors: SimError[],
  inc: (ok: boolean) => void,
): Promise<void> {
  const w = ctx.weekIndex;
  const rng = makeRng((s.seed ^ (w * 2246822519)) >>> 0);
  const adv = (stage: StorylineState['stage']) => { s.stage = stage; s.lastAdvancedWeek = w; };

  switch (s.stage) {
    // ── spawn a lead ─────────────────────────────────────────────────────────
    case 'new': {
      const first = pick(CONTACT_FIRST, w, s.id);
      const last = pick(CONTACT_LAST, w, s.id + 1);
      const email = `${first.toLowerCase()}.${last.toLowerCase()}@${s.companyName.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`;
      inc(await tryAction(`sl${s.id}-lead`, async () => {
        const lead = await apiCall<{ id: number }>('POST', 'leads', t.pm, {
          companyName: s.companyName,
          contactName: `${first} ${last}`,
          email,
          phone: `(555) ${String(200 + (s.id % 700)).padStart(3, '0')}-${String(1000 + (s.id * 7) % 9000).padStart(4, '0')}`,
          source: pick(LEAD_SOURCES, w, s.id),
          notes: pick(LEAD_NOTES, w, s.id),
          followUpDate: weekDay(ctx, 5),
        });
        if (!lead?.id) throw new Error('lead create null');
        s.refs.leadId = lead.id;
      }, errors));
      adv('lead');
      return;
    }

    // ── lead: lost, or advance + convert to a customer ───────────────────────
    case 'lead': {
      if (s.fate.lead === 'lost') {
        // Mark the lead Lost — a real dead-end, valuable negative-path data.
        if (s.refs.leadId) {
          inc(await tryAction(`sl${s.id}-lead-lost`, async () => {
            await apiCall('PATCH', `leads/${s.refs.leadId}`, t.pm, { status: 'Lost' });
          }, errors));
        }
        adv('lead-lost');
        return;
      }
      inc(await tryAction(`sl${s.id}-convert-lead`, async () => {
        if (s.refs.leadId) await apiCall('PATCH', `leads/${s.refs.leadId}`, t.pm, { status: 'Quoting' });
        const res = await apiCall<{ id?: number; customerId?: number }>('POST', `leads/${s.refs.leadId}/convert`, t.pm, {});
        s.refs.customerId = res?.customerId ?? res?.id;
      }, errors));
      adv('estimate');
      return;
    }

    // ── estimate → quote (with payment schedule authored on the quote) ───────
    case 'estimate': {
      if (!s.refs.customerId) { adv('lead-lost'); return; }
      inc(await tryAction(`sl${s.id}-estimate`, async () => {
        const est = await apiCall<{ id: number }>('POST', 'estimates', t.pm, {
          customerId: s.refs.customerId,
          title: pick(JOB_TITLES, w, s.id).replace('{customer}', s.companyName),
          description: `Estimate for ${s.companyName}`,
          estimatedAmount: seededInt(2000, 80000, w, s.id),
          validUntil: weekDay(ctx, 30),
          notes: null,
        });
        if (!est?.id) throw new Error('estimate create null');
        const lineCount = seededInt(1, 3, w, s.id);
        for (let i = 0; i < lineCount; i++) {
          const part = world.parts.length ? world.parts[(s.id + i) % world.parts.length] : null;
          await apiCall('POST', `estimates/${est.id}/lines`, t.pm, {
            partId: part?.id ?? null,
            description: pick(QUOTE_LINE_DESCRIPTIONS, w, s.id + i),
            quantity: seededInt(10, 250, w, s.id + i),
            unitPrice: seededInt(5, 120, w, s.id + i),
            notes: null,
          });
        }
        const quote = await apiCall<{ id: number }>('POST', `estimates/${est.id}/convert`, t.pm, {});
        if (!quote?.id) throw new Error('estimate convert null');
        s.refs.quoteId = quote.id;

        // Author the payment schedule on the quote (re-linked to the SO on conversion).
        const milestones = milestonesFor(s.fate.payment);
        if (milestones.length) {
          await apiCall('PUT', `quotes/${quote.id}/payment-schedule`, t.office, { milestones });
        }
        await apiCall('POST', `quotes/${quote.id}/send`, t.pm, {});
      }, errors));
      adv('quote');
      return;
    }

    // ── quote: rejected, or accepted → sales order ───────────────────────────
    case 'quote': {
      if (!s.refs.quoteId) { adv('quote-rejected'); return; }
      if (s.fate.quote === 'rejected') {
        inc(await tryAction(`sl${s.id}-quote-reject`, async () => {
          await apiCall('PATCH', `quotes/${s.refs.quoteId}`, t.manager, { status: 'Rejected' });
        }, errors));
        adv('quote-rejected');
        return;
      }
      inc(await tryAction(`sl${s.id}-accept-convert`, async () => {
        await apiCall('POST', `quotes/${s.refs.quoteId}/accept`, t.manager, {});
        const so = await apiCall<{ id: number }>('POST', `quotes/${s.refs.quoteId}/convert`, t.office, {});
        if (!so?.id) throw new Error('quote convert null');
        s.refs.salesOrderId = so.id;
      }, errors));
      adv('order');
      return;
    }

    // ── sales order: confirm (auto-creates jobs + advances payment schedule) ─
    case 'order': {
      if (!s.refs.salesOrderId) { adv('quote-rejected'); return; }
      inc(await tryAction(`sl${s.id}-confirm`, async () => {
        await apiCall('POST', `orders/${s.refs.salesOrderId}/confirm`, t.office, {});
        // Capture the auto-created jobs for this SO's lines.
        const jobs = await apiCall<{ items?: Array<{ id: number }> }>(
          'GET', `orders/${s.refs.salesOrderId}`, t.office);
        void jobs; // job ids are resolved from the board in production stage
      }, errors));
      // Early cancellation fires right after confirmation, before production.
      if (s.fate.cancellation === 'early') { adv('cancelled'); await cancel(s, t, errors, inc, false); return; }
      adv('confirmed');
      return;
    }

    // ── confirmed → production: advance jobs, log time, build lot genealogy ──
    case 'confirmed': {
      const jobs = await jobsForOrder(s, t.manager);
      s.refs.jobIds = jobs.map(j => j.id);
      // Advance each job a stage or two.
      if (world.defaultTrack) {
        const stages = [...world.defaultTrack.stages].sort((a, b) => a.sortOrder - b.sortOrder);
        for (const job of jobs) {
          const idx = stages.findIndex(st => st.name === job.stageName);
          if (idx >= 0 && idx < stages.length - 1) {
            inc(await tryAction(`sl${s.id}-move-${job.id}`, async () => {
              await apiCall('PATCH', `jobs/${job.id}/stage`, t.manager, { jobId: job.id, stageId: stages[idx + 1].id });
            }, errors));
          }
        }
      }
      // Lot genealogy: raw material lots consumed into a produced lot for the first job.
      if (jobs.length && world.parts.length) {
        await buildGenealogy(s, ctx, t, world, errors, inc);
      }
      // Log some production labor.
      if (jobs.length) {
        inc(await tryAction(`sl${s.id}-time`, async () => {
          await apiCall('POST', 'time-tracking/entries', t.engineer, {
            jobId: jobs[0].id, date: weekDay(ctx, 1).slice(0, 10),
            durationMinutes: seededInt(60, 480, w, s.id), category: 'Production',
            notes: `Production on ${s.companyName} order`,
          });
        }, errors));
      }
      adv('production');
      return;
    }

    // ── production: QC outcome, then to fulfilment (or scrap/late-cancel) ────
    case 'production': {
      const jobs = await jobsForOrder(s, t.manager);
      // Quality outcome.
      if (s.fate.quality !== 'clean' && jobs.length) {
        inc(await tryAction(`sl${s.id}-qc-${s.fate.quality}`, async () => {
          const insp = await apiCall<{ id: number }>('POST', 'quality/inspections', t.engineer, {
            jobId: jobs[0].id, templateId: null,
            lotNumber: `LOT-${s.id}-QC`, notes: `QC — ${s.fate.quality}`,
          });
          if (insp?.id) {
            const passed = s.fate.quality === 'clean';
            await apiCall('PUT', `quality/inspections/${insp.id}`, t.engineer, {
              status: passed ? 'Passed' : 'Failed',
              notes: passed ? 'In spec.' : pick(SCRAP_REASONS, w, s.id),
              results: [{ description: 'Critical dimension', passed, measuredValue: passed ? 'In spec' : 'Out of tol', notes: null }],
            });
          }
        }, errors));
      }
      // Late cancellation (with fee) happens mid-production.
      if (s.fate.cancellation === 'late-fee') {
        adv('cancelled');
        await cancel(s, t, errors, inc, true);
        return;
      }
      adv('fulfilment');
      return;
    }

    // ── fulfilment: ship (single / split multi-carrier per fate) ─────────────
    case 'fulfilment': {
      if (!s.refs.salesOrderId) { adv('complete'); return; }
      const detail = await apiCall<{ status: string; lines: Array<{ id: number; quantity: number; partId: number | null }> }>(
        'GET', `orders/${s.refs.salesOrderId}`, t.office);
      const lines = detail?.lines ?? [];
      if (lines.length) {
        const splits = s.fate.fulfillment === 'single' ? 1 : s.fate.fulfillment === 'split' ? 2 : 3;
        const shipmentIds: number[] = [];
        for (let sp = 0; sp < splits; sp++) {
          inc(await tryAction(`sl${s.id}-ship-${sp}`, async () => {
            const shp = await apiCall<{ id: number }>('POST', 'shipments', t.office, {
              salesOrderId: s.refs.salesOrderId,
              carrier: SHIPMENT_CARRIERS[(s.id + sp) % SHIPMENT_CARRIERS.length],
              trackingNumber: `SIM${s.id}-${sp}`,
              shippingCost: seededInt(15, 200, w, s.id + sp),
              weight: seededInt(5, 120, w, s.id + sp),
              notes: `Shipment ${sp + 1}/${splits} for ${s.companyName}`,
              lines: lines.map(l => ({
                salesOrderLineId: l.id,
                quantity: Math.max(1, Math.floor(l.quantity / splits)),
                notes: null, partId: l.partId,
              })),
            });
            if (shp?.id) shipmentIds.push(shp.id);
          }, errors));
        }
        s.refs.shipmentIds = shipmentIds;
      }
      // long-running orders linger one more week in fulfilment.
      if (s.fate.fulfillment === 'long-running' && rng() < 0.5) { s.lastAdvancedWeek = w; return; }
      adv('billing');
      return;
    }

    // ── billing: invoice + apply payments; recall check; then complete ───────
    case 'billing': {
      // Advance the payment schedule (bills any now-due milestones: on-delivery balance).
      if (s.refs.salesOrderId) {
        inc(await tryAction(`sl${s.id}-advance-sched`, async () => {
          await apiCall('POST', `orders/${s.refs.salesOrderId}/payment-schedule/advance`, t.office, {});
        }, errors));
      }
      // Invoice any remaining draft, then pay all sent invoices for this customer.
      const invoices = await apiCall<Array<{ id: number; status: string; balanceDue?: number; total?: number; customerId?: number }>>(
        'GET', `invoices?status=Sent&pageSize=50`, t.office);
      const mine = (invoices ?? []).filter(inv => inv.customerId === s.refs.customerId && (inv.balanceDue ?? inv.total ?? 0) > 0);
      for (const inv of mine.slice(0, 4)) {
        const amount = inv.balanceDue ?? inv.total ?? 0;
        inc(await tryAction(`sl${s.id}-pay-${inv.id}`, async () => {
          await apiCall('POST', 'payments', t.office, {
            customerId: s.refs.customerId,
            method: pick(['Check', 'ACH', 'Wire', 'CreditCard'], w, s.id + inv.id),
            amount, paymentDate: weekDay(ctx, 3),
            referenceNumber: `REF-${s.id}-${inv.id}`, notes: `Payment for ${s.companyName}`,
            applications: [{ invoiceId: inv.id, amount }],
          });
        }, errors));
      }
      // Recall: initiate on a raw lot in this order's genealogy.
      if (s.fate.recall && s.refs.rawLotIds?.length) {
        inc(await tryAction(`sl${s.id}-recall`, async () => {
          await apiCall('POST', 'recalls', t.admin, {
            recalledLotId: s.refs.rawLotIds![0],
            reason: 'Supplier material nonconformance — precautionary recall',
            recallDate: weekDay(ctx, 0),
          });
        }, errors));
      }
      adv('complete');
      return;
    }

    default:
      return;
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────

/** Cancel this storyline's SO, with a fee for late cancellations. */
async function cancel(
  s: StorylineState, t: Tokens, errors: SimError[], inc: (ok: boolean) => void, withFee: boolean,
): Promise<void> {
  if (!s.refs.salesOrderId) return;
  inc(await tryAction(`sl${s.id}-cancel${withFee ? '-fee' : ''}`, async () => {
    const body = withFee
      ? { feeAmount: seededInt(250, 2500, s.id, 1), feeReason: 'Late cancellation past production commit' }
      : undefined;
    await apiCall('POST', `orders/${s.refs.salesOrderId}/cancel`, t.office, body ?? {});
  }, errors));
}

/** Jobs currently on the board for this storyline's sales order. */
async function jobsForOrder(
  s: StorylineState, token: string,
): Promise<Array<{ id: number; jobNumber: string; stageName: string }>> {
  const resp = await apiCall<{ items?: Array<{ id: number; jobNumber: string; stageName: string; salesOrderId?: number }> }>(
    'GET', `jobs?pageSize=2000`, token);
  const items = resp?.items ?? [];
  // Prefer SO-linked jobs; fall back to the captured ids.
  const linked = items.filter(j => (j as { salesOrderId?: number }).salesOrderId === s.refs.salesOrderId);
  if (linked.length) return linked;
  const ids = new Set(s.refs.jobIds ?? []);
  return items.filter(j => ids.has(j.id));
}

/** Create raw-material lots + a produced lot and record the genealogy edges. */
async function buildGenealogy(
  s: StorylineState, ctx: WeekContext, t: Tokens, world: NarrativeWorld,
  errors: SimError[], inc: (ok: boolean) => void,
): Promise<void> {
  if (s.refs.lotIds?.length) return; // already built
  const w = ctx.weekIndex;
  const rawPartA = world.parts[(s.id) % world.parts.length];
  const rawPartB = world.parts[(s.id + 1) % world.parts.length];
  const producedPart = world.parts[(s.id + 2) % world.parts.length];
  inc(await tryAction(`sl${s.id}-genealogy`, async () => {
    const mkLot = (partId: number, qty: number, sup: string) =>
      apiCall<{ id: number }>('POST', 'lots', t.engineer, {
        partId, quantity: qty, supplierLotNumber: sup, notes: `Lot for ${s.companyName}`,
      });
    const raw1 = await mkLot(rawPartA.id, seededInt(50, 500, w, s.id), `SUP-${s.id}-A`);
    const raw2 = await mkLot(rawPartB.id, seededInt(50, 500, w, s.id + 1), `SUP-${s.id}-B`);
    const produced = await mkLot(producedPart.id, seededInt(10, 100, w, s.id + 2), `PRD-${s.id}`);
    if (raw1?.id && raw2?.id && produced?.id) {
      s.refs.rawLotIds = [raw1.id, raw2.id];
      s.refs.lotIds = [produced.id];
      await apiCall('POST', `lots/${produced.id}/consumption`, t.engineer, {
        consumptions: [
          { consumedLotId: raw1.id, quantity: seededInt(10, 100, w, s.id) },
          { consumedLotId: raw2.id, quantity: seededInt(10, 100, w, s.id + 1) },
        ],
        jobId: s.refs.jobIds?.[0] ?? null,
      });
    }
  }, errors));
}
