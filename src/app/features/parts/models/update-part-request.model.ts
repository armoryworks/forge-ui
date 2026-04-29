import { PartStatus } from './part-status.type';
import { PartType } from './part-type.type';

export interface UpdatePartRequest {
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
}
