import { AbcClass } from './abc-class.type';
import { PartStatus } from './part-status.type';
import { PartType } from './part-type.type';
import { TraceabilityType } from './traceability-type.type';

export interface UpdatePartRequest {
  /** Required short identifier (omit to leave unchanged). */
  name?: string;
  /** Optional long-form notes (empty string clears the value server-side). */
  description?: string;
  revision?: string;
  status?: PartStatus;
  partType?: PartType;
  material?: string;
  moldToolRef?: string;
  externalPartNumber?: string;
  toolingAssetId?: number;
  minStockThreshold?: number;
  reorderPoint?: number;
  reorderQuantity?: number;
  leadTimeDays?: number;
  safetyStockDays?: number;
  // Workflow Pattern Phase 5 — manual cost override (Tier 1 single-rate).
  // Sentinel value -1 means "clear to null".
  manualCostOverride?: number;
  // Pillar 1 / Tier 0 — manufacturer + traceability + ABC class.
  manufacturerName?: string;
  manufacturerPartNumber?: string;
  traceabilityType?: TraceabilityType;
  abcClass?: AbcClass | null;
}
