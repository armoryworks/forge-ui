import { BOMSourceType } from './bom-source-type.type';

export interface UpdateBOMEntryRequest {
  quantity?: number;
  referenceDesignator?: string;
  sourceType?: BOMSourceType;
  leadTimeDays?: number;
  notes?: string;
}
