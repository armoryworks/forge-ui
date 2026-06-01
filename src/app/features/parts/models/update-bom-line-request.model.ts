import { BOMSourceType } from './bom-source-type.type';

export interface UpdateBOMLineRequest {
  quantity?: number;
  referenceDesignator?: string;
  sourceType?: BOMSourceType;
  leadTimeDays?: number;
  notes?: string;
}
