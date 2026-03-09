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
  bomEntries: BOMEntry[];
  usedIn: BOMUsage[];
  createdAt: string;
  updatedAt: string;
}

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

export interface BOMUsage {
  id: number;
  parentPartId: number;
  parentPartNumber: string;
  parentDescription: string;
  quantity: number;
}

export interface CreatePartRequest {
  partNumber: string;
  description: string;
  revision?: string;
  partType: PartType;
  material?: string;
  moldToolRef?: string;
}

export interface UpdatePartRequest {
  description?: string;
  revision?: string;
  status?: PartStatus;
  partType?: PartType;
  material?: string;
  moldToolRef?: string;
}

export interface CreateBOMEntryRequest {
  childPartId: number;
  quantity: number;
  referenceDesignator?: string;
  sourceType: BOMSourceType;
  notes?: string;
}

export interface UpdateBOMEntryRequest {
  quantity?: number;
  referenceDesignator?: string;
  sourceType?: BOMSourceType;
  notes?: string;
}

export type PartStatus = 'Active' | 'Obsolete' | 'Draft';
export type PartType = 'Part' | 'Assembly';
export type BOMSourceType = 'Make' | 'Buy';
