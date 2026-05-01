export interface Operation {
  id: number;
  partId: number;
  stepNumber: number;
  title: string;
  instructions: string | null;
  workCenterId: number | null;
  workCenterName: string | null;
  estimatedMinutes: number | null;
  isQcCheckpoint: boolean;
  qcCriteria: string | null;
  referencedOperationId: number | null;
  referencedOperationTitle: string | null;
  materials: OperationMaterial[];
  createdAt: Date;
  updatedAt: Date;
  // Phase 3 H5 / WU-13 — subcontract metadata round-tripped from server
  // (only meaningful when isSubcontract = true).
  isSubcontract: boolean;
  subcontractVendorId: number | null;
  subcontractVendorName: string | null;
  subcontractTurnTimeDays: number | null;
}

export interface OperationMaterial {
  id: number;
  operationId: number;
  bomEntryId: number;
  childPartNumber: string;
  /** Child part's canonical short name (renamed from childPartDescription in
   * the Phase-4 Name+Description split). */
  childPartName: string;
  quantity: number;
  notes: string | null;
}
