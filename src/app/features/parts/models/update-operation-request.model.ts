export interface UpdateOperationRequest {
  stepNumber?: number;
  title?: string;
  instructions?: string;
  workCenterId?: number;
  estimatedMinutes?: number;
  isQcCheckpoint?: boolean;
  qcCriteria?: string;
  referencedOperationId?: number;
  // Phase 3 H5 / WU-13 — subcontract metadata. When IsSubcontract toggles
  // on, both vendor + turn-time must be supplied in the same patch.
  isSubcontract?: boolean;
  subcontractVendorId?: number | null;
  subcontractTurnTimeDays?: number | null;
}
