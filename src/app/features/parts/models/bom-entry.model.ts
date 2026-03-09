import { BOMSourceType } from './bom-source-type.type';

export interface BOMEntry {
  id: number;
  childPartId: number;
  childPartNumber: string;
  childDescription: string;
  quantity: number;
  referenceDesignator: string | null;
  sortOrder: number;
  sourceType: BOMSourceType;
  notes: string | null;
}
