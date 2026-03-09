import { BOMSourceType } from './bom-source-type.type';

export interface CreateBOMEntryRequest {
  childPartId: number;
  quantity: number;
  referenceDesignator?: string;
  sourceType: BOMSourceType;
  notes?: string;
}
