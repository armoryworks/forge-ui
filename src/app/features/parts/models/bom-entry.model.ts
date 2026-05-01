import { BOMSourceType } from './bom-source-type.type';

export interface BOMEntry {
  id: number;
  childPartId: number;
  childPartNumber: string;
  /** Child part's canonical short name (renamed from childDescription in the
   * Phase-4 Name+Description split). */
  childName: string;
  quantity: number;
  referenceDesignator: string | null;
  sortOrder: number;
  sourceType: BOMSourceType;
  leadTimeDays: number | null;
  notes: string | null;
}
