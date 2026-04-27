export interface CreateOperationRequest {
  stepNumber: number;
  title: string;
  instructions?: string;
  workCenterId?: number;
  estimatedMinutes?: number;
  isQcCheckpoint: boolean;
  qcCriteria?: string;
  referencedOperationId?: number;
  // Phase 3 H5 / WU-13 — subcontract metadata. Both vendor + turn-time
  // are required when isSubcontract = true (server returns 400 otherwise).
  isSubcontract?: boolean;
  subcontractVendorId?: number;
  subcontractTurnTimeDays?: number;
}
