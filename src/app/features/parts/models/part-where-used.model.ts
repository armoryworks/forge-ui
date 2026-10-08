import { BOMSourceType } from './bom-source-type.type';

export interface PartWhereUsed {
  bomLineId: number;
  parentPartId: number;
  parentPartNumber: string;
  parentName: string;
  parentRevision: string;
  quantityPer: number;
  sourceType: BOMSourceType;
  openWorkOrderCount: number;
}
