import { AbcClass } from './abc-class.type';
import { BackflushPolicy } from './backflush-policy.type';
import { InventoryClass } from './inventory-class.type';
import { LotSizingRule } from './lot-sizing-rule.type';
import { PartStatus } from './part-status.type';
import { ProcurementSource } from './procurement-source.type';
import { ReceivingInspectionFrequency } from './receiving-inspection-frequency.type';
import { TraceabilityType } from './traceability-type.type';
import { BOMLine } from './bom-line.model';
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
  // Pillar 1 — three orthogonal axes (legacy single-axis partType retired
  // pre-beta). The axes are required; itemKindId is the optional descriptive tag.
  procurementSource: ProcurementSource;
  inventoryClass: InventoryClass;
  itemKindId: number | null;
  itemKindLabel: string | null;
  // Tier 0 additions
  traceabilityType: TraceabilityType;
  abcClass: AbcClass | null;
  // Pillar 2 — Tier 2 material spec FK (FK to reference_data,
  // group_code='part.material_spec'). The legacy free-text material string
  // and moldToolRef were retired pre-beta.
  materialSpecId: number | null;
  materialSpecLabel: string | null;
  externalId: string | null;
  externalRef: string | null;
  provider: string | null;
  // GS1 GTIN barcode identity (CAP-MD-GS1). Absent/null when the part uses its
  // free internal barcode; set to a globally-unique GTIN once assigned/allocated.
  // Optional so existing part fixtures/constructions stay valid.
  gtin?: string | null;
  preferredVendorId: number | null;
  preferredVendorName: string | null;
  minStockThreshold: number | null;
  reorderPoint: number | null;
  reorderQuantity: number | null;
  safetyStockDays: number | null;
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
  bomLines: BOMLine[];
  usedIn: BOMUsage[];
  createdAt: Date;
  updatedAt: Date;
  /**
   * Effective sales price as resolved server-side via IPartPricingResolver.
   * Always present; <code>0</code> when {@link effectivePriceSource} is "Default".
   */
  effectivePrice: number;
  effectivePriceCurrency: string;
  effectivePriceSource: 'PriceListEntry' | 'PartPrice' | 'VendorPartTier' | 'Default';
}
