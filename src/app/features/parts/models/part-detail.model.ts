import { PartStatus } from './part-status.type';
import { PartType } from './part-type.type';
import { BOMEntry } from './bom-entry.model';
import { BOMUsage } from './bom-usage.model';

export interface PartDetail {
  id: number;
  partNumber: string;
  description: string;
  revision: string;
  status: PartStatus;
  partType: PartType;
  material: string | null;
  moldToolRef: string | null;
  externalId: string | null;
  externalRef: string | null;
  provider: string | null;
  preferredVendorId: number | null;
  preferredVendorName: string | null;
  minStockThreshold: number | null;
  reorderPoint: number | null;
  bomEntries: BOMEntry[];
  usedIn: BOMUsage[];
  createdAt: string;
  updatedAt: string;
}
