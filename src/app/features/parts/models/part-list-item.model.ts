import { PartStatus } from './part-status.type';
import { PartType } from './part-type.type';

export interface PartListItem {
  id: number;
  partNumber: string;
  externalPartNumber: string | null;
  /** Short canonical identifier (required). Primary list column. */
  name: string;
  /** Long-form notes (optional). Shown only when present. */
  description: string | null;
  revision: string;
  status: PartStatus;
  partType: PartType;
  material: string | null;
  bomEntryCount: number;
  createdAt: Date;
  defaultPrice?: number | null;
}
