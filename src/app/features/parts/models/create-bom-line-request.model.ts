import { BOMSourceType } from './bom-source-type.type';

export interface CreateBOMLineRequest {
  childPartId: number;
  quantity: number;
  referenceDesignator?: string;
  sourceType: BOMSourceType;
  leadTimeDays?: number;
  notes?: string;
  /** UoM purchase-units effort — consumption UoM (default = child's stock UoM). */
  uomId?: number | null;
}
