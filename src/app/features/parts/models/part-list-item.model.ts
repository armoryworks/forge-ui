import { PartStatus } from './part-status.type';
import { PartType } from './part-type.type';

export interface PartListItem {
  id: number;
  partNumber: string;
  description: string;
  revision: string;
  status: PartStatus;
  partType: PartType;
  material: string | null;
  bomEntryCount: number;
  createdAt: string;
}
