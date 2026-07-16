/**
 * Narrative week scenario — the stateful storyline layer (COVERAGE-BLUEPRINT.md §1).
 *
 * Where week-scenario-api.ts is a stateless backfill (re-query, act on whatever it
 * finds), this drives *storylines*: each week it spawns a few new deals with a
 * pre-decided fate (weighted outcomes) and advances every in-flight deal one step
 * toward its end-state — lost lead, rejected quote, deposit-then-balance order,
 * split multi-carrier shipment, late-cancel-with-fee, lot-traced recall, etc. The
 * result is a coherent, interconnected corpus rather than uniform noise.
 *
 * Selected with SIM_MODE=narrative.
 */
import type { WeekContext, WeekResult } from '../types/simulation.types';
import { logProgress, type SimError } from '../helpers/sim-context.helper';
import { apiCall } from '../helpers/api.helper';
import { pick, seededInt, COMPANIES } from '../data/scenario-data';
import { NarrativeLedger } from '../narrative/narrative-ledger';
import { advanceStoryline, type NarrativeWorld } from '../narrative/order-storyline-driver';

/** Fixed run salt → reproducible fates; the on-disk ledger continues across weeks. */
const RUN_SALT = Number(process.env['SIM_NARRATIVE_SALT'] ?? 71) >>> 0;

/** How many active storylines to advance per week (bounds per-week wall-clock). */
const MAX_ADVANCE_PER_WEEK = Number(process.env['SIM_NARRATIVE_ADVANCE'] ?? 50);

let ledger: NarrativeLedger | null = null;

export async function runWeekNarrative(ctx: WeekContext): Promise<WeekResult> {
  const errors: SimError[] = [];
  let attempted = 0;
  let succeeded = 0;
  const inc = (ok: boolean) => { attempted++; if (ok) succeeded++; };

  const t = {
    pm: ctx.tokens['pmorris@forge.local'],
    office: ctx.tokens['cthompson@forge.local'],
    manager: ctx.tokens['lwilson@forge.local'],
    engineer: ctx.tokens['akim@forge.local'],
    admin: ctx.tokens['admin@forge.local'],
    worker: ctx.tokens['bkelly@forge.local'],
  };
  const w = ctx.weekIndex;

  if (!ledger) ledger = NarrativeLedger.load(RUN_SALT);

  // ── pre-fetch the shared "world" once per week ─────────────────────────────
  const parts = asItems<{ id: number; partNumber: string }>(
    await apiCall<unknown>('GET', 'parts?pageSize=200', t.manager));
  const trackTypes = (await apiCall<Array<{ id: number; isDefault: boolean; stages: Array<{ id: number; name: string; sortOrder: number }> }>>(
    'GET', 'track-types', t.manager)) ?? [];
  const world: NarrativeWorld = {
    parts,
    defaultTrack: trackTypes.find(x => x.isDefault) ?? trackTypes[0] ?? null,
  };

  // ── spawn new storylines (business intake grows slowly over the run) ───────
  const growth = 1 + Math.floor(w / 260); // ~+1 deal/week per 5 simulated years
  const newCount = seededInt(2, 4, w, 0) + growth;
  for (let i = 0; i < newCount; i++) {
    ledger.spawn(pick(COMPANIES, w, i * 7 + 1), w);
  }

  // ── advance in-flight storylines (oldest first, bounded) ───────────────────
  const active = ledger.active().slice(0, MAX_ADVANCE_PER_WEEK);
  for (const s of active) {
    try {
      await advanceStoryline(s, ctx, t, world, errors, inc);
    } catch (err) {
      errors.push({ label: `sl${s.id}-uncaught`, error: String(err), timestamp: new Date().toISOString() });
    }
  }

  ledger.save();
  const counts = ledger.counts();
  logProgress(`  narrative: +${newCount} spawned, ${active.length} advanced | total=${counts.total} complete=${counts['complete'] ?? 0} cancelled=${counts['cancelled'] ?? 0} lost=${counts['lead-lost'] ?? 0}`);

  return {
    weekLabel: ctx.weekLabel,
    weekStart: ctx.weekStart.toISOString(),
    actionsAttempted: attempted,
    actionsSucceeded: succeeded,
    errors,
    durationMs: 0,
  };
}

function asItems<T>(resp: unknown): T[] {
  if (!resp) return [];
  if (Array.isArray(resp)) return resp as T[];
  if (typeof resp === 'object') {
    const o = resp as Record<string, unknown>;
    if (Array.isArray(o['items'])) return o['items'] as T[];
    if (Array.isArray(o['data'])) return o['data'] as T[];
  }
  return [];
}
