/**
 * Pillar 4 Phase 2 — Quality cluster receiving inspection frequency.
 * Mirrors the server enum <c>Forge.Core.Enums.ReceivingInspectionFrequency</c>.
 */
export type ReceivingInspectionFrequency = 'Every' | 'FirstArticle' | 'SkipLot' | 'Random';

export const RECEIVING_INSPECTION_FREQUENCIES: readonly ReceivingInspectionFrequency[] = [
  'Every',
  'FirstArticle',
  'SkipLot',
  'Random',
] as const;
