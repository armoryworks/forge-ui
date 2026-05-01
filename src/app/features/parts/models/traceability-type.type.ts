/**
 * Tier 0 — How units of a part are tracked through inventory and production.
 * Replaces the legacy <c>isSerialTracked</c> boolean. Mirrors the server enum
 * <c>QBEngineer.Core.Enums.TraceabilityType</c>.
 */
export type TraceabilityType = 'None' | 'Lot' | 'Serial';

export const TRACEABILITY_TYPES: readonly TraceabilityType[] = ['None', 'Lot', 'Serial'] as const;
