import { BOMSourceType } from './bom-source-type.type';

export interface CreateBOMEntryRequest {
  childPartId: number;
  quantity: number;
  referenceDesignator?: string;
  sourceType: BOMSourceType;
  leadTimeDays?: number;
  notes?: string;
}
