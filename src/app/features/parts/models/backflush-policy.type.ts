/**
 * Pillar 2 — Tier 3. Per-part override of the global backflush policy.
 * Mirrors the server enum <c>Forge.Core.Enums.BackflushPolicy</c>.
 */
export type BackflushPolicy = 'Auto' | 'Manual' | 'None';

export const BACKFLUSH_POLICIES: readonly BackflushPolicy[] = ['Auto', 'Manual', 'None'] as const;
