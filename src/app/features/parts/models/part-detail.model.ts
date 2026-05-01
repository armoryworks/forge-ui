import { AbcClass } from './abc-class.type';
import { BackflushPolicy } from './backflush-policy.type';
import { InventoryClass } from './inventory-class.type';
import { LotSizingRule } from './lot-sizing-rule.type';
import { PartStatus } from './part-status.type';
import { PartType } from './part-type.type';
import { ProcurementSource } from './procurement-source.type';
import { ReceivingInspectionFrequency } from './receiving-inspection-frequency.type';
import { TraceabilityType } from './traceability-type.type';
import { BOMEntry } from './bom-entry.model';
import { BOMUsage } from './bom-usage.model';

export interface PartDetail {
  id: number;
  partNumber: string;
  /** Short canonical identifier (required). Renders as the primary heading. */
  name: string;
  /** Long-form notes (optional). Paragraph-length detail beyond the name. */
  description: string | null;
  revision: string;
  status: PartStatus;
  /**
   * Legacy overloaded type. Pillar 1 decomposed it into procurementSource +
   * inventoryClass + itemKindId. Stays on the wire two release cycles for
   * rollback safety; new UI code should branch on the three axes.
   */
  partType: PartType;
  // Pillar 1 — orthogonal axes
  procurementSource: ProcurementSource;
  inventoryClass: InventoryClass;
  itemKindId: number | null;
  itemKindLabel: string | null;
  // Tier 0 additions
  traceabilityType: TraceabilityType;
  abcClass: AbcClass | null;
  manufacturerName: string | null;
  manufacturerPartNumber: string | null;
  material: string | null;
  // Pillar 2 — Tier 2 material spec FK (FK to reference_data,
  // group_code='part.material_spec'). Replaces the free-text material string.
  materialSpecId: number | null;
  materialSpecLabel: string | null;
  moldToolRef: string | null;
  externalPartNumber: string | null;
  externalId: string | null;
  externalRef: string | null;
  provider: string | null;
  preferredVendorId: number | null;
  preferredVendorName: string | null;
  minStockThreshold: number | null;
  reorderPoint: number | null;
  reorderQuantity: number | null;
  leadTimeDays: number | null;
  safetyStockDays: number | null;
  isSerialTracked: boolean;
  toolingAssetId: number | null;
  toolingAssetName: string | null;
  // Workflow Pattern Phase 5 — surfaces cost gates so the workflow shell's
  // hasCost predicate can read the part's current cost state.
  manualCostOverride: number | null;
  currentCostCalculationId: number | null;
  // Pillar 2 — Tier 2 measurement profile (canonical SI; *DisplayUnit
  // round-trips the unit the user originally typed).
  weightEach: number | null;
  weightDisplayUnit: string | null;
  lengthMm: number | null;
  widthMm: number | null;
  heightMm: number | null;
  dimensionDisplayUnit: string | null;
  volumeMl: number | null;
  volumeDisplayUnit: string | null;
  // Pillar 2 — Tier 2 valuation classification.
  valuationClassId: number | null;
  valuationClassLabel: string | null;
  // Pillar 2 — Tier 3 compliance + classification.
  htsCode: string | null;
  hazmatClass: string | null;
  shelfLifeDays: number | null;
  backflushPolicy: BackflushPolicy | null;
  isKit: boolean;
  isConfigurable: boolean;
  defaultBinId: number | null;
  sourcePartId: number | null;
  // Pillar 4 Phase 2 — MRP planning. Server-guaranteed since the
  // PartDetailResponseModel widening (commit follow-up to cluster dispatch).
  isMrpPlanned: boolean;
  lotSizingRule: LotSizingRule | null;
  fixedOrderQuantity: number | null;
  minimumOrderQuantity: number | null;
  orderMultiple: number | null;
  planningFenceDays: number | null;
  demandFenceDays: number | null;
  // Pillar 4 Phase 2 — Units of measure (FK to UnitOfMeasure + resolved code/label).
  stockUomId: number | null;
  stockUomCode: string | null;
  stockUomLabel: string | null;
  purchaseUomId: number | null;
  purchaseUomCode: string | null;
  purchaseUomLabel: string | null;
  salesUomId: number | null;
  salesUomCode: string | null;
  salesUomLabel: string | null;
  // Pillar 4 Phase 2 — Receiving inspection.
  requiresReceivingInspection: boolean;
  receivingInspectionTemplateId: number | null;
  inspectionFrequency: ReceivingInspectionFrequency | null;
  inspectionSkipAfterN: number | null;
  bomEntries: BOMEntry[];
  usedIn: BOMUsage[];
  createdAt: Date;
  updatedAt: Date;
}
