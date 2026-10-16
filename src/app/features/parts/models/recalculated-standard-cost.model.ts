/** Result of `POST /parts/{id}/recalculate-standard-cost` — the frozen rollup snapshot. */
export interface RecalculatedStandardCost {
  partId: number;
  material: number;
  labor: number;
  overhead: number;
  total: number;
  costCalculationId: number;
}
