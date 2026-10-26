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
  /** 1 for a direct parent; higher levels are the assemblies those parents go into. */
  level: number;
  /** Part numbers from the queried part up to and including this parent. */
  path: string[];
}

export interface PartWhereUsedRow extends PartWhereUsed {
  rowKey: string;
}
