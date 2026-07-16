/**
 * Deterministic outcome assignment for the narrative simulation.
 *
 * Every storyline is spawned with a fixed seed (its id + a run salt); its whole
 * fate — will the lead convert, will the quote be accepted, what payment plan,
 * what fulfillment path, does it cancel, does quality fail — is drawn *once* from
 * weighted distributions using a seeded PRNG. That makes the corpus reproducible
 * (same seed ⇒ same storylines) and lets the driver simply read the pre-decided
 * outcome each week instead of re-rolling.
 *
 * Weights are the starting targets from COVERAGE-BLUEPRINT.md §6.
 */

/** mulberry32 — tiny, fast, deterministic 32-bit PRNG. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Weighted<T> { value: T; weight: number; }

/** Picks one weighted option using the next draw from `rng`. */
export function weightedPick<T>(rng: () => number, options: Weighted<T>[]): T {
  const total = options.reduce((s, o) => s + o.weight, 0);
  let r = rng() * total;
  for (const o of options) {
    r -= o.weight;
    if (r < 0) return o.value;
  }
  return options[options.length - 1].value;
}

export function w<T>(value: T, weight: number): Weighted<T> {
  return { value, weight };
}

// ── outcome vocabularies ─────────────────────────────────────────────────────

export type LeadOutcome = 'lost' | 'converted';
export type QuoteOutcome = 'rejected' | 'accepted';
export type PaymentPlan = 'net' | 'deposit-balance' | 'fifty-fifty' | 'pre-production';
export type Fulfillment = 'single' | 'split' | 'long-running';
export type Cancellation = 'none' | 'early' | 'late-fee';
export type QualityOutcome = 'clean' | 'ncr' | 'scrap';

/** The complete, pre-decided fate of one order storyline. */
export interface OrderFate {
  lead: LeadOutcome;
  quote: QuoteOutcome;
  payment: PaymentPlan;
  fulfillment: Fulfillment;
  cancellation: Cancellation;
  quality: QualityOutcome;
  recall: boolean;
}

/**
 * Rolls the full fate for a storyline from its seed. Draw order is fixed so the
 * same seed always yields the same fate regardless of which fields are read.
 */
export function rollOrderFate(seed: number): OrderFate {
  const rng = makeRng(seed);
  const lead = weightedPick(rng, [w<LeadOutcome>('lost', 55), w<LeadOutcome>('converted', 45)]);
  const quote = weightedPick(rng, [w<QuoteOutcome>('rejected', 25), w<QuoteOutcome>('accepted', 75)]);
  const payment = weightedPick(rng, [
    w<PaymentPlan>('net', 45), w<PaymentPlan>('deposit-balance', 20),
    w<PaymentPlan>('fifty-fifty', 20), w<PaymentPlan>('pre-production', 15),
  ]);
  const fulfillment = weightedPick(rng, [
    w<Fulfillment>('single', 60), w<Fulfillment>('split', 25), w<Fulfillment>('long-running', 15),
  ]);
  const cancellation = weightedPick(rng, [
    w<Cancellation>('none', 88), w<Cancellation>('early', 8), w<Cancellation>('late-fee', 4),
  ]);
  const quality = weightedPick(rng, [
    w<QualityOutcome>('clean', 88), w<QualityOutcome>('ncr', 7), w<QualityOutcome>('scrap', 5),
  ]);
  const recall = rng() < 0.02; // ~2% of proceeding orders seed a lot recall
  return { lead, quote, payment, fulfillment, cancellation, quality, recall };
}
