import { PartType } from './part-type.type';

export interface CreatePartRequest {
  description: string;
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
