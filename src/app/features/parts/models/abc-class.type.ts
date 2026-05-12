/**
 * Tier 0 — Cycle-counting frequency tier and stock-movement KPI bucket.
 * Mirrors the server enum <c>Forge.Core.Enums.AbcClass</c>.
 */
export type AbcClass = 'A' | 'B' | 'C';

export const ABC_CLASSES: readonly AbcClass[] = ['A', 'B', 'C'] as const;
