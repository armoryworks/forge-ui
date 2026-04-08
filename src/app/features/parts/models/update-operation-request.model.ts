export interface UpdateOperationRequest {
  stepNumber?: number;
  title?: string;
  instructions?: string;
  workCenterId?: number;
  estimatedMinutes?: number;
  isQcCheckpoint?: boolean;
  qcCriteria?: string;
}
