// EstimateRequest / EstimateResult — bound to eng-lead's frozen contract
// docs/estimating-engine-contract.md (published 2026-05-21)
//
// Open math questions (scrap convention, rate precedence, OSP basis, tier
// selection, RunMinutesLot, rounding) resolve inside Compute on the server;
// these DTOs are stable regardless.

export type PricingMode = 'Margin' | 'Markup';

export interface EstimatePricingInput {
  /** Discriminated: 'Margin' or 'Markup' — never interchangeable (§A1). */
  mode: PricingMode;
  /**
   * Margin:  0 ≤ value < 1  (e.g. 0.30 = 30 % margin)
   * Markup:  value ≥ 0      (e.g. 0.40 = 40 % markup)
   * UI stores as percentage (0–99); divide by 100 before sending.
   */
  value: number;
}

export interface EstimateMaterialInput {
  partId: number;
  qtyPerUnit: number;
  /** 0–1 additive waste factor. UI stores as %; divide by 100 before sending. */
  dropFactor: number;
  /** Converted to stocking UoM server-side. */
  uom: string;
  unitCost: number;
}

export interface EstimateOperationInput {
  stepNumber: number;
  workCenterId: number | null;
  /** Once per lot (fixed, amortises over qty). */
  setupMinutes: number;
  /** Scales with yield-adjusted qty. */
  runMinutesEach: number;
  /** Once per lot (in addition to per-each). */
  runMinutesLot: number;
  /** 0–1; Qeff = Q / (1 − scrapFactor). UI stores as %; divide by 100 before sending. */
  scrapFactor: number;
  laborRatePerHour: number;
  burdenRatePerHour: number;
  isSubcontract: boolean;
  subcontractUnitCost: number | null;
  subcontractMinimum: number | null;
  materials: EstimateMaterialInput[];
}

export interface EstimateNreLine {
  description: string;
  /** Counted exactly once — not per unit, not multiplied by break qty. */
  amount: number;
}

export interface EstimateRequest {
  partId: number;
  /** Ascending; one full cost rollup computed per break. */
  breakQuantities: number[];
  pricing: EstimatePricingInput;
  operations: EstimateOperationInput[];
  nreLines: EstimateNreLine[];
}

// ── Result ────────────────────────────────────────────────────────────────────

export interface EstimateCostBreakdown {
  laborCost: number;
  burdenCost: number;
  materialCost: number;
  ospCost: number;
  nreCost: number;
  totalCost: number;
}

export interface EstimateBreakResult {
  quantity: number;
  cost: EstimateCostBreakdown;
  unitCost: number;
  unitPrice: number;
  extendedPrice: number;
  /** Recomputed (price−cost)/price — display value, not the input Pricing.Value. */
  effectiveMargin: number;
}

export interface EstimateResult {
  breaks: EstimateBreakResult[];
  /** SHA-256 of normalised inputs — proves deterministic stable recompute. */
  inputHash: string;
  warnings: string[];
}
