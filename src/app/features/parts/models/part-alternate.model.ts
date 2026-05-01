export type AlternateType = 'Substitute' | 'Equivalent' | 'Superseded';

export interface PartAlternate {
  id: number;
  partId: number;
  alternatePartId: number;
  alternatePartNumber: string;
  /** Alternate part's canonical short name (renamed from
   * alternatePartDescription in the Phase-4 Name+Description split). */
  alternatePartName: string;
  priority: number;
  type: AlternateType;
  conversionFactor: number | null;
  isApproved: boolean;
  approvedByName: string | null;
  approvedAt: string | null;
  notes: string | null;
  isBidirectional: boolean;
  createdAt: string;
}

export interface CreatePartAlternateRequest {
  alternatePartId: number;
  priority: number;
  type: AlternateType;
  conversionFactor?: number | null;
  isApproved: boolean;
  notes?: string | null;
  isBidirectional: boolean;
}

export interface UpdatePartAlternateRequest {
  priority?: number;
  type?: AlternateType;
  conversionFactor?: number | null;
  isApproved?: boolean;
  notes?: string | null;
  isBidirectional?: boolean;
}
