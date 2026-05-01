import { AbcClass } from './abc-class.type';
import { BackflushPolicy } from './backflush-policy.type';
import { LotSizingRule } from './lot-sizing-rule.type';
import { PartStatus } from './part-status.type';
import { PartType } from './part-type.type';
import { ReceivingInspectionFrequency } from './receiving-inspection-frequency.type';
import { TraceabilityType } from './traceability-type.type';

// Pillar 4 Phase 2 — clearing convention for nullable fields:
//   - int? (FK / scalar): pass -1 to clear to null. ToolingAssetId /
//     PreferredVendorId / threshold legacy fields use 0 for back-compat.
//   - decimal?: pass a negative value (< 0) to clear to null on new fields.
//   - string?: pass empty/whitespace to clear to null.
//   - enum?: cannot be cleared via this endpoint — leave undefined to mean
//     "no change", or set a new value.
//   - bool?: undefined = no change; true/false sets the entity value explicitly.
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
  // Pillar 4 Phase 2 — UoM cluster (FK to UnitOfMeasure)
  stockUomId?: number;
  purchaseUomId?: number;
  salesUomId?: number;
  // Pillar 4 Phase 2 — MRP cluster
  isMrpPlanned?: boolean;
  lotSizingRule?: LotSizingRule;
  fixedOrderQuantity?: number;
  minimumOrderQuantity?: number;
  orderMultiple?: number;
  planningFenceDays?: number;
  demandFenceDays?: number;
  // Pillar 4 Phase 2 — Quality cluster (receiving inspection)
  requiresReceivingInspection?: boolean;
  receivingInspectionTemplateId?: number;
  inspectionFrequency?: ReceivingInspectionFrequency;
  inspectionSkipAfterN?: number;
  // Pillar 4 Phase 2 — Material cluster (measurement profile + valuation)
  materialSpecId?: number;
  weightEach?: number;
  weightDisplayUnit?: string;
  lengthMm?: number;
  widthMm?: number;
  heightMm?: number;
  dimensionDisplayUnit?: string;
  volumeMl?: number;
  volumeDisplayUnit?: string;
  valuationClassId?: number;
  // Pillar 4 Phase 2 — Tier 3 compliance / classification + ad-hoc fields
  hazmatClass?: string;
  shelfLifeDays?: number;
  backflushPolicy?: BackflushPolicy;
  isKit?: boolean;
  isConfigurable?: boolean;
  defaultBinId?: number;
  sourcePartId?: number;
  htsCode?: string;
}
