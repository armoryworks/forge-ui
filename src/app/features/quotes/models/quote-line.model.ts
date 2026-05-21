/** §9 of estimating-engine-contract.md — per-line cost breakdown (present when line was created from an estimate). */
export interface QuoteLineCostBreakdown {
  labor: number;
  burden: number;
  material: number;
  osp: number;
  total: number;
}

export interface QuoteLine {
  id: number;
  partId: number | null;
  partNumber: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  lineNumber: number;
  notes: string | null;
  /** Present when the line was priced from an estimate; null for manually-priced lines. */
  costBreakdown: QuoteLineCostBreakdown | null;
  /** Recomputed effective margin (price−cost)/price; null when costBreakdown is absent. */
  effectiveMargin: number | null;
}
