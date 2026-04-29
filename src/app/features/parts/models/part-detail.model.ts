import { PartStatus } from './part-status.type';
import { PartType } from './part-type.type';
import { BOMEntry } from './bom-entry.model';
import { BOMUsage } from './bom-usage.model';

export interface PartDetail {
  id: number;
  partNumber: string;
  description: string;
  revision: string;
  status: PartStatus;
  partType: PartType;
  material: string | null;
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
  bomEntries: BOMEntry[];
  usedIn: BOMUsage[];
  createdAt: Date;
  updatedAt: Date;
}
