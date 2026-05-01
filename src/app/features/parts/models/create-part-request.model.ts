import { PartType } from './part-type.type';

export interface CreatePartRequest {
  /** Required short identifier. */
  name: string;
  /** Optional long-form notes. */
  description?: string;
  revision?: string;
  partType: PartType;
  material?: string;
  moldToolRef?: string;
  externalPartNumber?: string;
  toolingAssetId?: number;
  minStockThreshold?: number;
  reorderPoint?: number;
  reorderQuantity?: number;
  leadTimeDays?: number;
  safetyStockDays?: number;
}
