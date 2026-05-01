/**
 * Pillar 1 — How a part is sourced. Mirrors the server enum
 * <c>QBEngineer.Core.Enums.ProcurementSource</c>.
 */
export type ProcurementSource = 'Make' | 'Buy' | 'Subcontract' | 'Phantom';

export const PROCUREMENT_SOURCES: readonly ProcurementSource[] = ['Make', 'Buy', 'Subcontract', 'Phantom'] as const;
