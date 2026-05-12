/**
 * Pillar 4 Phase 2 — MRP cluster lot-sizing rule.
 * Mirrors the server enum <c>Forge.Core.Enums.LotSizingRule</c>.
 */
export type LotSizingRule =
  | 'LotForLot'
  | 'FixedQuantity'
  | 'MinMax'
  | 'EconomicOrderQuantity'
  | 'MultiplesOf';

export const LOT_SIZING_RULES: readonly LotSizingRule[] = [
  'LotForLot',
  'FixedQuantity',
  'MinMax',
  'EconomicOrderQuantity',
  'MultiplesOf',
] as const;
